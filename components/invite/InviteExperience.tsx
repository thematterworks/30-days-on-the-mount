"use client";

import { useEffect, useRef, useState } from "react";

// The invitation, as the app's welcome tour: one scene a screen, snapping as
// you scroll, each arriving softly as it comes into view, the marks on the
// edge keeping your place. Used for a participant's own link (app/i/[code])
// and a walking group's (app/journey/join/[code]).

export type InviteExperienceProps =
  | { kind: "personal"; inviterName: string | null; inviterDay: number | null; appStoreURL: string | null }
  | { kind: "group"; groupName: string; members: string[]; code: string; appStoreURL: string | null };

const SMS_NUMBER = "+13237477471";
const SMS_DISPLAY = "+1 (323) 747-7471";

export function InviteExperience(props: InviteExperienceProps) {
  const scenes = buildScenes(props);
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.index));
        }
      },
      { threshold: 0.6 },
    );
    refs.current.forEach((element) => element && observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="invite-root fixed inset-0 overflow-hidden text-white">
      <div className="invite-atmosphere" aria-hidden />
      <main className="relative h-full snap-y snap-mandatory overflow-y-auto overscroll-contain" style={{ scrollbarWidth: "none" }}>
        {scenes.map((scene, index) => (
          <section
            key={index}
            ref={(element) => {
              refs.current[index] = element;
            }}
            data-index={index}
            data-active={active === index}
            className="invite-scene relative flex h-[100svh] snap-start snap-always flex-col items-center justify-center px-8 text-center"
          >
            <div className="mx-auto w-full max-w-md">{scene}</div>
            {index === 0 ? (
              <div className="invite-cue absolute bottom-10 left-0 right-0 flex flex-col items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-white/60">
                <span>Scroll</span>
                <span className="block h-8 w-px bg-white/40" />
              </div>
            ) : null}
          </section>
        ))}
      </main>
      <nav className="pointer-events-none absolute right-4 top-1/2 flex -translate-y-1/2 flex-col gap-2" aria-hidden>
        {scenes.map((_, index) => (
          <span
            key={index}
            className="block w-[3px] rounded-full transition-all duration-500"
            style={{
              height: active === index ? 28 : 6,
              background: active === index ? "var(--invite-peach)" : index < active ? "rgb(246 205 175 / 0.55)" : "rgb(255 255 255 / 0.25)",
            }}
          />
        ))}
      </nav>
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="invite-arrive text-[11px] font-medium uppercase tracking-[0.32em] text-[var(--invite-peach)]">{children}</p>;
}

function Display({ children, delay = 1 }: { children: React.ReactNode; delay?: number }) {
  return (
    <h1 className="invite-arrive invite-display mt-5 text-[2.6rem] leading-[1.08] sm:text-5xl" style={{ "--order": delay } as React.CSSProperties}>
      {children}
    </h1>
  );
}

function Body({ children, delay = 2 }: { children: React.ReactNode; delay?: number }) {
  return (
    <p className="invite-arrive invite-serif mt-5 text-[1.15rem] leading-relaxed text-white/85" style={{ "--order": delay } as React.CSSProperties}>
      {children}
    </p>
  );
}

function Mountain({ width = 180 }: { width?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/invite/mountain-line.png" alt="" width={width} className="invite-arrive mx-auto opacity-90" style={{ width }} />
  );
}

