"use client";

import { useState } from "react";

const AMOUNTS = [500, 1500, 3000, 5000];

/** Choose once or monthly, an amount, and go to Stripe to give. */
export function GiftForm({ source }: { source: string }) {
  const [monthly, setMonthly] = useState(false);
  const [cents, setCents] = useState(1500);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const chosen = custom ? Math.round(Number(custom) * 100) : cents;

  async function give() {
    setBusy(true);
    setProblem(null);
    try {
      const response = await fetch("/api/give", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cents: chosen, monthly, source }),
      });
      const body = (await response.json()) as { url?: string; error?: string };
      if (!body.url) throw new Error(body.error ?? "Something went wrong.");
      window.location.href = body.url;
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "Something went wrong.");
      setBusy(false);
    }
  }

  const choice = (active: boolean) =>
    `rounded-full border px-5 py-2.5 text-base transition-colors ${active ? "border-[var(--site-peach)] bg-[var(--site-peach)] text-[var(--site-navy)]" : "border-white/25 text-white/90 hover:border-white/50"}`;

  return (
    <div className="mx-auto mt-10 max-w-md rounded-[28px] border border-white/15 bg-white/[0.06] p-7 backdrop-blur-sm">
      <div className="flex justify-center gap-2">
        <button type="button" className={choice(!monthly)} onClick={() => setMonthly(false)}>Once</button>
        <button type="button" className={choice(monthly)} onClick={() => setMonthly(true)}>Monthly</button>
      </div>
      <div className="mt-6 grid grid-cols-4 gap-2">
        {AMOUNTS.map((amount) => (
          <button
            key={amount}
            type="button"
            className={choice(!custom && cents === amount)}
            onClick={() => {
              setCents(amount);
              setCustom("");
            }}
          >
            ${amount / 100}
          </button>
        ))}
      </div>
      <label className="mt-4 flex items-center gap-2 rounded-full border border-white/20 px-5 py-2.5 text-white/80 focus-within:border-white/50">
        <span>$</span>
        <input
          inputMode="decimal"
          placeholder="Another amount"
          value={custom}
          onChange={(event) => setCustom(event.target.value.replace(/[^0-9.]/g, ""))}
          className="w-full bg-transparent text-white placeholder:text-white/45 focus:outline-none"
        />
      </label>
      <button
        type="button"
        onClick={give}
        disabled={busy || !(chosen >= 300 && chosen <= 100000)}
        className="site-button site-button-primary mt-6 w-full disabled:opacity-50"
      >
        {busy ? "Opening…" : `Give $${(chosen / 100).toFixed(chosen % 100 ? 2 : 0)}${monthly ? " a month" : ""}`}
      </button>
      {problem ? <p className="mt-3 text-center text-sm text-[var(--site-peach)]">{problem}</p> : null}
      <p className="mt-4 text-center text-xs leading-relaxed text-white/55">
        Secure payment by Stripe. Gifts support 30 Days on the Mount, operated by The Matterworks LLC, and are not
        tax-deductible. {monthly ? "Cancel a monthly gift anytime by writing to 30daysonthemount@gmail.com." : ""}
      </p>
    </div>
  );
}
