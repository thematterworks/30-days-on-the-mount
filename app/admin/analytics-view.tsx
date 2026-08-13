"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { adminFetch } from "@/lib/admin-fetch";
import { Users, Clock, TrendingUp, Activity } from "lucide-react";

interface AnalyticsResponse {
  activeParticipants: number;
  active24hCount: number;
  completionRate: number;
  dayDistribution: { day: number; count: number }[];
  deliveryStatus: { sent: number; delivered: number; read: number; failed: number };
  systemStatus: { webhook: string; cron: string; whatsappApi: string };
}

export function AnalyticsView() {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await adminFetch<AnalyticsResponse>("/api/admin/analytics");
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load analytics");
      }
    }
    load();
    const interval = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (!data) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );
  }

  const maxDayCount = Math.max(1, ...data.dayDistribution.map((d) => d.count));
  const totalDelivery =
    data.deliveryStatus.sent + data.deliveryStatus.delivered + data.deliveryStatus.read + data.deliveryStatus.failed;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Executive Analytics</h1>
        <p className="text-sm text-muted-foreground">Health overview of the 30-day practice.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={Users}
          label="Total Active Participants"
          value={data.activeParticipants.toLocaleString()}
        />
        <MetricCard
          icon={Clock}
          label="24-Hour Active Window"
          value={data.active24hCount.toLocaleString()}
          hint="Free-form reply eligible"
        />
        <MetricCard icon={TrendingUp} label="Completion Rate" value={`${data.completionRate}%`} />
        <MetricCard
          icon={Activity}
          label="System Status"
          value={
            data.systemStatus.whatsappApi === "ok" && data.systemStatus.cron === "ok" ? "Healthy" : "Attention"
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Drop-off Distribution — Day 0 to 31</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-40 items-end gap-1">
              {data.dayDistribution.map((d) => (
                <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t bg-primary/70"
                    style={{ height: `${Math.max(4, (d.count / maxDayCount) * 100)}%` }}
                    title={`Day ${d.day}: ${d.count} participants`}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>Day 0</span>
              <span>Day 16</span>
              <span>Day 31</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Delivery Status — Last 7 Days</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <DeliveryRow label="Sent" count={data.deliveryStatus.sent} total={totalDelivery} />
            <DeliveryRow label="Delivered" count={data.deliveryStatus.delivered} total={totalDelivery} />
            <DeliveryRow label="Read" count={data.deliveryStatus.read} total={totalDelivery} />
            <DeliveryRow label="Failed" count={data.deliveryStatus.failed} total={totalDelivery} variant="destructive" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">System Health</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <StatusBadge label="Webhook" status={data.systemStatus.webhook} />
          <StatusBadge label="Cron" status={data.systemStatus.cron} />
          <StatusBadge label="WhatsApp API" status={data.systemStatus.whatsappApi} />
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between p-5">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </CardContent>
    </Card>
  );
}

function DeliveryRow({
  label,
  count,
  total,
  variant,
}: {
  label: string;
  count: number;
  total: number;
  variant?: "destructive";
}) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span>{count}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${variant === "destructive" ? "bg-destructive" : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function StatusBadge({ label, status }: { label: string; status: string }) {
  const ok = status === "ok";
  return (
    <Badge variant={ok ? "secondary" : "destructive"} className="gap-1.5">
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-current"}`} />
      {label}: {status}
    </Badge>
  );
}
