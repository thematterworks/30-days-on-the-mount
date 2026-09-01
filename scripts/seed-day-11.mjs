// One-off: seeds Day 11's GuidedStory structured columns from its existing
// curriculum content ("Eye for an Eye / Absorbing Violence"), so the /journey
// flow can be tested with real content instead of fallbacks.
//
// Usage: node scripts/seed-day-11.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

function readEnvLocal(key) {
  const lines = readFileSync(join(rootDir, ".env.local"), "utf8").split("\n");
  for (const line of lines) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (!m || m[1] !== key) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    return v.trim();
  }
  return undefined;
}

const origin = new URL(readEnvLocal("SUPABASE_URL")).origin;
const key = readEnvLocal("SUPABASE_SERVICE_ROLE_KEY");

const content = {
  hook_text:
    "Someone will wrong you today — a slight, an insult, a car cutting you off. When it comes, don't return the blow. Break the chain: bless them, out loud.",
  scripture_reference: "Matthew 5:38–39",
  scripture_text:
    "You have heard that it was said, 'An eye for an eye and a tooth for a tooth.' But I say to you, Do not resist the one who is evil. But if anyone slaps you on the right cheek, turn to him the other also.",
  scripture_audio_url: "",
  exegesis_text: [
    "The law of the bios is equivalent exchange: an eye for an eye. It feels like justice — balanced, fair, owed. But it only ensures the whole world goes blind. Every blow answered demands another. The ledger never closes.",
    "Jesus introduces something radically subversive: absorbing the blow. Turning the other cheek is not passive victimhood, and it is not staying inside abuse. It is an active, defiant refusal to participate in the economy of violence at all.",
    "When you bless the one who wrongs you, you become a circuit breaker. The momentum of human anger — which survives only by being passed on — stops dead in you. Nothing flows out the other side.",
    "This is the life of Zoe: you are so anchored in the Father's unearned love that you no longer need to defend your worth by returning fire. You have nothing to protect, so there is nothing left to retaliate for.",
  ].join("\n\n"),
  surrender_text:
    "Unclench your hands. Breathe out the blow you are still holding. Say quietly: I do not have to make this even. I am already held. Then step back into your day carrying nothing to defend.",
};

const res = await fetch(`${origin}/rest/v1/curriculum_days?day_number=eq.11`, {
  method: "PATCH",
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  },
  body: JSON.stringify(content),
});

const body = await res.json().catch(() => null);
if (!res.ok) {
  console.error("Seed failed:", res.status, JSON.stringify(body));
  process.exit(1);
}
console.log("Seeded Day 11 GuidedStory content:");
for (const k of Object.keys(content)) {
  console.log(`  ${k}: ${content[k] ? content[k].slice(0, 60).replace(/\n/g, " ") + "…" : "(empty)"}`);
}
