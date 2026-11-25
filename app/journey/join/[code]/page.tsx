import type { Metadata } from "next";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Join a walking group · 30 Days on the Mount",
  robots: { index: false, follow: false },
};

/**
 * Where a walking-group invitation link lands. With the app installed,
 * "Open in the app" hands the code over (mount://join/CODE); otherwise the
 * code is there to type in after signing up. The page only reads the group's
 * name — membership is decided in the app.
 */
export default async function JoinPage({ params }: PageProps<"/journey/join/[code]">) {
  const code = (await params).code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
  const { data: group } = await getSupabaseAdmin().from("walking_groups").select("name").eq("invite_code", code).maybeSingle();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <div className="max-w-sm">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-zoe-ink-muted">30 Days on the Mount</p>
        {group ? (
          <>
            <h1 className="mt-6 font-serif text-4xl text-zoe-ink">You&apos;re invited to walk together</h1>
            <p className="mt-4 text-zoe-ink-muted">
              A friend asked you to join <span className="text-zoe-ink">{group.name}</span>: thirty mornings in the Sermon on
              the Mount, side by side.
            </p>
            <a
              href={`mount://join/${code}`}
              className="mt-10 inline-block rounded-full border border-zoe-gold/60 px-8 py-3 font-serif text-lg text-zoe-gold transition-colors hover:bg-zoe-gold/10"
            >
              Open in the app
            </a>
            <p className="mt-8 text-sm text-zoe-ink-muted">
              New here? Get the 30 Days on the Mount app, then in Profile choose &ldquo;Join with an invitation&rdquo; and enter
            </p>
            <p className="mt-2 font-mono text-2xl tracking-[0.25em] text-zoe-ink">{code}</p>
          </>
        ) : (
          <>
            <h1 className="mt-6 font-serif text-4xl text-zoe-ink">This invitation has closed</h1>
            <p className="mt-4 text-zoe-ink-muted">Ask your friend to send a fresh link.</p>
          </>
        )}
      </div>
    </div>
  );
}
