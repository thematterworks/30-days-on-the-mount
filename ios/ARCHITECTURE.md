# 30 Days on the Mount — iOS

The ministry's hub: the 30-day course, a native Bible, an AI companion, a
library of voices and teachings, and each participant's profile. **The app is
the primary product**; the SMS program continues alongside it for anyone
without the app, and both are the same participant, keyed on the same phone
number, in the same database.

Tone and pacing take their cue from *Practicing the Way*: unhurried,
contemplative, editorial — formation through practices, not content
consumption. The palette and type are the ministry's own.

Decisions, and why:

| Decision | Choice | Why |
|---|---|---|
| Product | App-first ministry hub; SMS secondary | The course, the Bible and the companion belong in one place |
| Platform | Native SwiftUI | Live Activities, Dynamic Island, widgets and interactive notifications are Swift-only anyway |
| Identity | Phone number + SMS code | An SMS participant opens the app on the day they are already on |
| Navigation | Tab bar (Journey · Bible · Companion · Library) + avatar → Profile | Native, and on iOS 26 the glass bar tucks away so full-screen pages stay full-screen |
| Journey | Full-screen vertical days, no cards | The layouts' composition: number, title, mountain, gradient |
| Bible | **Qara Bible, rebuilt natively in phases** — never embedded | One design language across the hub; Qara features take this app's design, not Qara's |
| Backend | One hub database for app and SMS | One sign-in, one profile, one source of truth |
| Brand | Colors measured from the brand assets; Roller Coaster Serif display (Didot until the licensed file arrives) | See `Shared/Zoe.swift` |

### Brand

Measured from the asset files, not approximated: gradient `#8A8396` →
`#737293` → `#546391`, accent peach `#F6CDAF`, white translucent mountain line
art. The wordmark lockup, the mountain, and the app icon come from the
designer's PNGs (`Mount/Resources/Assets.xcassets`). The display face is
**Roller Coaster Serif**, a commercial font: it ships once its file and an
app-embedding license are in hand. `ZoeType.displayFamily` is the one line to
change.

### The Bible

`Mount/Resources/BSB.sqlite` — the Berean Standard Bible (public domain), all
31,086 verses, bundled for instant offline reading with FTS5 full-text search.
Built by `scripts/build-ios-bible.mjs` from `bsb_tables.xlsx` using the parsing
and text-cleaning rules proven in Qara Bible's ingest, so both apps render
identical text. Verse IDs use Qara's BBCCCVVV scheme so highlights can sync.

Built: reader, book/chapter picker, search by words or reference ("jn 3:16"),
verse selection with Highlight / Copy / Ask the companion, "read in context"
from each day's scripture. Next from Qara, in order: notes, interlinear word
study (the source tables already carry the Hebrew/Greek), the AI scholar
merged into the one companion, reading plans, groups and the prayer wall.

---

## Running it

```bash
cd ios
xcodegen generate          # Mount.xcodeproj is generated, not committed
open Mount.xcodeproj
```

Or headless:

```bash
xcodebuild -project Mount.xcodeproj -scheme Mount \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' test
```

Use an iPhone Pro simulator — only those have a Dynamic Island.

Preview-build conveniences (DEBUG only, compiled out of release):

- Launch argument `-previewSignedIn` starts signed in.
- Any six digits complete sign-in.
- Long-press the "Day N of 31" pill: **Advance a day** (stands in for the morning push) and **Send evening check-in** (starts the evening Live Activity and a local notification you can reply to from the Lock Screen).

Content comes from `Mount/Resources/SampleCurriculum.json`, generated from the
real curriculum. Regenerate after content changes:

```bash
node scripts/export-ios-sample-curriculum.mjs
```

---

## Structure

```
ios/
├── project.yml                 XcodeGen spec — edit this, not the .xcodeproj
├── Shared/                     Compiled into BOTH the app and the widget extension
│   ├── Zoe.swift               Design tokens ported from app/globals.css
│   ├── JourneyDay.swift        A day's content (the web's GuidedStoryDay)
│   ├── JourneyProgress.swift   Completed / active / locked — same rule as JourneyStack.tsx
│   ├── JourneySnapshot.swift   What widgets read, via the App Group
│   ├── DayActivityAttributes   The Live Activity's data
│   └── DeepLink.swift          mount://day/N, mount://companion
├── Mount/                      The app
│   ├── App/                    Entry point, AppModel (composition root + navigation)
│   ├── Core/                   Services (protocols), stores, Keychain, Live Activity, notifications
│   └── Features/               Onboarding · Home · Story (6 screens) · Companion
├── MountWidgets/               Home/Lock Screen widgets + Live Activity / Dynamic Island
└── MountTests/                 Swift Testing — progress rules, deep links, phones, content
```

