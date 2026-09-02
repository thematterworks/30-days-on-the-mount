import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Request-scoped timing, for finding where wall-clock time actually goes on
 * the inbound-SMS path.
 *
 * The critical path runs webhook -> conversation engine -> system config ->
 * Anthropic -> Twilio, across four modules, and threading a timer object
 * through every signature would be a large diff for a diagnostic. An
 * AsyncLocalStorage context means `timed()` can be dropped in at any depth
 * and finds its span list on its own.
 *
 * Every helper is a no-op outside `withTiming`, so paths that opt out (the
 * crons, the admin API) carry no overhead and emit no log lines.
 */

interface TimingContext {
  label: string;
  start: number;
  spans: Map<string, { totalMs: number; count: number }>;
}

const storage = new AsyncLocalStorage<TimingContext>();

/**
 * True until the first invocation on this instance completes. A cold start
 * pays module init plus connection setup, so a slow first request and a slow
 * steady-state request have completely different causes — and the log has to
 * say which one it is looking at.
 */
let isFirstInvocation = true;

/** Runs `fn` inside a timing context, logging one summary line when it settles. */
export async function withTiming<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const context: TimingContext = { label, start: performance.now(), spans: new Map() };
  const cold = isFirstInvocation;
  isFirstInvocation = false;

  try {
    return await storage.run(context, fn);
  } finally {
    report(context, cold);
  }
}

/**
 * Times one awaited operation. Accepts a PromiseLike so Supabase's query
 * builders (thenables, not Promises) can be wrapped without an extra await.
 */
export async function timed<T>(name: string, fn: () => PromiseLike<T>): Promise<T> {
  const context = storage.getStore();
  if (!context) return fn();

  const start = performance.now();
  try {
    return await fn();
  } finally {
    const elapsed = performance.now() - start;
    const existing = context.spans.get(name);
    if (existing) {
      existing.totalMs += elapsed;
      existing.count += 1;
    } else {
      context.spans.set(name, { totalMs: elapsed, count: 1 });
    }
  }
}

function report(context: TimingContext, cold: boolean): void {
  const total = performance.now() - context.start;
  const measured = [...context.spans.values()].reduce((sum, span) => sum + span.totalMs, 0);

  // Slowest first: the whole point is to see the dominant cost immediately,
  // without reading the line left to right.
  const breakdown = [...context.spans.entries()]
    .sort((a, b) => b[1].totalMs - a[1].totalMs)
    .map(([name, { totalMs, count }]) => `${name}=${Math.round(totalMs)}ms${count > 1 ? `x${count}` : ""}`)
    .join(" ");

  // Large unaccounted time means the cost is NOT in any instrumented call —
  // it points at cold start, module init, or the platform itself rather than
  // at a query or an API. That distinction is the main thing this line buys.
  const unaccounted = Math.round(total - measured);

  console.info(
    `[timing] ${context.label} total=${Math.round(total)}ms cold=${cold} unaccounted=${unaccounted}ms | ${breakdown}`,
  );
}