function names(list: string[]): string {
  if (list.length === 0) return "A few friends";
  if (list.length === 1) return list[0];
  if (list.length <= 3) return `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
  return `${list.slice(0, 2).join(", ")} and ${list.length - 2} others`;
}

function buildScenes(props: InviteExperienceProps): React.ReactNode[] {
  const opening =
    props.kind === "group" ? (
      <>
        <Mountain />
        <div className="mt-10">
          <Eyebrow>An invitation</Eyebrow>
        </div>
        <Display>Walk with {props.groupName}</Display>
        <Body>
          {names(props.members)} {props.members.length === 1 ? "is" : "are"} walking thirty days through the Sermon on the Mount
          together, and saved a place for you.
        </Body>
      </>
    ) : (
      <>
        <Mountain />
        <div className="mt-10">
          <Eyebrow>An invitation</Eyebrow>
        </div>
        <Display>
          {props.inviterName ? `${props.inviterName} invited you up the mountain` : "You're invited up the mountain"}
        </Display>
        <Body>Thirty days in the words of Jesus. Here is what that means, and why it matters.</Body>
      </>
    );

  const together =
    props.kind === "group" ? (
      <>
        <Eyebrow>Together</Eyebrow>
        <Display>You won&apos;t walk alone</Display>
        <Body>
          {props.groupName} has its own quiet conversation: a place to share what each day stirs up, to ask for prayer, and to
          keep each other going.
        </Body>
        <div className="invite-arrive mt-8 flex flex-wrap justify-center gap-2" style={{ "--order": 3 } as React.CSSProperties}>
          {props.members.slice(0, 8).map((member, index) => (
            <span key={index} className="rounded-full border border-white/25 px-4 py-1.5 text-sm text-white/90">
              {member}
            </span>
          ))}
          <span className="rounded-full border border-[var(--invite-peach)]/70 px-4 py-1.5 text-sm text-[var(--invite-peach)]">You?</span>
        </div>
      </>
    ) : (
      <>
        <Eyebrow>Together</Eyebrow>
        <Display>
          {props.inviterName && props.inviterDay && props.inviterDay >= 1 && props.inviterDay <= 31
            ? `${props.inviterName} is on Day ${props.inviterDay}`
            : "Better walked together"}
        </Display>
        <Body>
          Walk it alongside the person who sent this, start a small group with friends, or be matched with a few others who
          began when you did. Everything shared is read with care.
        </Body>
      </>
    );

  return [
    opening,
    <>
      <Eyebrow>Matthew 5–7</Eyebrow>
      <Display>On a hillside in Galilee, Jesus sat down and taught</Display>
      <Body>
        What he said there has unsettled and remade people for two thousand years. It may be the most admired teaching in
        history.
      </Body>
    </>,
    <>
      <Eyebrow>The gap</Eyebrow>
      <blockquote className="invite-arrive invite-serif mt-6 space-y-2 text-2xl italic text-white/90" style={{ "--order": 1 } as React.CSSProperties}>
        <p>Blessed are the poor in spirit.</p>
        <p>Love your enemies.</p>
        <p>Do not worry about tomorrow.</p>
      </blockquote>
      <Body delay={3}>
        Most of us admire these words. Very few of us live them. Thirty Days on the Mount is an invitation to stop admiring and
        start walking.
      </Body>
    </>,
    <>
      <Eyebrow>How it works</Eyebrow>
      <Display>Thirty mornings, one passage at a time</Display>
      <dl className="invite-arrive mt-8 space-y-5 text-left" style={{ "--order": 2 } as React.CSSProperties}>
        {[
          ["Morning", "A passage and one honest question to carry into your day."],
          ["Midday", "Going deeper: the words, their world, and what they ask of you."],
          ["Evening", "A quiet moment to notice what changed."],
        ].map(([time, text]) => (
          <div key={time} className="flex gap-5 border-t border-white/15 pt-4">
            <dt className="w-20 shrink-0 text-[11px] font-medium uppercase tracking-[0.25em] text-[var(--invite-peach)]">{time}</dt>
            <dd className="invite-serif text-lg leading-snug text-white/90">{text}</dd>
          </div>
        ))}
      </dl>
      <Body delay={3}>About ten minutes a day, with a companion to talk it through whenever you need.</Body>
    </>,
    <>
      <Eyebrow>The possibility</Eyebrow>
      <Display>Who could you be thirty days from now?</Display>
      <Body>
        Less anxious about tomorrow. Quicker to forgive. Freer with what you have. Not by trying harder, but by spending a
        month in the company of the One who said these words.
      </Body>
    </>,
    together,
    <Begin key="begin" {...props} />,
  ];
}

function Begin(props: InviteExperienceProps) {
  return (
    <>
      <Mountain width={120} />
      <Display>You don&apos;t have to be ready. Only willing to begin.</Display>
      <div className="invite-arrive mt-9 flex flex-col items-center gap-3" style={{ "--order": 2 } as React.CSSProperties}>
        {props.appStoreURL ? (
          <a href={props.appStoreURL} className="invite-primary">
            Get the app and begin
          </a>
        ) : null}
        {props.kind === "group" ? (
          <>
            <a href={`mount://join/${props.code}`} className={props.appStoreURL ? "invite-secondary" : "invite-primary"}>
              I have the app: join {props.groupName}
            </a>
            <p className="mt-2 text-sm text-white/65">
              Or in the app, choose Profile → Join with an invitation and enter
              <span className="mt-2 block font-mono text-xl tracking-[0.3em] text-white">{props.code}</span>
            </p>
          </>
        ) : null}
        <a href={`sms:${SMS_NUMBER}&body=START`} className={props.appStoreURL || props.kind === "group" ? "invite-secondary" : "invite-primary"}>
          Begin by text message
        </a>
      </div>
      <p className="invite-arrive mx-auto mt-8 max-w-sm text-[11px] leading-relaxed text-white/55" style={{ "--order": 3 } as React.CSSProperties}>
        To begin by text, send START to {SMS_DISPLAY}. By texting in, you consent to receive recurring automated messages from
        30 Days on the Mount, operated by The Matterworks LLC. Consent is not a condition of any purchase; the program is free.
        Message frequency varies. Message and data rates may apply. Reply HELP for help or STOP to cancel. See our{" "}
        <a href="/terms" className="underline">
          Terms
        </a>{" "}
        and{" "}
        <a href="/privacy" className="underline">
          Privacy Policy
        </a>
        .
      </p>
    </>
  );
}
