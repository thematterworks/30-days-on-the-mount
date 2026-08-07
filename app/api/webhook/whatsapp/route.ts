import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  parseWhatsAppWebhookPayload,
  sendFreeformTextMessage,
  sendTemplateMessage,
} from "@/lib/whatsapp";
import { generateReflectionReply } from "@/lib/ai";
import { getAiPersonaSystemPrompt, isAiAutoReplyEnabled } from "@/lib/system-config";

/** Meta webhook handshake verification. */
export function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === env.WHATSAPP_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { messages, statuses } = parseWhatsAppWebhookPayload(payload);
  const supabase = getSupabaseAdmin();

  await Promise.all(statuses.map((status) => applyStatusUpdate(status)));

  for (const message of messages) {
    try {
      await handleInboundMessage(message);
    } catch (error) {
      console.error("Failed to process inbound WhatsApp message", error);
    }
  }

  return NextResponse.json({ ok: true });

  async function applyStatusUpdate(status: (typeof statuses)[number]) {
    await supabase
      .from("message_logs")
      .update({ status: status.status })
      .eq("whatsapp_message_id", status.whatsappMessageId);
  }
}

async function handleInboundMessage(message: {
  from: string;
  text: string;
  whatsappMessageId: string;
}) {
  const supabase = getSupabaseAdmin();
  const { from, text, whatsappMessageId } = message;

  const { data: existingUser } = await supabase
    .from("users")
    .select("*")
    .eq("phone_number", from)
    .maybeSingle();

  if (!existingUser) {
    await supabase.from("users").insert({
      phone_number: from,
      status: "active",
      current_day: 0,
      last_interaction_at: new Date().toISOString(),
    });

    await supabase.from("message_logs").insert({
      phone_number: from,
      direction: "inbound",
      message_type: "freeform",
      message_body: text,
      whatsapp_message_id: whatsappMessageId,
      status: "delivered",
    });

    const { data: welcomeDay } = await supabase
      .from("curriculum_days")
      .select("template_name")
      .eq("day_number", 0)
      .maybeSingle();

    const templateName = welcomeDay?.template_name ?? "day_00_welcome";
    const result = await sendTemplateMessage(from, templateName);

    await supabase.from("message_logs").insert({
      phone_number: from,
      direction: "outbound",
      message_type: "template",
      message_body: `[template:${templateName}]`,
      whatsapp_message_id: result.messageId,
      status: result.ok ? "sent" : "failed",
    });

    return;
  }

  await supabase
    .from("users")
    .update({ last_interaction_at: new Date().toISOString() })
    .eq("phone_number", from);

  await supabase.from("message_logs").insert({
    phone_number: from,
    direction: "inbound",
    message_type: "freeform",
    message_body: text,
    whatsapp_message_id: whatsappMessageId,
    status: "delivered",
  });

  const autoReplyEnabled = await isAiAutoReplyEnabled();
  if (!autoReplyEnabled || existingUser.ai_paused) {
    return;
  }

  const { data: curriculumDay } = await supabase
    .from("curriculum_days")
    .select("*")
    .eq("day_number", existingUser.current_day)
    .maybeSingle();

  const personaSystemPrompt = await getAiPersonaSystemPrompt();

  let reply: string;
  try {
    reply = await generateReflectionReply({
      personaSystemPrompt,
      dayNumber: existingUser.current_day,
      dayTitle: curriculumDay?.title ?? `Day ${existingUser.current_day}`,
      dayAiGuidancePrompt: curriculumDay?.ai_guidance_prompt ?? "",
      userMessage: text,
    });
  } catch (error) {
    // Log the failure as a visible message_logs row (status: failed) instead of
    // silently dropping the reply — this is what makes AI Engine misconfiguration
    // (e.g. a bad AI_API_KEY) show up in the Live Conversation Inbox rather than
    // only in Vercel's function logs.
    const message = error instanceof Error ? error.message : "Unknown AI engine error";
    console.error("AI reflection reply failed", error);
    await supabase.from("message_logs").insert({
      phone_number: from,
      direction: "outbound",
      message_type: "ai_generated",
      message_body: `[AI reply failed: ${message}]`,
      whatsapp_message_id: null,
      status: "failed",
    });
    return;
  }

  const result = await sendFreeformTextMessage(from, reply);

  await supabase.from("message_logs").insert({
    phone_number: from,
    direction: "outbound",
    message_type: "ai_generated",
    message_body: reply,
    whatsapp_message_id: result.messageId,
    status: result.ok ? "sent" : "failed",
  });
}
