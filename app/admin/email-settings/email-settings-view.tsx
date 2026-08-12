"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { adminFetch } from "@/lib/admin-fetch";
import { buildCurriculumEmailHtml, type EmailTheme } from "@/lib/email-template";

const SAMPLE_TITLE = "Day 7 — The Weight of Enough";
const SAMPLE_TEXT =
  "Today's invitation is simple: notice where you are performing instead of resting.\n" +
  "Sit with that discomfort for sixty seconds before you reach for your phone.\n" +
  "This is not a task to complete. It is a door to walk through.";

/** Pulls the two #RRGGBB stops out of a `linear-gradient(...)` string for the color pickers. */
function extractGradientColors(gradient: string): [string, string] {
  const matches = gradient.match(/#[0-9a-fA-F]{6}/g) ?? [];
  return [matches[0] ?? "#4A4E7E", matches[1] ?? "#313554"];
}

function buildGradient(start: string, end: string): string {
  return `linear-gradient(135deg, ${start} 0%, ${end} 100%)`;
}

export function EmailSettingsView() {
  const [theme, setTheme] = useState<EmailTheme | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await adminFetch<{ theme: EmailTheme }>("/api/admin/email-theme");
      setTheme(result.theme);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load email theme");
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  function update<K extends keyof EmailTheme>(key: K, value: EmailTheme[K]) {
    setTheme((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handleSave() {
    if (!theme) return;
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const result = await adminFetch<{ theme: EmailTheme }>("/api/admin/email-theme", {
        method: "PATCH",
        body: JSON.stringify(theme),
      });
      setTheme(result.theme);
      setStatus("Saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Email Design</h1>
        <p className="text-sm text-muted-foreground">
          Tune the visual identity of the daily curriculum email. The preview updates instantly; nothing changes for
          real participants until you save.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}

      {!theme ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <ThemeEditor theme={theme} onChange={update} onSave={handleSave} saving={saving} />
      )}
    </div>
  );
}

function ThemeEditor({
  theme,
  onChange,
  onSave,
  saving,
}: {
  theme: EmailTheme;
  onChange: <K extends keyof EmailTheme>(key: K, value: EmailTheme[K]) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const [gradientStart, gradientEnd] = extractGradientColors(theme.background_gradient);
  const previewHtml = buildCurriculumEmailHtml(theme, SAMPLE_TITLE, SAMPLE_TEXT);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Colors</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ColorField
              label="Background gradient — start"
              value={gradientStart}
              onChange={(value) => onChange("background_gradient", buildGradient(value, gradientEnd))}
            />
            <ColorField
              label="Background gradient — end"
              value={gradientEnd}
              onChange={(value) => onChange("background_gradient", buildGradient(gradientStart, value))}
            />
            <ColorField
              label="Primary accent (title)"
              value={theme.primary_accent_color}
              onChange={(value) => onChange("primary_accent_color", value)}
            />
            <ColorField
              label="Secondary accent (subtext / footer)"
              value={theme.secondary_accent_color}
              onChange={(value) => onChange("secondary_accent_color", value)}
            />
            <ColorField
              label="Body text"
              value={theme.body_text_color}
              onChange={(value) => onChange("body_text_color", value)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Typography</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="main-font">Main font family (title &amp; body)</Label>
              <Input
                id="main-font"
                value={theme.main_font_family}
                onChange={(event) => onChange("main_font_family", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="alt-font">Alt font family (caps subtext)</Label>
              <Input
                id="alt-font"
                value={theme.alt_font_family}
                onChange={(event) => onChange("alt_font_family", event.target.value)}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="title-size">Title size</Label>
                <Input
                  id="title-size"
                  value={theme.title_font_size}
                  onChange={(event) => onChange("title_font_size", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subtext-size">Subtext size</Label>
                <Input
                  id="subtext-size"
                  value={theme.subtext_font_size}
                  onChange={(event) => onChange("subtext_font_size", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="body-size">Body size</Label>
                <Input
                  id="body-size"
                  value={theme.body_font_size}
                  onChange={(event) => onChange("body_font_size", event.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="line-height">Line height</Label>
              <Input
                id="line-height"
                value={theme.line_height}
                onChange={(event) => onChange("line_height", event.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Header Image</CardTitle>
            <CardDescription>Mountain line art shown above the title. Leave blank to omit.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="mountain-url">Header mountain image URL</Label>
            <Input
              id="mountain-url"
              value={theme.header_mountain_image_url}
              onChange={(event) => onChange("header_mountain_image_url", event.target.value)}
              placeholder="https://..."
            />
          </CardContent>
        </Card>

        <Button onClick={onSave} disabled={saving}>
          {saving ? "Saving..." : "Save theme"}
        </Button>
      </div>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base">Live Preview</CardTitle>
            <CardDescription>
              Sample content shown here — the real email uses that day&apos;s actual curriculum title and text.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <iframe title="Email preview" srcDoc={previewHtml} sandbox="" className="h-[720px] w-full border-0 bg-white" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 w-12 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-1"
        />
        <Input value={value} onChange={(event) => onChange(event.target.value)} className="font-mono text-xs" />
      </div>
    </div>
  );
}