**One seam to the outside world.** Every screen depends on three protocols in
`Core/Services.swift` — `CurriculumSource`, `AuthService`, `CompanionService`.
`AppModel` is the only place that picks implementations. Today those are the
`Preview*` versions; Phase 2 adds `Remote*` versions and swaps them in there,
without touching a view.

**Every surface opens the app the same way.** Widgets, the Live Activity, the
Dynamic Island and notifications all carry a `DeepLink`, and all of them route
through `AppModel.open(_:)`. One place decides what "open Day 4" means,
including refusing a locked day.

---

## How the AI companion fits

The brief was to keep the conversational AI central without breaking the
simplicity. The answer is **one continuous conversation with three ways in**,
and no new navigation:

1. **From the reflection.** The Reflection screen keeps the web's Curious
   Inspector: write, get one question back. Below the question, "Keep talking"
   carries the reflection and the question into the companion, so the
   conversation continues instead of starting cold.
2. **From the journey.** One quiet button, top right of the home stack. No tab
   bar — the sanctuary stays a single place.
3. **From the Lock Screen.** The evening check-in notification has an inline
   reply field, the app's equivalent of answering a text. The reply goes to the
   same conversation. The evening Live Activity opens it too.

It is styled as a **journal, not a messenger**: no bubbles or avatars, the
companion in the curriculum's serif voice, the participant's words quieter on
the right.

Server-side it is the **same thread** SMS participants have in `message_logs`,
run through the same `handleInboundMessage` engine, with `channel = 'app'`.
Someone who started by text keeps their history.

---

## Delivery plan

### Phase 1 — Foundation ✅ (this commit)

The native app, fully navigable on the bundled real curriculum: sign-in,
journey stack, the six-screen guided story, the companion, Home and Lock Screen
widgets, the Live Activity with all three Dynamic Island presentations,
interactive check-in notifications, Keychain-held session, App Group sharing.
Swift 6 strict concurrency, zero warnings, tests passing. Verified in the
simulator end to end, including a live Dynamic Island and Lock Screen Live
Activity.

**Elevation pass (also built):** a living atmosphere (the gradient follows the
hour under a slowly breathing gold "first light"); a zoom from each day card
into its story; the threshold — three paced breaths before today's story,
skippable at any moment; a one-time dawn sweep when a day unlocks; completed
cards that turn over to show the participant's own reflection and question;
text that rises into place as each story screen arrives; a "Go in peace"
send-off after Carry; an interactive **"I lived it"** button on the Live
Activity that closes the day from the Lock Screen; Liquid Glass on the few
floating controls (iOS 26); restrained haptics; a breathing "listening"
indicator in the companion. All honor Reduce Motion.

Not yet: anything that needs the server. AI replies in this build say plainly
that they are not connected rather than imitating the companion.

### Phase 2 — Mobile API (Next.js, `app/api/mobile/*`)

Blocked on restoring the Supabase project (see Open issues).

| Endpoint | Purpose |
|---|---|
| `POST /api/mobile/auth/start` | Send a sign-in code to the phone |
| `POST /api/mobile/auth/verify` | Exchange code for a session token |
| `GET /api/mobile/journey` | Participant progress + curriculum (with guided-story fields) |
| `GET /api/mobile/companion` | Conversation history from `message_logs` |
| `POST /api/mobile/companion` | Send a message → `handleInboundMessage({ channel: 'app' })` |
| `POST /api/mobile/reflect` | Curious Inspector (shares logic with `/api/journey/reflect`) |
| `POST /api/mobile/devices` | Register APNs device token + Live Activity push-to-start token |
| `DELETE /api/mobile/account` | Account deletion — **required by App Store guideline 5.1.1(v)** |

Sign-in codes: prefer **Twilio Verify** over sending codes through the 10DLC
number. Verify uses its own pre-registered sender, so the approved campaign's
use case does not need amending for one-time passcodes.

Tokens: bearer tokens signed like the existing participant session cookie
(`lib/participant-auth.ts`), with a separate secret. Stored in the Keychain on
device.

Database: add `'app'` to the `message_channel` enum, and a `devices` table
(participant, APNs token, Live Activity push-to-start token, environment,
updated_at).

### Phase 3 — Push, everywhere the SMS used to go

- `lib/apns.ts`: token-based APNs (.p8 key) over HTTP/2.
- `lib/messaging.ts` gains the `'app'` channel. Each send picks APNs when the
  participant has a live device token and **falls back to SMS** when not —
  that fallback is what "alongside" means in practice.
