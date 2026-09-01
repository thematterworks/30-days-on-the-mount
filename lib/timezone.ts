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
