import "server-only";
import crypto from "node:crypto";
import http2 from "node:http2";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { DeviceRow } from "@/lib/supabase/types";
import { timed } from "@/lib/timing";

// Apple Push Notification service, token-based (.p8) auth.
//
// Configure with:
//   APNS_KEY_ID       the key's ID (Certificates, IDs & Profiles → Keys)
//   APNS_PRIVATE_KEY  the .p8 file's contents; literal "\n" sequences are
//                     accepted, since env UIs often flatten newlines
//   APNS_TEAM_ID      optional, defaults to The Matterworks team
//   APNS_TOPIC        optional, defaults to the app's bundle ID
//
// Until the key is set, isApnsConfigured() is false and nothing is sent —
// callers fall back exactly as if the participant had no devices.

const HOSTS = {
  production: "https://api.push.apple.com",
  development: "https://api.sandbox.push.apple.com",
} as const;

export type AppNotification = {
  title: string;
  body: string;
  /** mount:// deep link opened when the notification is tapped. */
  link: string;
  dayNumber?: number;
  /** UNNotificationCategory identifier, e.g. the evening check-in's reply action. */
  category?: string;
  /** Replaces an earlier notification with the same id instead of stacking. */
  collapseId?: string;
};

function config() {
  const keyId = process.env.APNS_KEY_ID?.trim();
  const privateKey = process.env.APNS_PRIVATE_KEY?.trim().replace(/\\n/g, "\n");
  if (!keyId || !privateKey) return null;
  return {
    keyId,
    privateKey,
    teamId: process.env.APNS_TEAM_ID?.trim() || "LUX5PGSCA8",
    topic: process.env.APNS_TOPIC?.trim() || "com.thematterworks.mount",
  };
}

export function isApnsConfigured(): boolean {
  return config() !== null;
}

// Apple rejects tokens older than an hour and throttles ones refreshed more
// than every 20 minutes, so one is reused for 50.
let cachedJwt: { token: string; issuedAt: number } | null = null;

function providerToken(keyId: string, teamId: string, privateKey: string): string {
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && now - cachedJwt.issuedAt < 50 * 60) return cachedJwt.token;
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${encode({ alg: "ES256", kid: keyId })}.${encode({ iss: teamId, iat: now })}`;
  const signature = crypto.sign("sha256", Buffer.from(unsigned), { key: privateKey, dsaEncoding: "ieee-p1363" });
  cachedJwt = { token: `${unsigned}.${signature.toString("base64url")}`, issuedAt: now };
  return cachedJwt.token;
}

type SendOutcome = { ok: true } | { ok: false; status: number; reason: string };

function sendOne(
  client: http2.ClientHttp2Session,
  device: DeviceRow,
  jwt: string,
  topic: string,
  notification: AppNotification,
): Promise<SendOutcome> {
  const payload = JSON.stringify({
    aps: {
      alert: { title: notification.title, body: notification.body },
      sound: "default",
      ...(notification.category ? { category: notification.category } : {}),
      // A notification about a day also wakes the app briefly in the
      // background, so it catches up with the server (the new day) and
      // refreshes its widgets and Live Activity even if it isn't opened.
      ...(notification.dayNumber !== undefined ? { "content-available": 1 } : {}),
    },
    link: notification.link,
    ...(notification.dayNumber !== undefined ? { dayNumber: notification.dayNumber } : {}),
  });

  return new Promise((resolve) => {
    const request = client.request({
      ":method": "POST",
      ":path": `/3/device/${device.apns_token}`,
      authorization: `bearer ${jwt}`,
      "apns-topic": topic,
      "apns-push-type": "alert",
      "apns-priority": "10",
      ...(notification.collapseId ? { "apns-collapse-id": notification.collapseId } : {}),
    });
    let status = 0;
    let body = "";
    request.setEncoding("utf8");
    request.on("response", (headers) => {
      status = Number(headers[":status"]);
    });
    request.on("data", (chunk: string) => {
      body += chunk;
    });
    request.on("end", () => {
      if (status === 200) return resolve({ ok: true });
      let reason = "Unknown";
      try {
        reason = (JSON.parse(body) as { reason?: string }).reason ?? reason;
      } catch {}
      resolve({ ok: false, status, reason });
    });
    request.on("error", (error) => resolve({ ok: false, status: 0, reason: error.message }));
    request.end(payload);
  });
}

/**
 * Sends a notification to every device this participant has signed in on.
 * Returns how many accepted it — 0 when APNs isn't configured or the
 * participant has no devices, which callers treat as "use another channel".
 * Tokens Apple reports as dead are removed.
 */
export async function sendAppNotification(phoneNumber: string, notification: AppNotification): Promise<number> {
  const settings = config();
  if (!settings) return 0;

  const supabase = getSupabaseAdmin();
  const { data: devices } = await supabase.from("devices").select("*").eq("phone_number", phoneNumber);
  if (!devices?.length) return 0;

  let jwt: string;
  try {
    jwt = providerToken(settings.keyId, settings.teamId, settings.privateKey);
  } catch (error) {
    console.error("APNs key couldn't sign a provider token — check APNS_PRIVATE_KEY", error);
    return 0;
  }

  let delivered = 0;
  for (const environment of ["production", "development"] as const) {
    const group = devices.filter((device) => device.environment === environment);
    if (!group.length) continue;

    const client = http2.connect(HOSTS[environment]);
    client.on("error", (error) => console.error(`APNs ${environment} connection error`, error));
    try {
      const outcomes = await timed(`send:apns-${environment}`, () =>
        Promise.all(group.map((device) => sendOne(client, device, jwt, settings.topic, notification))),
      );
      for (const [index, outcome] of outcomes.entries()) {
        if (outcome.ok) {
          delivered += 1;
          continue;
        }
        console.error(`APNs rejected a notification: ${outcome.status} ${outcome.reason}`);
        if (outcome.status === 410 || outcome.reason === "BadDeviceToken" || outcome.reason === "DeviceTokenNotForTopic") {
          await supabase.from("devices").delete().eq("apns_token", group[index].apns_token);
        }
      }
    } finally {
      client.close();
    }
  }
  return delivered;
}
