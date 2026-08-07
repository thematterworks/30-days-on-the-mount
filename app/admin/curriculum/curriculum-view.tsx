"use client";

import { useCallback, useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { adminFetch } from "@/lib/admin-fetch";
import type { CurriculumDayRow, SystemConfigRow } from "@/lib/supabase/types";
import { ImageIcon } from "lucide-react";
import { CurriculumDayDialog } from "./curriculum-day-dialog";

export function CurriculumView() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Curriculum &amp; AI Persona Tuner</h1>
        <p className="text-sm text-muted-foreground">
          Edit the 31-day curriculum and calibrate how the AI meets participants.
        </p>
      </div>

      <Tabs defaultValue="curriculum">
        <TabsList>
          <TabsTrigger value="curriculum">Curriculum</TabsTrigger>
          <TabsTrigger value="persona">AI Persona Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="curriculum" className="mt-4">
          <CurriculumEditor />
        </TabsContent>
        <TabsContent value="persona" className="mt-4">
          <PersonaEditor />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CurriculumEditor() {
  const [days, setDays] = useState<CurriculumDayRow[]>([]);
  const [activeDayNumber, setActiveDayNumber] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await adminFetch<{ days: CurriculumDayRow[] }>("/api/admin/curriculum");
      setDays(result.days);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load curriculum");
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const activeDay = days.find((d) => d.day_number === activeDayNumber) ?? null;

  function handleSaved(updated: CurriculumDayRow) {
    setDays((prev) => prev.map((d) => (d.day_number === updated.day_number ? updated : d)));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Day-by-day editor</CardTitle>
        <CardDescription>Click a day to edit its template, teaching, AI guidance, and media.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loadError ? (
          <Alert variant="destructive">
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
          {Array.from({ length: 31 }, (_, dayNumber) => dayNumber).map((dayNumber) => {
            const dayData = days.find((d) => d.day_number === dayNumber);
            const populated = Boolean(dayData?.fallback_text.trim());
            return (
              <button
                key={dayNumber}
                type="button"
                onClick={() => setActiveDayNumber(dayNumber)}
                className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-card p-3 text-center transition-colors hover:border-primary/50 hover:bg-accent"
              >
                <span className="text-lg font-semibold tabular-nums">{dayNumber}</span>
                {dayData?.media_url ? <ImageIcon className="h-3 w-3 text-muted-foreground" /> : null}
                <Badge variant={populated ? "default" : "outline"} className="px-1.5 py-0 text-[10px]">
                  {populated ? "Populated" : "Empty"}
                </Badge>
              </button>
            );
          })}
        </div>
      </CardContent>

      {activeDay ? (
        <CurriculumDayDialog
          day={activeDay}
          open={activeDayNumber !== null}
          onOpenChange={(open) => !open && setActiveDayNumber(null)}
          onSaved={handleSaved}
        />
      ) : null}
    </Card>
  );
}

function PersonaEditor() {
  const [config, setConfig] = useState<SystemConfigRow[]>([]);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const result = await adminFetch<{ config: SystemConfigRow[] }>("/api/admin/config");
    setConfig(result.config);
    const prompt = result.config.find((c) => c.key === "ai_persona_system_prompt");
    const autoReply = result.config.find((c) => c.key === "ai_auto_reply_enabled");
    setSystemPrompt(prompt?.value ?? "");
    setAutoReplyEnabled((autoReply?.value ?? "true") === "true");
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  async function save(key: string, value: string) {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      await adminFetch("/api/admin/config", {
        method: "PATCH",
        body: JSON.stringify({ key, value }),
      });
      setStatus("Saved.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Global AI Auto-Reply</CardTitle>
          <CardDescription>
            When disabled, inbound reflections are logged but never receive an automated reply.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Switch
            checked={autoReplyEnabled}
            onCheckedChange={(checked) => {
              setAutoReplyEnabled(checked);
              save("ai_auto_reply_enabled", checked ? "true" : "false");
            }}
            disabled={saving}
          />
          <span className="text-sm">{autoReplyEnabled ? "Enabled" : "Disabled"}</span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Persona Grounding &amp; System Prompt</CardTitle>
          <CardDescription>
            Emphasize active unlearning, stillness, Kenosis (self-emptying), dropping masks, and Zoe life.
            Explicitly forbid gamified or performance-driven &quot;challenge&quot; language.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
          <Textarea
            rows={12}
            value={systemPrompt}
            onChange={(event) => setSystemPrompt(event.target.value)}
            className="font-mono text-xs"
          />
          <Button onClick={() => save("ai_persona_system_prompt", systemPrompt)} disabled={saving}>
            {saving ? "Saving..." : "Save system prompt"}
          </Button>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        {config.length} configuration key{config.length === 1 ? "" : "s"} loaded from system_config.
      </p>
    </div>
  );
}