- Daily push → notification deep-linked to the day.
- Evening check-in → **push-to-start Live Activity** (iOS 17.2+) plus the
  reply-able notification. Server-driven, because iOS ends any Live Activity
  after eight hours active, so the morning one cannot reach the evening.
- Live Activity switches to `pushType: .token` so the server can update it.

### Phase 4 — App Store readiness

- **App icon** (none yet) and a **short home-screen name** — "30 Days on the
  Mount" truncates to "30DaysontheM…". Needs your call on the short name,
  keeping the A2P brand consistent.
- Apple Developer team ID in `project.yml`; automatic signing for device
  builds; push and App Group capabilities registered.
- Privacy nutrition label, privacy manifest, AI-generated-content disclosure.
- **Community reflections need moderation before they ship in the app:**
  guideline 1.2 requires filtering, reporting and blocking for user content.
- Bundle Fraunces (OFL-licensed) so type matches the web exactly.
- Accessibility pass at the largest Dynamic Type sizes; VoiceOver labels are
  already in place.
- TestFlight.

---

## Open issues

1. **The production Supabase project is unreachable.** Its hostname
   (`abhbwguyrpjgqbyhomll.supabase.co`) no longer resolves in public DNS, and
   it is not among the projects visible to the Supabase CLI login (The
   Matterworks org). Most likely paused or deleted, possibly under a separate
   account. This takes down the live SMS system, not just the app's backend.
   If it was deleted, everything rebuilds from the 16 migrations and the CSV
   except participant data, message history, and guided-story content entered
   only through the admin dashboard.
2. **Vercel CLI session expired** (`Not authorized`). Needs `npx vercel login`.
3. Scheduled delivery 401s from September (`CRON_SECRET` mismatch between
   GitHub and Vercel) — moot until the database is back, but still unfixed.

---

## Ideas to elevate the experience

Each idea deepens what is already there rather than adding surface.
**✅ = built in the elevation pass.** The rest remain proposals.

**The daily rhythm**

1. ✅ **Dawn on the card.** When the morning push unlocks a day, the card warms
   from locked grey to gold over a second, with one soft haptic. The single
   moment the journey "moves" is felt, not just seen.
2. ✅ **A breath before entering.** An optional pause after tapping Enter —
   "The Secret Room awaits", three slow breaths paced by a gold ring — before
   the story begins. It is already the web's language on the enter page.
3. ✅ **Time-aware gradient.** The dusk-to-deep gradient drifts slightly lighter
   in the morning and deeper at night, so the app quietly mirrors the morning
   invitation and evening check-in.
4. **Grace over streaks.** Missing a day never shows as failure. A day not
   entered simply waits: "The mountain is still here."

**Senses**

5. ✅ **Haptics with restraint.** A soft tick when a day card snaps into place,
   a single success tap on "Carry this into my day". Nothing else.
6. **The ambient audio bed.** The web already has one that ducks under the
   teaching video. Port it with an audio session that mixes politely with the
   participant's own music.
7. **Scripture read aloud.** The audio slot exists in the data; the button
   appears automatically once a day has a recording.

**Beyond the app**

8. ✅ **Interactive Live Activity.** An "I lived it" control on the Lock Screen
   (iOS 17 App Intents) marks the practice done without opening the app, and
   flips the island to the evening state.
9. **Scripture as a Lock Screen widget.** The day's verse in the rectangular
   Lock Screen slot, so it is read every time the phone is picked up.
10. **StandBy at night.** The evening prompt as a nightstand widget when the
    phone charges sideways.
11. **Control Center and Siri.** "Talk to my companion" as a Control Center
    button (iOS 18), and "What's today's practice?" through App Intents.
12. **A Focus filter.** An optional "On the Mount" Focus that silences other
    apps while a story is open.
13. **Apple Watch.** A complication with the day number and a wrist tap at the
    practice's moment. A later project of its own.

**Memory and meaning**

14. ✅ **Turn the card over.** A completed day's card flips to show what the
    participant wrote and the question they were asked. The journey becomes a
    record of their own words, no new screen needed.
15. **Day markers in the companion.** Subtle "Day 4" dividers in the journal,
    so the conversation reads as a path rather than one long scroll.
16. **Speak a reflection.** Dictation for the reflection field, for the walk
    home or the car.
17. **The summit.** On Day 31, the 31 cards resolve into a single mountain
    line — the path walked — with an optional, private-by-default card to
    share.

**Native polish**

18. ✅ **Liquid Glass, sparingly.** On iOS 26, only the two floating top-bar
    controls take the system glass. The content stays exactly as it is.
19. **The community drawer**, ported from the web once moderation is in place
    (see Phase 4).
