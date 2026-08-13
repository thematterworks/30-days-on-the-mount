import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { parseWhatsAppWebhookPayload } from "@/lib/whatsapp";
import { handleInboundMessage } from "@/lib/conversation-engine";

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
      await handleInboundMessage({
        channel: "whatsapp",
        from: message.from,
        text: message.text,
        providerMessageId: message.whatsappMessageId,
      });
    } catch (error) {
      console.error("Failed to process inbound WhatsApp message", error);
    }
  }

  return NextResponse.json({ ok: true });

  async function applyStatusUpdate(status: (typeof statuses)[number]) {
    await supabase
      .from("message_logs")
      .update({ status: status.status })
      .eq("provider_message_id", status.whatsappMessageId);
  }
}
