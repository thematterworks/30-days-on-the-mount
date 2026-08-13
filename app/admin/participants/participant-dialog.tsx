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
import { Badge } from "@/components/ui/badge";
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
  const [firstName, setFirstName] = useState(user.first_name ?? "");
  const [preferredHour, setPreferredHour] = useState(
    user.preferred_delivery_hour === null ? "" : String(user.preferred_delivery_hour),
  );
  const [emailAddress, setEmailAddress] = useState(user.email_address ?? "");
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
            <Label htmlFor="current-day">Current day (0-31)</Label>
            <div className="flex gap-2">
              <Input
                id="current-day"
                type="number"
                min={0}
                max={31}
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
                    // waiting-room sentinel) — activating them from here
                    // bypasses the conversational onboarding flow entirely,
                    // so also set current_day to 0 and onboarding_step to
                    // 'completed' directly, or they'd end up 'active' with
                    // no valid day and a stale onboarding state. A 'paused'
                    // participant keeps their existing current_day and just
                    // continues.
                    patch(
                      user.status === "pending"
                        ? { status: "active", current_day: 0, onboarding_step: "completed" }
                        : { status: "active" },
                    ),
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

          <div className="space-y-3 rounded-md border border-border p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Onboarding &amp; Preferences
            </p>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Onboarding step:</span>
              <Badge variant="outline">{user.onboarding_step}</Badge>
              <span className="text-muted-foreground">Timezone:</span>
              <Badge variant="outline">{user.timezone}</Badge>
              <span className="text-muted-foreground">Wants email:</span>
              <Badge variant={user.wants_email ? "default" : "outline"}>{user.wants_email ? "Yes" : "No"}</Badge>
            </div>

            <div className="space-y-2">
              <Label htmlFor="first-name">First name</Label>
              <div className="flex gap-2">
                <Input id="first-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => run(() => patch({ first_name: firstName.trim() || null }))}
                >
                  Save
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="preferred-hour">Preferred delivery hour (0-23, local)</Label>
              <div className="flex gap-2">
                <Input
                  id="preferred-hour"
                  type="number"
                  min={0}
                  max={23}
                  value={preferredHour}
                  onChange={(event) => setPreferredHour(event.target.value)}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      patch({
                        preferred_delivery_hour: preferredHour.trim() === "" ? null : Number(preferredHour),
                      }),
                    )
                  }
                >
                  Save
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email-address">Email address</Label>
              <div className="flex gap-2">
                <Input
                  id="email-address"
                  type="email"
                  value={emailAddress}
                  onChange={(event) => setEmailAddress(event.target.value)}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => run(() => patch({ email_address: emailAddress.trim() || null }))}
                >
                  Save
                </Button>
              </div>
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
