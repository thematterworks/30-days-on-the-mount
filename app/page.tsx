import type { Metadata } from "next";
import { MountainMark, SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { SitePage } from "@/components/site/SitePage";
import { Reveal } from "@/components/site/Reveal";
import { bareDayTitle } from "@/lib/messaging";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "30 Days on the Mount — Thirty days in the words of Jesus",
  description:
    "A thirty-day journey through the Sermon on the Mount for the curious, the doubting and the devoted: one passage each morning, a companion for the questions, and others to walk it with.",
  openGraph: {
    title: "30 Days on the Mount",
    description: "Thirty days in the words of Jesus. For the curious, the doubting, and the devoted.",
  },
};

// The day titles change rarely; an hour is fresh enough.
export const revalidate = 3600;

const SMS_NUMBER = "+13237477471";
const SMS_DISPLAY = "+1 (323) 747-7471";

async function dayTitles(): Promise<string[]> {
  const { data } = await getSupabaseAdmin()
    .from("curriculum_days")
    .select("day_number, title")
    .gte("day_number", 1)
    .lte("day_number", 30)
    .order("day_number");
  return (data ?? []).map((day) => bareDayTitle(day.title));
}

/**
 * 30daysonthemount.com: the journey's front door, in the app's world. It
 * welcomes believers and seekers alike, says plainly what the journey is
 * and how it works, and why living these words matters — then the two ways
 * to begin. The text-message opt-in and its full disclosure live in
 * "Begin": this page is a registered consent surface for the SMS program,
 * so that wording must stay intact (see the business-identity note).
 */
