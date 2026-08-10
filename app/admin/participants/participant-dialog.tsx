"use client";

import { useState } from "react";
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
import type { UserRow } from "@/lib/supabase/types";

export function ParticipantDialog({
  user,
  open,
  onOpenChange,
  onUpdated,
}: {
  user: UserRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}) {
  const [currentDay, setCurrentDay] = useState(String(user.current_day));
  const [notes, setNotes] = useState(user.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  function patch(body: Record<string, unknown>) {
    return adminFetch(`/api/admin/users/${encodeURIComponent(user.phone_number)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{user.phone_number}</DialogTitle>
          <DialogDescription>Manage this participant&apos;s immersion.</DialogDescription>
        </DialogHeader>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-day">Current day (0-30)</Label>
            <div className="flex gap-2">
              <Input
                id="current-day"
                type="number"
                min={0}
                max={30}
                value={currentDay}
                onChange={(event) => setCurrentDay(event.target.value)}
              />
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => run(() => patch({ current_day: Number(currentDay) }))}
              >
                Set
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Status: {user.status}</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  run(() =>
                    // A 'pending' participant has current_day = -1 (the
                    // waiting-room sentinel) — resuming them must also set
                    // current_day to 0, or they'd end up 'active' with no
                    // valid day, which the cron and webhook can't resolve
                    // against curriculum_days. A 'paused' participant keeps
                    // their existing current_day and just continues.
                    patch(user.status === "pending" ? { status: "active", current_day: 0 } : { status: "active" }),
                  )
                }
              >
                {user.status === "pending" ? "Activate" : "Resume"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => run(() => patch({ status: "paused" }))}
              >
                Pause
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={busy}
                onClick={() => run(() => patch({ status: "opted_out" }))}
              >
                Opt out
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => run(() => patch({ notes }))}
            >
              Save notes
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="default"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await adminFetch(`/api/admin/users/${encodeURIComponent(user.phone_number)}/force-send`, {
                  method: "POST",
                });
              })
            }
          >
            Force-send today&apos;s message
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
