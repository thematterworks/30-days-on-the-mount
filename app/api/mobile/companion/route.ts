import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { handleInboundMessage } from "@/lib/conversation-engine";
import { badRequest, getMobileParticipant, readJson, unauthorized } from "@/lib/mobile";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { MessageLogRow } from "@/lib/supabase/types";
import { withTiming } from "@/lib/timing";

const MAX_MESSAGE_LENGTH = 2000;

/**
 * The companion is one continuous conversation across every channel — the
 * same message_logs thread the SMS engine writes — so someone who started by
 * text finds their history waiting in the app.
 */
function toMessage(
  row: Pick<MessageLogRow, "id" | "direction" | "message_body" | "created_at" | "channel">,
  dayNumber: number | null = null,
) {
  return {
    id: row.id,
    role: row.direction === "inbound" ? "participant" : "companion",
    text: row.message_body,
    sentAt: row.created_at,
    channel: row.channel,
    dayNumber,
  };
}

/** `[template:day_04_…]` → 4. Other templates (the evening check-in) carry no day. */
function templateDay(body: string): number | null {
  const match = /^\[template:day_(\d+)/.exec(body);
  return match ? Number(match[1]) : null;
}

export async function GET(request: NextRequest) {
  const participant = await getMobileParticipant(request);
  if (!participant) return unauthorized();

  // Failed rows are diagnostics for the admin inbox. Templates — the daily
  // pushes, logged as `[template:day_NN_…]` — aren't shown, but they mark
  // where each day began, so every message is labelled with the day it was
  // written in. That is what lets the app set "Day 4" between entries.
  const { data, error } = await getSupabaseAdmin()
    .from("message_logs")
    .select("id, direction, message_type, message_body, created_at, channel")
    .eq("phone_number", participant.phone_number)
    .neq("status", "failed")
    .order("created_at", { ascending: false })
    .limit(260);
  if (error) return NextResponse.json({ error: "Couldn't load the conversation." }, { status: 500 });

  const messages = [];
  let day: number | null = null;
  for (const row of (data ?? []).reverse()) {
    if (row.message_type === "template") {
      day = templateDay(row.message_body) ?? day;
      continue;
    }
    messages.push(toMessage(row, day));
  }
  return NextResponse.json({ messages: messages.slice(-200) });
}

/**
 * Sends a message to the companion and returns its reply. It runs through
 * handleInboundMessage on the 'app' channel — the same engine as SMS, minus
 * the carrier keywords — and the reply is read back from message_logs.
 */
export async function POST(request: NextRequest) {
  const participant = await getMobileParticipant(request);
  if (!participant) return unauthorized();

  const text = (await readJson(request)).text;
  if (typeof text !== "string" || !text.trim()) return badRequest("Write something first.");
  if (text.length > MAX_MESSAGE_LENGTH) return badRequest("That's a little long — try breaking it into a few messages.");

  const startedAt = new Date().toISOString();
  await withTiming("inbound-app", () =>
    handleInboundMessage({
      channel: "app",
      from: participant.phone_number,
      text,
      providerMessageId: `app_${crypto.randomUUID()}`,
    }),
  );

  const { data } = await getSupabaseAdmin()
    .from("message_logs")
    .select("id, direction, message_body, created_at, channel, status")
    .eq("phone_number", participant.phone_number)
    .eq("direction", "outbound")
    .eq("channel", "app")
    .gte("created_at", startedAt)
    .order("created_at");

  const replies = data ?? [];
  if (replies.length > 0 && replies.every((row) => row.status === "failed")) {
    return NextResponse.json({ error: "The companion is quiet right now. Try again in a moment." }, { status: 502 });
  }
  return NextResponse.json({
    replies: replies.filter((row) => row.status !== "failed").map((row) => toMessage(row, participant.current_day)),
  });
}
