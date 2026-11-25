import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminPeople } from "@/lib/admin-community";
import { revokeStrike, setStanding } from "@/lib/standing";

/** People with strikes or a standing other than active. */
export async function GET() {
  return NextResponse.json({ people: await adminPeople() });
}

/**
 * An admin's action on a person: warn, pause (7 days), remove from
 * Community, suspend the account, restore — or revoke one strike.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    phone?: string;
    action?: "warn" | "pause" | "remove" | "suspend" | "restore" | "revoke";
    strikeId?: string;
    note?: string;
  } | null;
  if (body?.action === "revoke") {
    if (!body.strikeId) return NextResponse.json({ error: "Which strike?" }, { status: 400 });
    await revokeStrike(body.strikeId);
    return NextResponse.json({ ok: true });
  }
  if (!body?.phone || !body.action || !["warn", "pause", "remove", "suspend", "restore"].includes(body.action)) {
    return NextResponse.json({ error: "Choose a person and an action." }, { status: 400 });
  }
  await setStanding(body.phone, body.action as "warn" | "pause" | "remove" | "suspend" | "restore", { note: body.note });
  return NextResponse.json({ ok: true });
}
