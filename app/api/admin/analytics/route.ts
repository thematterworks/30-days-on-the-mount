import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function GET() {
  const supabase = getSupabaseAdmin();
  const now = Date.now();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyHoursAgo = new Date(now - 30 * 60 * 60 * 1000).toISOString();

  const [
    { count: activeCount },
    { count: active24hCount },
    { count: totalCount },
    { count: completedCount },
    { data: dayRows },
    { data: deliveryRows },
    { count: recentInboundCount },
    { count: recentCronOutboundCount },
  ] = await Promise.all([
    supabase.from("users").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .eq("status", "active")
      .gte("last_interaction_at", dayAgo),
    supabase.from("users").select("*", { count: "exact", head: true }),
    supabase.from("users").select("*", { count: "exact", head: true }).eq("status", "completed"),
    supabase.from("users").select("current_day").eq("status", "active"),
    supabase
      .from("message_logs")
      .select("status")
      .eq("direction", "outbound")
      .gte("created_at", sevenDaysAgo),
    supabase
      .from("message_logs")
      .select("*", { count: "exact", head: true })
      .eq("direction", "inbound")
      .gte("created_at", dayAgo),
    supabase
      .from("message_logs")
      .select("*", { count: "exact", head: true })
      .eq("direction", "outbound")
      .eq("message_type", "template")
      .gte("created_at", thirtyHoursAgo),
  ]);

  const dayDistribution = Array.from({ length: 32 }, (_, day) => ({ day, count: 0 }));
  for (const row of dayRows ?? []) {
    if (row.current_day >= 0 && row.current_day <= 31) {
      dayDistribution[row.current_day].count += 1;
    }
  }

  const deliveryStatus = { sent: 0, delivered: 0, read: 0, failed: 0 };
  for (const row of deliveryRows ?? []) {
    deliveryStatus[row.status] += 1;
  }

  const completionRate = totalCount ? Math.round(((completedCount ?? 0) / totalCount) * 1000) / 10 : 0;

  const totalOutbound7d = deliveryRows?.length ?? 0;
  const failureRate7d = totalOutbound7d ? deliveryStatus.failed / totalOutbound7d : 0;

  return NextResponse.json({
    activeParticipants: activeCount ?? 0,
    active24hCount: active24hCount ?? 0,
    completionRate,
    dayDistribution,
    deliveryStatus,
    systemStatus: {
      webhook: (recentInboundCount ?? 0) > 0 ? "ok" : "no-recent-activity",
      cron: (recentCronOutboundCount ?? 0) > 0 ? "ok" : "stale",
      whatsappApi: failureRate7d > 0.5 ? "degraded" : "ok",
    },
  });
}
