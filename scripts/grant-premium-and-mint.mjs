// One-off: grants premium to a phone number and mints a valid magic link,
// printing the full /journey/enter URL. Mirrors lib/participant-auth.ts's
// token scheme (base64url(32 random bytes); store sha256 hex; 48h TTL).
//
// Usage: node scripts/grant-premium-and-mint.mjs <phone_number>

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import crypto from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const SITE_ORIGIN = "https://www.30daysonthemount.com";
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — matches MAGIC_LINK_TTL_SECONDS

function readEnvLocal(key) {
  const lines = readFileSync(join(rootDir, ".env.local"), "utf8").split("\n");
  for (const line of lines) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (!m || m[1] !== key) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    return v.trim();
  }
  return undefined;
}

const rawPhone = process.argv[2];
if (!rawPhone) {
  console.error("Usage: node scripts/grant-premium-and-mint.mjs <phone_number>");
  process.exit(1);
}
const phone = rawPhone.replace(/^\+/, "").replace(/[^0-9]/g, ""); // canonical digit-only

const origin = new URL(readEnvLocal("SUPABASE_URL")).origin;
const key = readEnvLocal("SUPABASE_SERVICE_ROLE_KEY");
const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

async function rest(path, init = {}) {
  const res = await fetch(`${origin}/rest/v1/${path}`, { ...init, headers: { ...headers, ...(init.headers || {}) } });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    console.error("REST error:", res.status, JSON.stringify(body));
    process.exit(1);
  }
  return body;
}

// 1. Look up the user.
const existing = await rest(`users?phone_number=eq.${phone}&select=phone_number,status,current_day,access_tier`);
const nowIso = new Date().toISOString();

if (existing.length === 0) {
  // New test user: active, premium, mid-journey so completed/active/locked
  // states are all visible on the home screen.
  await rest(`users`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      phone_number: phone,
      status: "active",
      current_day: 3,
      access_tier: "premium",
      premium_granted_at: nowIso,
      onboarding_step: "completed",
    }),
  });
  console.log(`Created new user ${phone} (active, premium, current_day=3).`);
} else {
  const u = existing[0];
  const patch = { access_tier: "premium", premium_granted_at: nowIso, status: "active" };
  // Only nudge current_day up for a good visual test if they're pre-journey.
  if (u.current_day < 1) patch.current_day = 3;
  await rest(`users?phone_number=eq.${phone}`, { method: "PATCH", body: JSON.stringify(patch) });
  console.log(
    `Updated existing user ${phone}: premium, active${patch.current_day ? `, current_day set to 3 (was ${u.current_day})` : `, current_day kept at ${u.current_day}`}.`,
  );
}

// 2. Mint a magic link.
const rawToken = crypto.randomBytes(32).toString("base64url");
const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
const expiresAt = new Date(Date.now() + TTL_MS).toISOString();

await rest(`magic_links`, {
  method: "POST",
  body: JSON.stringify({ phone_number: phone, token_hash: tokenHash, expires_at: expiresAt }),
});

console.log("\n=== MAGIC LINK (persistent key, expires in 30 days) ===");
console.log(`${SITE_ORIGIN}/journey/enter?t=${rawToken}`);
console.log("======================================================");
