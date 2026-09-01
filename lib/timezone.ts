import "server-only";

/**
 * Fallback delivery hour for any participant whose preferred_delivery_hour is
 * null. That is now the common case, not the exception: the frictionless
 * MOUNTAIN/START opt-in activates people immediately and never asks for a
 * time, so this constant — not a stored per-user value — is what actually
 * sets delivery time for most participants. Migration 0014 aligns the rows
 * that migration 0005 backfilled to 7 with this value.
 */
export const DEFAULT_PREFERRED_HOUR = 8;
export const DEFAULT_TIMEZONE = "America/Los_Angeles";

/**
 * Local calendar date as YYYY-MM-DD in an IANA timezone, or null if the
 * timezone string is invalid. en-CA is used because it formats as ISO
 * YYYY-MM-DD, which is both what Postgres `date` columns compare against and
 * lexicographically sortable.
 */
export function getLocalDate(timezone: string, at: Date): string | null {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(at);
  } catch {
    return null;
  }
}

/** Current local hour (0-23) in an IANA timezone, or null if the timezone string is invalid. */
export function getLocalHour(timezone: string, at: Date): number | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    }).formatToParts(at);

    const hourPart = parts.find((part) => part.type === "hour")?.value;
    if (!hourPart) return null;

    const hour = Number(hourPart);
    if (Number.isNaN(hour)) return null;

    // Some ICU implementations report midnight as "24" under hour12: false.
    return hour === 24 ? 0 : hour;
  } catch {
    return null;
  }
}

export interface DailyPushDecision {
  /** True if this participant should receive a curriculum push on this run. */
  due: boolean;
  /** The participant's local calendar date, to stamp onto last_push_on after a successful send. */
  localDate: string | null;
  /** Why the participant was skipped, for the cron's response counters. */
  reason: "due" | "bad-timezone" | "too-early" | "already-sent-today" | "missing-guard-column";
}

/**
 * Decides whether the daily curriculum push is due for one participant.
 *
 * Two properties matter here, and they are why this is a separate pure
 * function rather than an inline condition:
 *
 *  1. Idempotency. At most one push per participant per *their* local day,
 *     however many times the cron runs. daily-push advances current_day on
 *     every send, so a duplicate does not just resend — it delivers the next
 *     day's content early and permanently skips a day.
 *  2. Self-healing. Eligibility is "at or after their hour", not "exactly at
 *     it", so a scheduler run that is late or dropped delays delivery instead
 *     of losing the day. Safe only because of property 1.
 */
export function decideDailyPush(input: {
  now: Date;
  timezone: string | null;
  preferredHour: number | null;
  /**
   * `null` means never pushed. `undefined` means the column is absent from the
   * row entirely — i.e. migration 0015 has not been applied to this database.
   * PostgREST omits keys for columns that do not exist, which is what makes
   * those two cases distinguishable, and they must not be conflated: see the
   * fail-closed branch below.
   */
  lastPushOn: string | null | undefined;
}): DailyPushDecision {
  const timezone = input.timezone || DEFAULT_TIMEZONE;
  const localHour = getLocalHour(timezone, input.now);
  const localDate = getLocalDate(timezone, input.now);
  const preferredHour = input.preferredHour ?? DEFAULT_PREFERRED_HOUR;

  if (localHour === null || localDate === null) {
    return { due: false, localDate: null, reason: "bad-timezone" };
  }

  // Fail closed when the guard column is missing. Treating an absent
  // last_push_on as "never pushed" would make every participant past their
  // hour eligible on every run, and the write that would have recorded the
  // send fails too — so the cron would re-push them every hour, all day.
  // Sending nothing until migration 0015 is applied is the safe failure.
  if (input.lastPushOn === undefined) {
    return { due: false, localDate, reason: "missing-guard-column" };
  }
  if (localHour < preferredHour) {
    return { due: false, localDate, reason: "too-early" };
  }
  if (input.lastPushOn === localDate) {
    return { due: false, localDate, reason: "already-sent-today" };
  }
  return { due: true, localDate, reason: "due" };
}
