import "server-only";
import { env } from "@/lib/env";

const GRAPH_API_VERSION = "v19.0";

function graphUrl(path: string): string {
  return `https://graph.facebook.com/${GRAPH_API_VERSION}/${path}`;
}

interface WhatsAppSendResult {
  ok: boolean;
  messageId: string | null;
  error: string | null;
}

async function postToGraphApi(body: Record<string, unknown>): Promise<WhatsAppSendResult> {
  try {
    const response = await fetch(graphUrl(`${env.WHATSAPP_PHONE_NUMBER_ID}/messages`), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messaging_product: "whatsapp", ...body }),
    });

    const payload = await response.json();

    if (!response.ok) {
      const message =
        payload?.error?.message ?? `WhatsApp API responded with status ${response.status}`;
      return { ok: false, messageId: null, error: message };
    }

    const messageId: string | null = payload?.messages?.[0]?.id ?? null;
    return { ok: true, messageId, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown WhatsApp API error";
    return { ok: false, messageId: null, error: message };
  }
}

/**
 * Sends a pre-approved Meta template message. Required outside the 24-hour
 * free-form window (e.g. the daily cron delivery, the Day 0 welcome).
 */
export async function sendTemplateMessage(
  to: string,
  templateName: string,
  languageCode = "en_US",
): Promise<WhatsAppSendResult> {
  return postToGraphApi({
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
    },
  });
}

/**
 * Sends a free-form text message. Only valid within 24 hours of the user's
 * last inbound message per Meta's customer service window policy.
 */
export async function sendFreeformTextMessage(
  to: string,
  body: string,
): Promise<WhatsAppSendResult> {
  return postToGraphApi({
    to,
    type: "text",
    text: { body, preview_url: false },
  });
}

export interface InboundWhatsAppMessage {
  from: string;
  text: string;
  whatsappMessageId: string;
  timestamp: string;
}

export interface InboundStatusUpdate {
  whatsappMessageId: string;
  status: "sent" | "delivered" | "read" | "failed";
  recipientId: string;
}

interface ParsedWebhookPayload {
  messages: InboundWhatsAppMessage[];
  statuses: InboundStatusUpdate[];
}

/**
 * Parses a Meta WhatsApp Cloud API webhook POST body into inbound messages
 * and status updates. Non-text message types (image, audio, location, etc.)
 * are ignored for now — the practice is text-reflection driven.
 */
export function parseWhatsAppWebhookPayload(payload: unknown): ParsedWebhookPayload {
  const messages: InboundWhatsAppMessage[] = [];
  const statuses: InboundStatusUpdate[] = [];

  const entries = isRecord(payload) && Array.isArray(payload.entry) ? payload.entry : [];

  for (const entry of entries) {
    if (!isRecord(entry) || !Array.isArray(entry.changes)) continue;

    for (const change of entry.changes) {
      if (!isRecord(change) || !isRecord(change.value)) continue;
      const value = change.value;

      if (Array.isArray(value.messages)) {
        for (const message of value.messages) {
          if (!isRecord(message)) continue;
          if (message.type !== "text" || !isRecord(message.text)) continue;
          const from = typeof message.from === "string" ? message.from : null;
          const text = typeof message.text.body === "string" ? message.text.body : null;
          const id = typeof message.id === "string" ? message.id : null;
          const timestamp = typeof message.timestamp === "string" ? message.timestamp : null;
          if (from && text && id && timestamp) {
            messages.push({ from, text, whatsappMessageId: id, timestamp });
          }
        }
      }

      if (Array.isArray(value.statuses)) {
        for (const status of value.statuses) {
          if (!isRecord(status)) continue;
          const id = typeof status.id === "string" ? status.id : null;
          const statusValue = typeof status.status === "string" ? status.status : null;
          const recipientId = typeof status.recipient_id === "string" ? status.recipient_id : null;
          if (id && recipientId && isMessageStatus(statusValue)) {
            statuses.push({ whatsappMessageId: id, status: statusValue, recipientId });
          }
        }
      }
    }
  }

  return { messages, statuses };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isMessageStatus(value: string | null): value is InboundStatusUpdate["status"] {
  return value === "sent" || value === "delivered" || value === "read" || value === "failed";
}
