import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function GET() {
  const supabase = getSupabaseAdmin();

  const { data: users, error } = await supabase
    .from("users")
    .select("phone_number, status, current_day, last_interaction_at, ai_paused")
    .order("last_interaction_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const phoneNumbers = (users ?? []).map((u) => u.phone_number);
  const { data: lastMessages } = await supabase
    .from("message_logs")
    .select("phone_number, message_body, direction, created_at")
    .in("phone_number", phoneNumbers.length ? phoneNumbers : ["__none__"])
    .order("created_at", { ascending: false });

  const lastMessageByPhone = new Map<string, { message_body: string; direction: string; created_at: string }>();
  for (const message of lastMessages ?? []) {
    if (!lastMessageByPhone.has(message.phone_number)) {
      lastMessageByPhone.set(message.phone_number, message);
    }
  }

  const conversations = (users ?? []).map((user) => ({
    ...user,
    lastMessage: lastMessageByPhone.get(user.phone_number) ?? null,
  }));

  return NextResponse.json({ conversations });
}
