"use client";

import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { adminFetch } from "@/lib/admin-fetch";
import type { CurriculumDayRow } from "@/lib/supabase/types";
import { ImageIcon, Loader2, Trash2, Upload } from "lucide-react";

const VIDEO_EXTENSIONS = [".mp4", ".mov", ".webm", ".m4v", ".ogv"];

function isVideoUrl(url: string): boolean {
  const path = url.split("?")[0].toLowerCase();
  return VIDEO_EXTENSIONS.some((ext) => path.endsWith(ext));
}

export function CurriculumDayDialog({
  day,
  open,
  onOpenChange,
  onSaved,
}: {
  day: CurriculumDayRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (updated: CurriculumDayRow) => void;
}) {
  const [form, setForm] = useState(day);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const result = await adminFetch<{ day: CurriculumDayRow }>(`/api/admin/curriculum/${form.day_number}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: form.title,
          template_name: form.template_name,
          fallback_text: form.fallback_text,
          ai_guidance_prompt: form.ai_guidance_prompt,
        }),
      });
      setForm(result.day);
      onSaved(result.day);
      setStatus("Saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    setError(null);
    setStatus(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch(`/api/admin/curriculum/${form.day_number}/media`, {
        method: "POST",
        body,
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json?.error ?? "Failed to upload media");
      }
      setForm(json.day as CurriculumDayRow);
      onSaved(json.day as CurriculumDayRow);
      setStatus("Media uploaded.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload media");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemoveMedia() {
    setUploading(true);
    setError(null);
    setStatus(null);
    try {
      const result = await adminFetch<{ day: CurriculumDayRow }>(
        `/api/admin/curriculum/${form.day_number}/media`,
        { method: "DELETE" },
      );
      setForm(result.day);
      onSaved(result.day);
      setStatus("Media removed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove media");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Day {form.day_number}</DialogTitle>
          <DialogDescription>Edit this day&apos;s template, teaching, AI guidance, and media.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}

          <div className="space-y-2">
            <Label htmlFor="day-title">Title</Label>
            <Input
              id="day-title"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="day-template">Meta-approved template name</Label>
            <Input
              id="day-template"
              value={form.template_name}
              onChange={(event) => setForm({ ...form, template_name: event.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="day-fallback">Fallback text / teaching</Label>
            <Textarea
              id="day-fallback"
              rows={6}
              value={form.fallback_text}
              onChange={(event) => setForm({ ...form, fallback_text: event.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="day-guidance">AI guidance prompt for this day&apos;s reflections</Label>
            <Textarea
              id="day-guidance"
              rows={4}
              value={form.ai_guidance_prompt}
              onChange={(event) => setForm({ ...form, ai_guidance_prompt: event.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Media (photo or video)</Label>

            {form.media_url ? (
              <div className="space-y-2">
                {isVideoUrl(form.media_url) ? (
                  <video src={form.media_url} controls className="max-h-56 w-full rounded-md border border-border" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded asset from Supabase Storage, not an optimizable local/remote source
                  <img
                    src={form.media_url}
                    alt={`Day ${form.day_number} media`}
                    className="max-h-56 w-full rounded-md border border-border object-cover"
                  />
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={uploading}
                  onClick={handleRemoveMedia}
                  className="gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove media
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                <ImageIcon className="h-4 w-4" />
                No media attached yet.
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={handleFileSelected}
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="gap-1.5"
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {uploading ? "Uploading..." : form.media_url ? "Replace media" : "Upload media"}
            </Button>
            <p className="text-xs text-muted-foreground">Images or video, up to 4MB.</p>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save day"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