export default async function LandingPage() {
  const titles = await dayTitles();
  const appStoreURL = process.env.NEXT_PUBLIC_APP_STORE_URL || null;

  return (
    <SitePage>
      <div className="relative overflow-x-clip">
        <div className="site-light" aria-hidden />
        <SiteHeader />

        {/* The hillside */}
        <section className="relative z-10 mx-auto flex min-h-[88svh] max-w-4xl flex-col items-center justify-center px-6 pb-24 pt-10 text-center">
          <MountainMark width={260} className="site-mountain-draw" />
          <p className="site-eyebrow site-rise mt-12" style={{ animationDelay: "0.9s" }}>
            Matthew 5–7 · Thirty mornings
          </p>
          <h1 className="site-display site-rise mt-6 text-[3.2rem] leading-[1.02] sm:text-7xl" style={{ animationDelay: "1.1s" }}>
            Journey on the Mountain
          </h1>
          <p className="site-serif site-rise mx-auto mt-7 max-w-xl text-xl leading-relaxed text-white/85 sm:text-[1.4rem]" style={{ animationDelay: "1.35s" }}>
            Thirty days in the words of Jesus, for the curious, the doubting, the devoted, and everyone in between.
          </p>
          <div className="site-rise mt-11 flex flex-col items-center gap-3 sm:flex-row" style={{ animationDelay: "1.6s" }}>
            <a href="#begin" className="site-button site-button-primary">Begin the journey</a>
            <a href="#how" className="site-button site-button-quiet">How it works</a>
          </div>
        </section>

        {/* The scene */}
        <section className="relative z-10 mx-auto max-w-3xl px-6 py-24 text-center">
          <Reveal>
            <p className="site-eyebrow">Galilee, about AD 30</p>
          </Reveal>
          <Reveal delay={120}>
            <blockquote className="site-display mt-8 text-[2rem] leading-snug sm:text-[2.6rem]">
              &ldquo;When Jesus saw the crowds, He went up on the mountain and sat down. His disciples came to Him, and He
              began to teach them.&rdquo;
            </blockquote>
          </Reveal>
          <Reveal delay={240}>
            <p className="site-serif mx-auto mt-8 max-w-xl text-lg leading-relaxed text-white/80">
              What He said on that hillside has unsettled and remade people for two thousand years. Gandhi carried it.
              Tolstoy was undone by it. Ordinary people have built whole lives on it. It may be the most admired teaching
              ever given.
            </p>
          </Reveal>
        </section>

        {/* The gap */}
        <section id="why" className="relative z-10 mx-auto max-w-5xl scroll-mt-10 px-6 py-24">
          <div className="grid items-center gap-14 md:grid-cols-2">
            <Reveal>
              <div className="site-serif space-y-3 text-[1.7rem] italic leading-snug text-white/90 sm:text-3xl">
                <p>Blessed are the poor in spirit.</p>
                <p>Love your enemies.</p>
                <p>Do not worry about tomorrow.</p>
                <p>Seek first the kingdom.</p>
              </div>
            </Reveal>
            <Reveal delay={150}>
              <p className="site-eyebrow">The gap</p>
              <h2 className="site-display mt-5 text-4xl leading-tight sm:text-5xl">Most of us admire these words. Few of us live them.</h2>
              <p className="site-serif mt-6 text-lg leading-relaxed text-white/80">
                Jesus didn&apos;t end His sermon with &ldquo;think about this.&rdquo; He ended it with a house built on rock:
                everyone who hears these words and acts on them. 30 Days on the Mount is a month of acting on them. Not a
                course to finish, but a way to walk: one passage, one honest question, one small practice at a time.
              </p>
            </Reveal>
          </div>
        </section>

        {/* For everyone */}
        <section className="relative z-10 mx-auto max-w-5xl px-6 py-24">
          <Reveal>
            <p className="site-eyebrow text-center">Wherever you are starting from</p>
            <h2 className="site-display mx-auto mt-5 max-w-3xl text-center text-4xl leading-tight sm:text-5xl">
              You don&apos;t need to know the Bible, believe anything yet, or have it together.
            </h2>
          </Reveal>
          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {[
              ["If you're curious", "Meet Jesus in His own words, without a sermon in between. Bring your questions; they're welcome here."],
              ["If you're returning", "Come back to the center. Thirty quiet mornings to remember why these words first moved you."],
              ["If you've walked with Him for years", "Read slowly what you know too well, and practice what you've only admired. It's still the narrow way."],
            ].map(([title, text], index) => (
              <Reveal key={title} delay={index * 120}>
                <div className="h-full rounded-[28px] border border-white/15 bg-white/[0.06] p-8 backdrop-blur-sm">
                  <h3 className="site-display text-2xl">{title}</h3>
                  <p className="site-serif mt-4 leading-relaxed text-white/80">{text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="relative z-10 mx-auto max-w-6xl scroll-mt-10 px-6 py-24">
          <div className="grid items-center gap-16 lg:grid-cols-[1fr_auto]">
            <div>
              <Reveal>
                <p className="site-eyebrow">How it works</p>
                <h2 className="site-display mt-5 text-4xl leading-tight sm:text-5xl">Each day, three quiet moments</h2>
                <p className="site-serif mt-5 max-w-xl text-lg leading-relaxed text-white/80">
                  About ten minutes in the morning, and two small invitations to carry it through your day.
                </p>
              </Reveal>
              <dl className="mt-12 space-y-0">
                {[
                  ["Morning", "The day's passage, opened like a story: a hook, the words of Jesus, what they meant on that hillside, and one honest question to take with you."],
                  ["Midday", "Going deeper: the original words, the world they were spoken into, and what they're asking of you right now."],
                  ["Evening", "A moment to look back: where did today's words meet your life? Write it, say it, or simply notice."],
                ].map(([time, text], index) => (
                  <Reveal key={time} delay={index * 120}>
                    <div className="flex flex-col gap-2 border-t border-white/15 py-7 sm:flex-row sm:gap-8">
                      <dt className="w-24 shrink-0 pt-1 text-[11px] font-medium uppercase tracking-[0.28em] text-[var(--site-peach)]">{time}</dt>
                      <dd className="site-serif text-lg leading-relaxed text-white/88">{text}</dd>
                    </div>
                  </Reveal>
                ))}
              </dl>
              <Reveal>
                <p className="site-serif mt-6 max-w-xl leading-relaxed text-white/70">
                  Along the way: a companion to talk anything through, by voice or in writing; the whole Bible, with a study of
                  any verse; quiet music for the reading; and a Focus mode that keeps the rest of your phone at bay.
                </p>
              </Reveal>
            </div>
            <Reveal delay={200} className="mx-auto">
              <Phone />
            </Reveal>
          </div>
        </section>

        {/* The thirty days */}
        <section className="relative z-10 mx-auto max-w-6xl px-6 py-24">
          <Reveal>
            <p className="site-eyebrow text-center">The path</p>
            <h2 className="site-display mx-auto mt-5 max-w-3xl text-center text-4xl leading-tight sm:text-5xl">
              Thirty days, from the Beatitudes to the house on the rock
            </h2>
          </Reveal>
          <Reveal delay={150}>
            <ol className="mx-auto mt-16 flex max-w-4xl items-center justify-between">
              {titles.map((title, index) => (
                <li key={index} className="site-day flex flex-1 justify-center" tabIndex={0} aria-label={`Day ${index + 1}: ${title}`}>
                  <span className="site-day-dot block h-1.5 w-1.5 rounded-full bg-white/55 sm:h-2.5 sm:w-2.5" />
                  <span className="site-day-label rounded-xl bg-[var(--site-navy)]/80 px-3 py-1.5 text-xs text-white backdrop-blur">
                    <span className="text-[var(--site-peach)]">Day {index + 1}</span> · {title}
                  </span>
                </li>
              ))}
            </ol>
          </Reveal>
          <div className="mx-auto mt-14 grid max-w-4xl gap-x-10 gap-y-3 text-center sm:grid-cols-3">
            {[
              ["Days 1–7", "Who is blessed", "The upside-down blessings: the poor in spirit, the mourners, the meek, the peacemakers."],
              ["Days 8–21", "A deeper righteousness", "Anger, desire, honesty, enemies, prayer, money and worry, brought into the light."],
              ["Days 22–30", "The narrow way", "Judgment, asking, the golden rule, and the house built on the rock."],
            ].map(([days, title, text], index) => (
              <Reveal key={days} delay={index * 120}>
                <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[var(--site-peach)]">{days}</p>
                <h3 className="site-display mt-3 text-2xl">{title}</h3>
                <p className="site-serif mt-3 leading-relaxed text-white/75">{text}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Together */}
        <section className="relative z-10 mx-auto max-w-5xl px-6 py-24">
          <div className="grid items-center gap-14 md:grid-cols-[1.1fr_1fr]">
            <Reveal>
              <p className="site-eyebrow">Together</p>
              <h2 className="site-display mt-5 text-4xl leading-tight sm:text-5xl">No one climbs alone</h2>
              <p className="site-serif mt-6 text-lg leading-relaxed text-white/80">
                Jesus taught this to a crowd, and lived it with friends. Walk the thirty days with a few people you love, or be
                matched with a small group who began when you did. Share what each day stirs up, pray for one another, and see
                what others walking the same day are carrying. Everything shared is read with care, so it stays a safe place
                to be honest.
              </p>
            </Reveal>
            <Reveal delay={150}>
              <p className="mb-3 text-center text-[11px] uppercase tracking-[0.28em] text-white/45">What a walking group looks like</p>
              <div className="space-y-3">
                {[
                  ["Grace", "Day 13", "Love your enemies. I've been praying for my brother-in-law all week. Something is softening, in me first."],
                  ["Marcus", "Day 13", "Me too. Hardest one yet. Praying for you."],
                  ["Companion", "", "It's been a full week on the mount. What's one word Jesus said that you can't stop thinking about?"],
                ].map(([name, day, text]) => (
                  <div
                    key={name}
                    className={`rounded-[22px] px-5 py-4 ${name === "Companion" ? "border border-[var(--site-peach)]/35 text-center italic" : "bg-white/[0.08]"}`}
                  >
                    <p className="text-xs font-semibold text-white/70">
                      {name}
                      {day ? <span className="ml-2 font-normal text-white/45">{day}</span> : null}
                    </p>
                    <p className="site-serif mt-1.5 leading-relaxed text-white/90">{text}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* The kingdom */}
        <section className="relative z-10 mx-auto max-w-3xl px-6 py-28 text-center">
          <Reveal>
            <p className="site-eyebrow">Why it matters</p>
            <h2 className="site-display mt-6 text-4xl leading-tight sm:text-[3.4rem]">On earth as it is in heaven</h2>
          </Reveal>
          <Reveal delay={150}>
            <p className="site-serif mx-auto mt-8 max-w-2xl text-xl leading-relaxed text-white/85">
              The Sermon on the Mount isn&apos;t a list of rules for getting into heaven. It&apos;s Jesus describing what life
              looks like when God&apos;s kingdom breaks into the ordinary: people who forgive before they&apos;re asked, who
              aren&apos;t ruled by worry or money, who make peace, who love the ones who are hard to love.
            </p>
          </Reveal>
          <Reveal delay={300}>
            <p className="site-serif mx-auto mt-6 max-w-2xl text-xl leading-relaxed text-white/85">
              Imagine a few thousand people actually living it for a month: in their homes, at their work, in a divided and
              anxious world. That is the hope of this journey. It starts with one person, one morning, one passage.
            </p>
          </Reveal>
          <Reveal delay={450}>
            <figure className="mx-auto mt-16 max-w-xl">
              <blockquote className="site-display text-2xl leading-snug text-white sm:text-3xl">
                &ldquo;Everyone who hears these words of Mine and acts on them is like a wise man who built his house on the
                rock.&rdquo;
              </blockquote>
              <figcaption className="mt-5 text-[11px] uppercase tracking-[0.3em] text-white/55">Matthew 7:24</figcaption>
            </figure>
          </Reveal>
        </section>

        {/* Begin */}
        <section id="begin" className="relative z-10 mx-auto max-w-3xl scroll-mt-10 px-6 py-24 text-center">
          <Reveal>
            <MountainMark width={120} className="mx-auto opacity-90" />
            <h2 className="site-display mt-10 text-[2.8rem] leading-[1.05] sm:text-6xl">You don&apos;t have to be ready. Only willing to begin.</h2>
            <p className="site-serif mx-auto mt-6 max-w-xl text-lg leading-relaxed text-white/80">
              {appStoreURL
                ? "The journey is free, and it begins today: in the app, or by text message."
                : "The journey is free, and it begins today. Send one word, and your first morning is on its way."}
            </p>
          </Reveal>
          <Reveal delay={150}>
            <div className="mt-11 flex flex-col items-center justify-center gap-3 sm:flex-row">
              {appStoreURL ? (
                <a href={appStoreURL} className="site-button site-button-primary">
                  Get the app
                </a>
              ) : null}
              <a href={`sms:${SMS_NUMBER}&body=START`} className={`site-button ${appStoreURL ? "site-button-quiet" : "site-button-primary"}`}>
                Begin by text: send START
              </a>
            </div>
          </Reveal>
          <Reveal delay={250}>
            <div className="mx-auto mt-12 max-w-xl rounded-[24px] border border-white/15 bg-white/[0.05] p-6 text-left">
              <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-white/60">Join by text message</p>
              <p className="mt-3 text-sm leading-relaxed text-white/80">
                Text <strong>START</strong> or <strong>MOUNTAIN</strong> to{" "}
                <a href={`sms:${SMS_NUMBER}`} className="text-[var(--site-peach)] underline underline-offset-4">
                  {SMS_DISPLAY}
                </a>{" "}
                to opt in. You&apos;ll receive a recurring daily text from 30 Days on the Mount with a short scriptural reflection
                and a link to that day&apos;s guided practice.
              </p>
              <p className="mt-3 text-xs leading-relaxed text-white/60">
                By texting in, you give your express consent to receive recurring automated messages from 30 Days on the
                Mount, operated by The Matterworks LLC. <strong>Consent is not a condition of any purchase.</strong> The program
                is free to join. Message frequency varies. Message and data rates may apply. Reply <strong>HELP</strong> for
                help or <strong>STOP</strong> to cancel at any time. See our{" "}
                <a href="/terms" className="underline underline-offset-4">
                  Terms
                </a>{" "}
                and{" "}
                <a href="/privacy" className="underline underline-offset-4">
                  Privacy Policy
                </a>
                .
              </p>
            </div>
          </Reveal>
        </section>

        <SiteFooter />
      </div>
    </SitePage>
  );
}

/** The app, as a phone shows it: a morning's first card. */
function Phone() {
  return (
    <div className="site-phone">
      <div className="site-phone-screen">
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(60% 40% at 70% 20%, rgb(246 205 175 / 0.35), transparent 70%)" }}
          aria-hidden
        />
        <div className="absolute left-1/2 top-3 h-6 w-24 -translate-x-1/2 rounded-full bg-black/80" />
        <div className="absolute right-3 top-1/2 flex -translate-y-1/2 flex-col gap-1.5" aria-hidden>
          {Array.from({ length: 7 }, (_, index) => (
            <span key={index} className="block w-[3px] rounded-full" style={{ height: index === 0 ? 22 : 5, background: index === 0 ? "#f6cdaf" : "rgb(255 255 255 / 0.3)" }} />
          ))}
        </div>
        <div className="relative flex h-full flex-col items-center justify-center px-7 text-center">
          <p className="text-[9px] font-medium uppercase tracking-[0.3em] text-[var(--site-peach)]">Day 1</p>
          <p className="site-display mt-4 text-[1.9rem] leading-[1.08]">Blessed are the poor in spirit</p>
          <p className="site-serif mt-4 text-[13px] leading-relaxed text-white/80">
            What if the people God calls blessed are the ones who&apos;ve stopped pretending they have it together?
          </p>
          <p className="mt-10 text-[9px] uppercase tracking-[0.3em] text-white/50">Swipe up</p>
        </div>
      </div>
    </div>
  );
}
