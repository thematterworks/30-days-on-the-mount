import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isApnsConfigured, sendAppNotification } from "@/lib/apns";
import { env } from "@/lib/env";

/**
 * Sends one test notification to a participant's devices (?to=<account key>)
 * — for checking push end to end. Behind the cron password; never scheduled.
 */
export async function GET(request: NextRequest) {
  if (request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const to = request.nextUrl.searchParams.get("to");
  if (!to) return NextResponse.json({ error: "to is required" }, { status: 400 });
  const delivered = await sendAppNotification(to, {
    title: "The mountain is calling",
    body: "Notifications are working again. Your next invitation arrives at its usual time.",
    link: "mount://companion",
    collapseId: "test-push",
  });
  return NextResponse.json({ configured: isApnsConfigured(), delivered });
}
