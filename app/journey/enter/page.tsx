import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  PARTICIPANT_SESSION_COOKIE,
  PARTICIPANT_SESSION_MAX_AGE_SECONDS,
  createParticipantSessionToken,
  parseJourneyDay,
  peekMagicLinkValid,
  verifyMagicLink,
} from "@/lib/participant-auth";

export const metadata: Metadata = {
  title: "30 Days on the Mount",
  robots: { index: false, follow: false },
};

/**
 * Pre-fetch-safe magic-link exchange.
 *
 * The bug: consuming a single-use token in a GET meant iMessage/Safari's
 * background link-unfurl burned the token before the participant ever saw
 * the page. The fix: this GET is read-only — it only *peeks* at the token
 * (safe under prefetch) and renders a button. The token is consumed and the
 * session cookie set only by the server action below, which runs on an
 * explicit POST (a physical tap). Unfurl bots issue GETs, never POSTs, so
 * they can no longer trip the door.
 */
export default async function EnterPage({ searchParams }: PageProps<"/journey/enter">) {
  const params = await searchParams;
  const raw = params.t;
  const token = typeof raw === "string" ? raw : "";

  const valid = await peekMagicLinkValid(token);
  if (!valid) {
    redirect("/journey/expired");
  }

  // Destination day from the link, if it carried one. Parsed here only to
  // render it into the form; the server action re-parses what it receives.
  const destinationDay = parseJourneyDay(typeof params.d === "string" ? params.d : undefined);

  async function enter(formData: FormData) {
    "use server";
    const submittedToken = String(formData.get("t") ?? "");
    const phoneNumber = await verifyMagicLink(submittedToken);
    if (!phoneNumber) {
      redirect("/journey/expired");
    }

    const sessionToken = await createParticipantSessionToken(phoneNumber);
    const cookieStore = await cookies();
    cookieStore.set(PARTICIPANT_SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: PARTICIPANT_SESSION_MAX_AGE_SECONDS,
    });

    // Re-parsed rather than trusted: the hidden field is client-supplied, so
    // this runs the same validation again and builds the path from an integer
    // we produced. An unparseable or absent day falls back to the journey
    // index. The day page independently gates the day against the
    // participant's own current_day, so a tampered `d` cannot open a day they
    // have not reached — it just bounces them back to /journey.
    const day = parseJourneyDay(String(formData.get("d") ?? ""));
    redirect(day === null ? "/journey" : `/journey/day/${day}`);
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <div className="max-w-sm">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-zoe-ink-muted">30 Days on the Mount</p>
        <h1 className="mt-6 font-serif text-4xl text-zoe-ink">The Secret Room awaits</h1>
        <p className="mt-4 text-zoe-ink-muted">Tap below to cross the threshold into today.</p>

        <form action={enter} className="mt-10">
          <input type="hidden" name="t" value={token} />
          {destinationDay !== null && <input type="hidden" name="d" value={destinationDay} />}
          <button
            type="submit"
            className="rounded-full border border-zoe-gold/60 px-8 py-3 font-serif text-lg text-zoe-gold transition-colors hover:bg-zoe-gold/10"
          >
            Enter
          </button>
        </form>
      </div>
    </div>
  );
}
