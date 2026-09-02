# Campus LeetCode Challenge

A college-wide LeetCode challenge platform for **1 September 2026 → 31 December 2026** (Asia/Kolkata).

Students register once with three fields — name, college ID, LeetCode username — and never type a
statistic again. Solved counts, difficulty splits, streaks, points and ranks are read from public
LeetCode profiles and refreshed automatically.

---

## Contents

- [The one idea that shapes everything](#the-one-idea-that-shapes-everything)
- [Features](#features)
- [Architecture](#architecture)
- [Setup](#setup)
- [Environment variables](#environment-variables)
- [Database setup](#database-setup)
- [Creating an admin](#creating-an-admin)
- [Development commands](#development-commands)
- [How the LeetCode provider works](#how-the-leetcode-provider-works)
- [How synchronisation works](#how-synchronisation-works)
- [Challenge boundaries, timezones and streaks](#challenge-boundaries-timezones-and-streaks)
- [How to change scoring](#how-to-change-scoring)
- [Seed data](#seed-data)
- [Testing](#testing)
- [Production deployment](#production-deployment)
- [Security notes](#security-notes)
- [Known limitations](#known-limitations)

---

## The one idea that shapes everything

**The leaderboard ranks problems solved *during* the challenge — never lifetime LeetCode totals.**

A student who arrives with 800 solved problems and does nothing for four months finishes last.

Making that true requires storing history rather than reading a live number:

1. When a student joins, their lifetime per-difficulty counts are stored as a **baseline**.
2. Challenge progress is `current − baseline`, per difficulty, clamped at zero.
3. Daily snapshots record the shape of that progress over time, which is what drives streaks,
   the heatmap, monthly breakdowns and the weekly/monthly ranks.

The example from the brief, and a real assertion in the test suite:

```
Joined 1 September   lifetime solved = 137   (baseline)
On 15 September      lifetime solved = 158
Challenge progress   = 21
```

This approach is also what makes duplicate-proofing free: LeetCode's `acSubmissionNum` counts
**distinct** problems solved, so re-solving a problem cannot move the number. A unique constraint on
`(studentId, problemSlug)` enforces the same rule at the row level.

---

## Features

**Students**
- One-step registration; the LeetCode profile is verified before the account is created
- Personal dashboard: challenge solved/easy/medium/hard, points, current and longest streak
- GitHub-style contribution heatmap over the challenge window
- Difficulty distribution chart, monthly progress (September → December), recent solves
- Challenge / weekly / monthly ranks, rank movement, and dynamically derived nudges
  ("3 more problems to overtake #6", "You're in the top 10%") — every one computed from stored data

**Everyone**
- Landing page with live participation, problems solved, current leader and days remaining
- Leaderboard with search, sort, pagination, rank-movement arrows, top-three treatment, and
  your own row highlighted
- Challenge overview: elapsed/remaining days, totals, most active day, timeline, and charts

**Admins**
- Password-protected dashboard with totals, sync health and failed-fetch diagnostics
- Charts: solved per day, per week, participation over time, difficulty distribution
- Roster management: search, disable/enable, force resync, remove
- Manual global refresh, CSV export, and live scoring configuration
- Dark/light/system theming and full mobile support throughout

---

## Architecture

```
src/
├── app/
│   ├── page.tsx                    Landing
│   ├── join/                       Registration
│   ├── leaderboard/                Standings
│   ├── challenge/                  College-wide overview
│   ├── student/[username]/         Student dashboard
│   ├── admin/                      Admin dashboard + login
│   └── api/                        Route handlers (Zod-validated, rate limited)
│
├── components/                     UI, split by concern
│   └── ui/                         shadcn-style primitives (Button, Card, Badge, Input…)
│
└── lib/
    ├── challenge/                  ← pure domain logic, no I/O, fully unit tested
    │   ├── dates.ts                Timezone + challenge-window arithmetic
    │   ├── scoring.ts              Points
    │   ├── progress.ts             Baseline diffing and window filtering
    │   ├── streak.ts               Current / longest streaks
    │   ├── ranking.ts              Competition ranking and movement
    │   ├── config.ts               Challenge settings (DB-backed, cached)
    │   └── types.ts
    │
    ├── leetcode/                   ← the only code that knows LeetCode exists
    │   ├── types.ts                `LeetCodeProvider` interface
    │   ├── graphql-provider.ts     Production implementation
    │   ├── mock-provider.ts        Local development only
    │   ├── http.ts                 Rate limiting, timeouts, retries, caching
    │   └── errors.ts               Provider errors, kept separate from app errors
    │
    ├── services/                   ← orchestration; the only place that writes standings
    │   ├── registration.ts  sync.ts  leaderboard.ts  student.ts
    │   ├── challenge-stats.ts  admin.ts
    │
    ├── auth/admin.ts               scrypt + signed-cookie admin sessions
    ├── db.ts  env.ts  api.ts  rate-limit.ts  validation.ts  utils.ts
```

Three rules keep this maintainable:

- **`lib/challenge/` is pure.** No database, no network, no `Date.now()` hidden inside. Every
  function takes what it needs as an argument, which is why the test suite can assert timezone
  behaviour and challenge boundaries exactly.
- **`lib/leetcode/` is replaceable.** Everything above it depends on the `LeetCodeProvider`
  interface, not on GraphQL. Swapping data sources means writing one new class.
- **Only `services/sync.ts` writes standings.** No API route, server action or client component can
  set a score. There is no schema anywhere that accepts a solved count as input.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript 5.9 (strict) · Tailwind CSS 4 ·
Prisma 7 + PostgreSQL · Recharts · Zod 4 · Vitest.

---

## Setup

Requires **Node.js ≥ 20.11** and a PostgreSQL database.

```bash
npm install
cp .env.example .env      # then fill in DATABASE_URL and the admin secrets
npm run db:deploy         # create the schema
npm run dev               # http://localhost:3000
```

> `npm install` may report that install scripts were blocked (npm 11 behaviour). The four packages
> this project needs them for — `prisma`, `@prisma/engines`, `esbuild`, `unrs-resolver` — are already
> recorded under `allowScripts` in `package.json`, so this is handled. If you see the warning, run
> `npm approve-scripts --allow-scripts-pending` once.

---

## Environment variables

Copy `.env.example` to `.env`. Every variable is documented there; the essentials:

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | **yes** | PostgreSQL connection string |
| `DATABASE_CA_CERT_PATH` | usually | Path to the database's CA certificate, so TLS is verified |
| `DATABASE_CA_CERT` | alt | The same certificate inline as PEM, for env-only hosts |
| `DATABASE_SSL_NO_VERIFY` | no | Explicit escape hatch that disables certificate verification |
| `ADMIN_PASSWORD_HASH` | for admin | scrypt hash of the admin password |
| `ADMIN_SESSION_SECRET` | for admin | 32-byte secret signing the admin session cookie |
| `CRON_SECRET` | in production | Bearer token authorising `/api/sync` |
| `LEETCODE_PROVIDER` | no | `graphql` (default) or `mock` (development only) |
| `LEETCODE_API_URL` | no | Override the GraphQL endpoint |
| `LEETCODE_TIMEOUT_MS` | no | Per-request timeout (default 12000) |
| `LEETCODE_MAX_RPS` | no | Client-side throttle (default 4) |
| `LEETCODE_MAX_RETRIES` | no | Retry attempts with backoff (default 3) |
| `NEXT_PUBLIC_SITE_URL` | no | Public base URL |

Secrets are read only through `src/lib/env.ts`, which imports `server-only`. Importing it from a
client component is a **build error**, so no secret can reach the browser bundle.

If `ADMIN_PASSWORD_HASH` or `ADMIN_SESSION_SECRET` is missing, the admin area **fails closed**:
every login is refused rather than the dashboard falling open.

---

## Database setup

Any PostgreSQL works — Neon, Supabase, Railway, RDS, or local.

```bash
npm run db:deploy     # apply migrations (production and CI)
npm run db:migrate    # create a new migration during development
npm run db:studio     # browse the data
```

A ready-to-apply initial migration is committed at `prisma/migrations/0_init/migration.sql`.

### Database TLS

Hosted providers frequently serve a certificate signed by their own CA. Supabase's direct
endpoint is issued by "Supabase Intermediate 2021 CA", which Node rejects as a self-signed
chain — the Prisma CLI connects happily while the application fails with `TlsConnectionError`.

The fix is to supply that CA rather than to switch verification off. Supabase's root CA is
bundled at `certs/supabase-prod-ca-2021.crt` and wired up through `DATABASE_CA_CERT_PATH`,
so the connection is both encrypted and authenticated. For another provider, download its
CA and point the variable at it. `DATABASE_SSL_NO_VERIFY=true` exists as a deliberate
escape hatch but is never selected automatically.

Also note: if your database password contains special characters, percent-encode them in
`DATABASE_URL` (`@` → `%40`), otherwise the URL parser reads the password as the host.

**Note on Prisma 7:** the connection URL lives in `prisma.config.ts`, not in `schema.prisma`, and the
runtime client connects through the `@prisma/adapter-pg` driver adapter (see `src/lib/db.ts`). This
is expected — Prisma 7 removed `url` from the datasource block.

### Data model

| Model | Purpose |
|---|---|
| `Student` | Identity, baseline, denormalised standings, sync bookkeeping |
| `LeetCodeProfile` | Latest lifetime profile snapshot (context only, never ranked on) |
| `DailySnapshot` | One row per student per challenge day; cumulative totals + that day's deltas |
| `SolvedProblem` | Problem-level detail, unique on `(studentId, problemSlug)` |
| `Problem` | Shared slug → difficulty cache, so each problem is resolved once college-wide |
| `ChallengeConfig` | Singleton: window, timezone, and the scoring table |
| `SyncRun` | Audit trail powering the admin sync-health panel |

---

## Creating an admin

```bash
npm run admin:hash -- "a-long-admin-password" --secret
```

This prints both values:

```
ADMIN_PASSWORD_HASH="scrypt:9f3c…:be21…"
ADMIN_SESSION_SECRET="4a7f…"
```

Paste them into `.env` (or your host's environment settings) and restart. Sign in at `/admin/login`.

The plaintext password is never stored or transmitted anywhere — only the salted scrypt hash, which
cannot be reversed. Sessions are signed, `httpOnly`, `SameSite=Lax`, `Secure` in production, and
expire after 8 hours. Login is rate limited to 10 attempts per 15 minutes.

---

## Development commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build (runs `prisma generate` first) |
| `npm start` | Serve the production build |
| `npm test` | Run the test suite |
| `npm run test:watch` | Tests in watch mode |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:deploy` / `db:migrate` / `db:studio` / `db:reset` | Prisma workflows |
| `npm run db:seed` | Create demo students (development only) |
| `npm run db:seed -- --clean` | Remove demo students, leaving real ones untouched |
| `npm run sync` | Run a global sync from the CLI (`-- --all` for everyone) |
| `npm run admin:hash` | Generate admin secrets |

---

## How the LeetCode provider works

LeetCode publishes no official API. The provider reads the **public GraphQL endpoint**
(`https://leetcode.com/graphql`) that the public profile pages themselves use — public data only, no
credentials, no authentication, no scraping of rendered HTML.

Everything sits behind one interface (`src/lib/leetcode/types.ts`):

```ts
interface LeetCodeProvider {
  getProfile(username): Promise<LeetCodeProfileData>;
  getSolvedProblems(username, limit?): Promise<LeetCodeSolvedProblem[]>;
  getRecentActivity(username, year): Promise<LeetCodeActivityDay[]>;
  getProblem(slug): Promise<LeetCodeProblemMeta | null>;
  usernameExists(username): Promise<boolean>;
}
```

The queries used, all verified against live responses:

| Query | Gives us |
|---|---|
| `matchedUser.submitStatsGlobal.acSubmissionNum` | Distinct solved counts per difficulty — the authoritative source for progress |
| `matchedUser.profile` | Global ranking, reputation, avatar |
| `recentAcSubmissionList` | Recent accepted submissions with real timestamps |
| `matchedUser.userCalendar.submissionCalendar` | Per-day submission counts for the heatmap |
| `question(titleSlug:)` | A problem's difficulty, cached in `Problem` |

**Being a good citizen.** A process-wide sliding-window rate limiter (default 4 req/s) caps how fast
we can ever hit LeetCode, every request has a hard timeout, transient failures retry with
exponential backoff plus jitter, and profiles are cached briefly so a burst of page loads collapses
into one upstream call.

**Failures are never disguised.** A provider error is a `LeetCodeProviderError` with a specific code
(`USER_NOT_FOUND`, `RATE_LIMITED`, `TIMEOUT`, `NETWORK`, `UPSTREAM`, `MALFORMED`), recorded against
the student as `syncStatus: FAILED` with a retry count. **Existing figures are left untouched and
are never replaced with estimates or mock data.**

### The mock provider

`LEETCODE_PROVIDER=mock` swaps in a deterministic fake for offline development. It is **refused when
`NODE_ENV=production`** — asking for it there throws at startup rather than silently downgrading to
fabricated statistics. Nothing ever falls back to it when the real provider fails.

---

## How synchronisation works

Triggered on registration, hourly by cron (`vercel.json` → `GET /api/sync`), by an admin, by a
student's rate-limited "Refresh" button, or via `npm run sync`.

For each student:

1. Fetch the profile. On failure: record the error, increment `retryCount`, stop — nothing is overwritten.
2. Resolve the baseline (see below).
3. Upsert `LeetCodeProfile` with the latest lifetime figures.
4. Insert newly seen problems from the recent-accepted window with `skipDuplicates`.
5. Upsert today's `DailySnapshot`, computing deltas against the previous snapshot.
6. Fold the submission calendar into the trailing fortnight of snapshots (full backfill on first sync).
7. Recompute streaks from stored snapshots.
8. Write the standings onto `Student`.

Steps 3–8 run inside one transaction. Afterwards, ranks are recomputed for everyone in a **single
SQL statement** using a window function, so ranking stays one round trip whether there are 50
students or 5,000.

### Idempotency

Running a sync twice produces exactly the same database state as running it once:

- `DailySnapshot` is unique on `(studentId, date)` and **upserted**, never blindly inserted.
- `SolvedProblem` is unique on `(studentId, problemSlug)` and inserted with `skipDuplicates`.
- Challenge totals are **recomputed from the baseline** every time rather than accumulated, so they
  cannot drift no matter how often sync runs.

### Batching

Global syncs process a bounded batch (default 200), **stalest first**, so one invocation stays inside
serverless time limits and successive hourly runs work through the whole college. Tune with
`?limit=` and `?concurrency=`, or run `npm run sync -- --all` from a machine without a time limit.

---

## Challenge boundaries, timezones and streaks

The challenge runs `2026-09-01 00:00:00` to `2026-12-31 23:59:59.999` **Asia/Kolkata** — which in UTC
is `2026-08-31T18:30:00Z` to `2026-12-31T18:29:59.999Z`. Getting this wrong by one day is the classic
bug in this kind of app, so all conversion lives in `src/lib/challenge/dates.ts` and nowhere else.

- Instants are stored in UTC; challenge *days* are calendar days in the challenge timezone.
- Day keys (`YYYY-MM-DD`) are derived with `Intl.DateTimeFormat` against an explicit timezone, so the
  server produces identical results wherever it runs. **The host clock's local time is never used.**
- The tests deliberately run under `TZ=UTC` so any accidental reliance on local time fails loudly.

**Before the challenge** — solves cannot count, because a student who registers early has their
baseline *re-based on every sync* until the start instant. It freezes on the first sync at or after
1 September.

**After the challenge** — solves cannot count, because once the window has closed the standings are
recomputed from the last snapshot *inside* the window rather than from the live profile. January
solving cannot change a December result.

**Streaks** are computed from stored `DailySnapshot` history, never from browser timestamps. A
current streak is consecutive challenge days with at least one solve, ending today — with one
deliberate exception: today is still in progress, so not having solved anything *yet today* does not
retroactively break a streak that was alive yesterday. Any other gap resets it.

---

## How to change scoring

Defaults: **Easy 1 · Medium 3 · Hard 5**. So 10 easy + 5 medium + 2 hard = `10 + 15 + 10` = **35 points**.

Point values live in the `ChallengeConfig` row — not in constants scattered through the frontend.
Change them in **Admin → Scoring configuration**, or via `PUT /api/admin/config`:

```bash
curl -X PUT https://your-app/api/admin/config \
  -H 'content-type: application/json' \
  --cookie 'lc_admin_session=…' \
  -d '{"easyPoints":2,"mediumPoints":5,"hardPoints":10}'
```

Everything that computes a score reads through `computePoints()` in `src/lib/challenge/scoring.ts`,
so one change updates the leaderboard, dashboards, monthly breakdowns and exports together. Ranks
refresh immediately; each student's stored point total is recomputed on their next sync.

The same row also holds the challenge name, window and timezone.

---

## Seed data

```bash
npm run db:seed            # ~26 demo students with varied personas
npm run db:seed -- --clean # remove them again
```

The seed builds a plausible day-by-day solving history and then derives snapshots, points, streaks
and ranks **through the same domain functions the real sync uses** — so if you change the scoring
rules, the seeded numbers change with them.

Two safeguards:

- It **refuses to run when `NODE_ENV=production`**.
- Every row is marked `isDemo: true`, and `--clean` removes exactly those rows and nothing else, so a
  seeded database can be returned to a real one safely. Demo students are badged in the admin roster.

---

## Testing

```bash
npm test
```

76 tests covering the logic that decides who wins:

| Area | Covered |
|---|---|
| **Challenge boundaries** | Before the challenge doesn't count · during does · after doesn't · both edges inclusive to the millisecond |
| **Timezone** | Asia/Kolkata day rollover at 18:30 UTC · 1 Sep is not 31 Aug · date-column round-tripping · 122-day span |
| **Points** | Easy 1 / Medium 3 / Hard 5 · the 35-point worked example · custom configurations · invalid configs rejected |
| **Duplicates** | Same problem twice counts once · distinct problems count separately · re-solving cannot inflate a baseline diff |
| **Streaks** | Solve daily → correct streak · miss a day → resets · unsolved *today* doesn't break it · multiple solves per day count once · clamped to the challenge window |
| **Leaderboard** | Ranks by challenge progress not lifetime · points break ties · ties share a rank and the next is skipped · movement · percentiles · catch-up gaps |
| **Baselines** | Re-based before the start · locked on the first sync after it · never re-locked |

---

## Production deployment

### Vercel

1. Import the repository.
2. Set the environment variables from `.env.example` — at minimum `DATABASE_URL`,
   `DATABASE_CA_CERT_PATH`, `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET`, `CRON_SECRET`.
3. Run `npm run db:deploy` once against the production database.
4. Deploy. `vercel.json` registers the cron for `/api/sync`; Vercel sends `CRON_SECRET` as a
   bearer token automatically.

Four things are already configured for serverless, and are worth understanding before you
change them:

- **The CA certificate is bundled explicitly.** `outputFileTracingIncludes` in
  `next.config.ts` copies `certs/**` into the function, because Next's tracer cannot
  follow a dynamic `readFileSync` and the database connection would otherwise fail in
  production but work locally. If you would rather not ship the file, put the PEM in the
  `DATABASE_CA_CERT` environment variable instead.
- **`maxDuration` is 60 seconds**, the Hobby ceiling. Setting a value above your plan's
  limit makes the deployment fail, so this is the value that works everywhere.
- **The cron batch is capped at 60 students** (`/api/sync?limit=60`) so a run finishes
  inside those 60 seconds at the default rate limit. Raise the limit and `maxDuration`
  together on Pro.
- **The pool is 3 connections per instance in production** (`DATABASE_POOL_MAX`). Every
  serverless instance opens its own pool, so a large value multiplied across concurrent
  instances exhausts the database's connection limit.

On the **Hobby** plan cron jobs run **once per day** regardless of the schedule in
`vercel.json`. That still works — students are simply refreshed daily rather than hourly.
For hourly refreshes either upgrade to Pro, or drive the endpoint from any external
scheduler with the same bearer token.

### Anywhere else

```bash
npm ci
npm run db:deploy
npm run build
npm start
```

Then schedule the sync however you prefer:

```bash
# hourly cron
0 * * * * cd /srv/challenge && npm run sync -- --limit 300

# or over HTTP
0 * * * * curl -H "Authorization: Bearer $CRON_SECRET" https://your-app/api/sync
```

### Performance

Designed to stay fast at **500–2,000 students**:

- Every public page reads only the database. **Opening the leaderboard makes zero LeetCode
  requests**, no matter how many students are registered.
- Standings are denormalised onto `Student` and served by one indexed, paginated query.
- Rank recomputation is a single SQL window function, not N updates.
- The leaderboard and challenge endpoints send `s-maxage` + `stale-while-revalidate`.
- Synchronisation is a completely separate background concern, batched and rate limited.

---

## Security notes

- **All scoring is server-side.** No endpoint accepts a statistic; there is no Zod schema in the
  project that would parse one. The leaderboard cannot be manipulated from the client.
- Every input is validated with Zod at the network boundary.
- Rate limits on registration (5/hour), public reads (120/min), manual sync (4/10 min) and admin
  login (10/15 min).
- Admin routes require an authenticated session; `/admin` redirects to the login page and every
  `/api/admin/*` handler calls `requireAdmin()` independently.
- Prisma parameterises all queries; the one raw statement contains no interpolation.
- Errors are sanitised: users get a useful message, operators get the detail in the server log.
  **Stack traces are never sent to the browser.**
- Public payloads never expose database IDs or college student IDs — the public identifier is the
  LeetCode username, which is already public. College IDs appear only in the admin CSV export, where
  cells are escaped against CSV injection.
- Secrets are confined to `server-only` modules and cannot be imported into client bundles.

---

## Known limitations

Stated plainly, because they shaped the design:

1. **LeetCode caps `recentAcSubmissionList` at 20 entries** regardless of the requested limit
   (verified against the live API). Full solved-problem history is therefore *not* retrievable. This
   is exactly why challenge progress is derived from baseline-vs-current counters rather than by
   counting rows: the counter approach is complete and duplicate-proof, while the problem-level feed
   is a best-effort record of what our syncs happened to observe. The dashboard says so on the page
   rather than implying the feed is exhaustive.
2. **A private LeetCode profile cannot be read.** Registration fails with a clear message, and the
   student needs to make their profile public.
3. **Per-day attribution depends on sync frequency.** If a student is not synced for three days, the
   solves land on the sync day in the snapshot deltas. The hourly cron keeps this accurate in
   practice, and the submission calendar provides true per-day activity independently.
4. **Rate limiting is in-process.** Correct for a single instance; a horizontally scaled deployment
   should move `consume()` in `src/lib/rate-limit.ts` behind a shared store. No call site changes.
5. **"Your" leaderboard row is remembered in `localStorage`**, since there are no student accounts.
   The highlight is per-device and purely presentational.
6. LeetCode's public GraphQL endpoint is an undocumented courtesy, not a contract. It could change.
   If it does, only `src/lib/leetcode/graphql-provider.ts` needs rewriting.
7. **`/student/[username]` deliberately has no `loading.tsx`.** A loading file creates a
   Suspense boundary whose fallback streams immediately, committing HTTP 200 before
   `notFound()` can set 404 — an unknown student would render the right page under the
   wrong status. `/leaderboard` and `/challenge` keep their skeletons because neither
   calls `notFound()`.
8. **Charts render with `isAnimationActive={false}`.** Beyond matching the restrained-motion
   brief, it makes the marks deterministic: with the mount animation enabled, Recharts
   could leave axes drawn but the series invisible.

---

## Licence

Provided for use by the organising college.
