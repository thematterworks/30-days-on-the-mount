"use client";

import { useCallback, useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { adminFetch } from "@/lib/admin-fetch";
import type { CurriculumDayRow, SystemConfigRow } from "@/lib/supabase/types";
import { ImageIcon, Loader2 } from "lucide-react";
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
  const [testMessage, setTestMessage] = useState("");
  const [testReply, setTestReply] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [eveningTemplateName, setEveningTemplateName] = useState("");
  const [eveningSystemPrompt, setEveningSystemPrompt] = useState("");

  const load = useCallback(async () => {
    const result = await adminFetch<{ config: SystemConfigRow[] }>("/api/admin/config");
    setConfig(result.config);
    const prompt = result.config.find((c) => c.key === "ai_persona_system_prompt");
    const autoReply = result.config.find((c) => c.key === "ai_auto_reply_enabled");
    const eveningTemplate = result.config.find((c) => c.key === "evening_checkin_template_name");
    const eveningPrompt = result.config.find((c) => c.key === "evening_reflection_system_prompt");
    setSystemPrompt(prompt?.value ?? "");
    setAutoReplyEnabled((autoReply?.value ?? "true") === "true");
    setEveningTemplateName(eveningTemplate?.value ?? "");
    setEveningSystemPrompt(eveningPrompt?.value ?? "");
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

  async function runTest() {
    setTesting(true);
    setTestError(null);
    setTestReply(null);
    try {
      const result = await adminFetch<{ reply: string }>("/api/admin/config/test-ai", {
        method: "POST",
        body: JSON.stringify({ message: testMessage }),
      });
      setTestReply(result.reply);
    } catch (err) {
      setTestError(err instanceof Error ? err.message : "AI Engine test failed");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Test AI Engine</CardTitle>
          <CardDescription>
            Send a one-off message through the AI engine to confirm AI_API_KEY is configured correctly, without
            waiting for a real WhatsApp reflection.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {testError ? (
            <Alert variant="destructive">
              <AlertDescription>{testError}</AlertDescription>
            </Alert>
          ) : null}
          {testReply ? (
            <div className="rounded-md border border-border bg-muted/50 p-3 text-sm">
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                AI reply
              </p>
              <p className="whitespace-pre-wrap">{testReply}</p>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="test-message">Test message</Label>
            <Input
              id="test-message"
              placeholder="This is a test message from the admin dashboard..."
              value={testMessage}
              onChange={(event) => setTestMessage(event.target.value)}
            />
          </div>
          <Button onClick={runTest} disabled={testing} className="gap-1.5" variant="secondary">
            {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {testing ? "Sending..." : "Send test message"}
          </Button>
        </CardContent>
      </Card>

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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evening Check-In</CardTitle>
          <CardDescription>
            A second daily touchpoint inviting participants to reflect on the day&apos;s practice and any friction —
            no checklist or grade, just awareness, surrender, and grace. Replies are detected by whichever template
            was sent to the participant most recently, so this only applies until the next morning&apos;s send.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="evening-template">Meta-approved template name</Label>
            <Input
              id="evening-template"
              value={eveningTemplateName}
              onChange={(event) => setEveningTemplateName(event.target.value)}
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={saving}
              onClick={() => save("evening_checkin_template_name", eveningTemplateName)}
            >
              Save template name
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="evening-prompt">Evening reflection persona</Label>
            <Textarea
              id="evening-prompt"
              rows={10}
              value={eveningSystemPrompt}
              onChange={(event) => setEveningSystemPrompt(event.target.value)}
              className="font-mono text-xs"
            />
            <Button
              size="sm"
              disabled={saving}
              onClick={() => save("evening_reflection_system_prompt", eveningSystemPrompt)}
            >
              Save evening persona
            </Button>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        {config.length} configuration key{config.length === 1 ? "" : "s"} loaded from system_config.
      </p>
    </div>
  );
}
