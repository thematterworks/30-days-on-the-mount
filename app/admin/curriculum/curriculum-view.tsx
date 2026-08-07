"use client";

import { useCallback, useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { adminFetch } from "@/lib/admin-fetch";
import type { CurriculumDayRow, SystemConfigRow } from "@/lib/supabase/types";

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
  const [selectedDay, setSelectedDay] = useState(0);
  const [form, setForm] = useState<CurriculumDayRow | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const result = await adminFetch<{ days: CurriculumDayRow[] }>("/api/admin/curriculum");
    setDays(result.days);
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  useEffect(() => {
    (() => {
      const day = days.find((d) => d.day_number === selectedDay);
      setForm(day ?? null);
    })();
  }, [days, selectedDay]);

  async function handleSave() {
    if (!form) return;
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      await adminFetch(`/api/admin/curriculum/${form.day_number}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: form.title,
          template_name: form.template_name,
          fallback_text: form.fallback_text,
          ai_guidance_prompt: form.ai_guidance_prompt,
        }),
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Day-by-day editor</CardTitle>
        <CardDescription>Choose a day, then edit its template, fallback text, and AI guidance.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-w-xs">
          <Label>Day</Label>
          <Select value={String(selectedDay)} onValueChange={(v) => setSelectedDay(Number(v))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {Array.from({ length: 31 }, (_, day) => (
                <SelectItem key={day} value={String(day)}>
                  Day {day}
                  {days.find((d) => d.day_number === day)?.title
                    ? ` — ${days.find((d) => d.day_number === day)?.title}`
                    : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {form ? (
          <div className="space-y-4">
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}

            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="template">Meta template name</Label>
              <Input
                id="template"
                value={form.template_name}
                onChange={(event) => setForm({ ...form, template_name: event.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fallback">Fallback text (full rich-text prompt)</Label>
              <Textarea
                id="fallback"
                rows={5}
                value={form.fallback_text}
                onChange={(event) => setForm({ ...form, fallback_text: event.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="guidance">AI guidance prompt for this day</Label>
              <Textarea
                id="guidance"
                rows={4}
                value={form.ai_guidance_prompt}
                onChange={(event) => setForm({ ...form, ai_guidance_prompt: event.target.value })}
              />
            </div>

            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save day"}
            </Button>
          </div>
        ) : null}
      </CardContent>
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
