# 30 Days on the Mount — Command Center

Admin dashboard and backend infrastructure for the "30 Days on the Mount" WhatsApp-based spiritual immersion practice. Next.js (App Router) on Vercel, Supabase (Postgres), the Meta WhatsApp Cloud API, and Anthropic's Claude for reflection replies.

## Stack

- **Frontend:** Next.js, Tailwind CSS v4, shadcn/ui, Lucide icons
- **Database:** Supabase (Postgres) with RLS enabled and no anon/authenticated policies — every query goes through the server-only service-role client
- **Hosting:** Vercel Functions. Scheduling is an external hourly pinger (not Vercel Cron — Hobby tier caps cron at once/day, which is incompatible with per-participant delivery-hour matching), hitting `/api/cron/daily-push` and `/api/cron/evening-checkin` with `Authorization: Bearer $CRON_SECRET`
- **Messaging:** WhatsApp Cloud API (Meta Graph API v19.0)
- **AI:** Anthropic Claude (`claude-opus-4-8`) via `@anthropic-ai/sdk`
- **Admin auth:** single-operator email/password, HMAC-signed session cookie (no external auth provider)

## Setup

### 1. Supabase

Create a project, then run the migration:

```bash
# via the Supabase SQL editor, or the CLI:
supabase db push
```

The migration (`supabase/migrations/0001_init.sql`) creates `users`, `message_logs`, `curriculum_days`, `system_config`, `community_posts`, and `blog_posts`, seeds Day 0's welcome copy and the global AI persona prompt, and enables RLS with no policies (service-role only).

### 2. Meta WhatsApp Cloud API

1. Create a Meta App with the WhatsApp product, provision a number (via Twilio or Meta directly — the number's origin doesn't matter to this app; only the Meta Phone Number ID and access token do).
2. In the Meta App dashboard, set the webhook callback URL to `https://<your-domain>/api/webhook/whatsapp` and the verify token to the value you'll set as `WHATSAPP_VERIFY_TOKEN`.
3. Subscribe to the `messages` webhook field.
4. Create and get approval for your Meta message templates (`day_00_welcome`, `day_01_prompt`, ... `day_30_prompt` by default — template names are editable per day in the Curriculum tab).

### 3. Environment variables

Copy `.env.example` to `.env.local` and fill in every value. To generate `ADMIN_PASSWORD_HASH`:

```bash
node -e "require('bcryptjs').hash(process.argv[1], 10).then(console.log)" 'your-password'
```

### 4. Install and run

```bash
npm install
npm run dev
```

Visit `/admin/login` to sign in to the dashboard.

### 5. Deploy

Push to Vercel and set the same environment variables in the project settings. Scheduling is **not** in `vercel.json` — Vercel Hobby tier only allows cron to run once a day, which breaks per-participant delivery-hour matching (see the note on `/api/cron/daily-push` below). Instead, point an external scheduler (e.g. cron-job.org, a GitHub Actions scheduled workflow, EasyCron) at both routes, firing hourly, with header `Authorization: Bearer <CRON_SECRET>`:
- `GET https://<your-domain>/api/cron/daily-push`
- `GET https://<your-domain>/api/cron/evening-checkin`

Both routes only check that Bearer header — they don't care who calls them, Vercel Cron or otherwise.

## Architecture notes

- **`proxy.ts`** (the Next.js 16 successor to `middleware.ts`) guards every `/admin/*` and `/api/admin/*` route by verifying the signed session cookie; unauthenticated requests are redirected to `/admin/login` (or `401` for API routes).
- **`/api/webhook/whatsapp`** handles the Meta `GET` handshake and `POST` message/status events. New numbers land in a `pending` waiting room (no auto-start). A switchboard checks static ice-breaker replies first, then routes `pending` participants through a conversational onboarding state machine (`onboarding_step`: readiness check via Gatekeeper AI → name → preferred delivery hour → optional email → activation), and `active` participants through the day-aware reflection AI (or the pastoral-care evening persona, if their most recent template was the evening check-in) — all within the 24-hour customer service window, gated by the global AI toggle and per-user pause.
- **`/api/cron/daily-push`** runs every hour; for each active participant whose current local hour (computed from `timezone`) matches their `preferred_delivery_hour`, it sends the *next* day's template (`current_day + 1`) and only then advances `current_day` to match, since Day 0 itself is already sent in real time at activation. Marks anyone past Day 30 as `completed`, and — for participants who opted into email during onboarding — sends the same content via Resend (`lib/email.ts`, scaffolded; no-ops cleanly if `RESEND_API_KEY` isn't set).
- **`/api/cron/evening-checkin`** runs every hour, same shape as `daily-push`, but targets `(preferred_delivery_hour + 10) % 24` local — a second, same-day touchpoint 10 hours after the morning send, wrapping past midnight for participants with a late morning hour. It never touches `current_day`.
- `lib/timezone.ts` holds the shared `getLocalHour()`/default-hour/default-timezone logic both crons use.
- All Supabase access goes through `lib/supabase/server.ts`, which uses the service-role key and is marked `server-only` — it can never be imported into a Client Component.
