import "server-only";

/** Backfilled onto every pre-existing active user by migration 0005 — used defensively as a fallback here too. */
export const DEFAULT_PREFERRED_HOUR = 7;
export const DEFAULT_TIMEZONE = "America/Los_Angeles";

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
