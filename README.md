# מדגה בית-אלפא - מערכת ניהול (Midge Bet Alfa)

Prototype management app for the Beit Alpha fish farm. Next.js 14 (App Router) +
TypeScript + Tailwind CSS (RTL Hebrew UI) + Prisma + SQLite (prototype; swap to
Postgres for production - see "Production / hosting" below).

This codebase was written without ever running `npm install` in the build
environment (the sandbox it was built in is too slow for a Node dependency
tree of this size), so **you need to run the install yourself** on a normal
machine. Everything past that point is a normal Next.js project.

## First-time setup

The database is PostgreSQL (Neon). See "Production / hosting" below for how
to create a Neon project and set the two required connection strings.

```bash
cd app
cp .env.example .env          # then fill in your Neon URLs + a fresh JWT_SECRET
npm install
npx prisma migrate dev        # applies migrations to your Neon dev branch
npm run seed                  # loads reference data + creates admin user
npm run dev
```

Then open http://localhost:3000 and log in:

- username: `admin`
- password: `ChangeMe123!` (or whatever `ADMIN_SEED_PASSWORD` you set)

**Change that password immediately.** Generate a real `JWT_SECRET`:

```bash
openssl rand -base64 32
```

Paste the output into `.env` as `JWT_SECRET=...`. The app refuses to start
if this is missing or shorter than 32 characters.

> **Note on login:** Microsoft 365 SSO was explored and built, then reverted
> (2026-06-19) - the user does not want any dependency on Azure/Entra,
> branded or not. Login is the app's own username+password system, as
> below. If this changes again later, see git history / ask me - the SSO
> code existed briefly and is fully removed from the active path now.

## What's built so far

- Auth: bcrypt password hashing, JWT in an httpOnly/secure/sameSite cookie,
  login lockout after 5 failed attempts in 15 minutes (`src/lib/audit.ts`).
- RBAC: per-module access levels (1 = full edit ... 6 = no access),
  enforced server-side (`src/lib/permissions.ts`, `src/lib/api-guard.ts`).
  Hiding a nav link is never the only check - every API route that mutates
  data must use `withModuleAccess(...)` from `src/lib/api-guard.ts`.
- Audit log: every login/logout/create/update/delete should write to
  `AuditLog` via `src/lib/audit.ts` (actor, action, entity, before/after
  JSON, IP, timestamp).
- App shell: sidebar nav on desktop/tablet, bottom tab bar on mobile
  (`src/components/AppShell.tsx`, items defined in `src/lib/nav-config.ts`).
- Stub pages for the Operations module screens (ponds, growth cycles,
  transfers, weighings, clients/deliveries) and admin/users - each already
  enforces the real permission check, body content is "coming soon" until
  built out per the spec doc.
- `src/lib/business-rules.ts` - the ±100 fish balance check from the spec,
  pulled out so it can be unit tested and reused by the real close-cycle
  screen once it's built (not wired into a screen yet).

## Tests

```bash
npm test          # unit tests (Vitest) - business rules, no DB/server needed
npm run test:e2e  # end-to-end (Playwright) - needs the dev server + a seeded DB
```

The e2e auth tests log in as the seeded `admin` user with the default
password above - if you change that password, update
`tests/e2e/auth.spec.ts` to match, or run e2e against a separate test
database seeded with the default.

## Security notes / open items

- **Real PII lives outside source control.** `prisma/seed-data/workers.local.ts`
  holds real workers' names, phone numbers, and emails - it's gitignored
  (`prisma/seed-data/*.local.ts`) and never gets committed. See
  `prisma/seed-data/README.md`. Ponds/fish/products aren't PII and stay
  directly in `seed.ts`.
- **Set a real `JWT_SECRET` and `ADMIN_SEED_PASSWORD`** in `.env` before
  running this anywhere beyond your own machine - see `.env.example`.
  `JWT_SECRET` must be 32+ random characters or the app refuses to start
  (enforced in `src/lib/jwt-secret.ts`).
- If you ever push this repo anywhere (even a private GitHub repo), double
  check `.gitignore` is actually being respected (`git status` should not
  show `.env` or any `*.local.ts` file) before the first commit.
- Login lockout is DB-backed (counts recent `login_failed` audit rows),
  which works correctly even if the app runs as multiple serverless
  instances - an in-memory counter would not.
- `middleware.ts` only checks that the JWT is validly signed and unexpired;
  it does **not** hit the database, so it can't see a deactivated worker
  mid-session. That check lives in `src/lib/current-user.ts`
  (`getCurrentUser`), which every page and API route must call. Treat the
  middleware as a fast first gate, not the only one.
- No "forgot password" / password reset flow yet.
- `x-forwarded-for` is read as-is for audit logging; once this is deployed
  behind a real reverse proxy/load balancer, pin this to the specific header
  your host sets, since it's spoofable otherwise.
- `src/auth.ts` and `src/app/api/auth/[...nextauth]/route.ts` are
  **deprecated leftovers** from the reverted Microsoft SSO attempt. Nothing
  imports them anymore; they were left in place (instead of deleted)
  because the build sandbox couldn't delete files. Safe to delete once
  you're working locally.

## Open business questions from the spec (placeholders in place)

The source spec (מסמך אפיון מודול תפעול בריכות) flags several decisions for
"דנה" that aren't resolved yet: who issues delivery certificates, who owns
pricing, the exact scope of the Orders feature, and the real
`GrowingThreshold` values (currently placeholder notes in the seed data).
Per your direction, the build proceeds with documented placeholder
assumptions rather than blocking on these - search the code for "TBD" and
"דנה" comments to find them when you're ready to confirm the real answers.

## Real farm data in the seed (2026-06-19)

`prisma/seed.ts` now loads the farm's actual register data, extracted from
files in `טבלאות מטה דאטה/` in the project folder, instead of placeholder
rows:

- 49 real ponds (code, name, area, equipment counts, GPS) from
  `ponds-sivan.xlsx`.
- 8 real fish strains and 13 real products with their actual Priority ERP
  IDs from `fish-sivan.xlsx`.
- 19 real workers (13 staff/consultants + 6 Thai field workers) from
  `workers-sivan.xlsx`. None of them get login accounts - only the seeded
  `admin` user can log in, since there's no SSO and no real passwords for
  these people (see security notes above - **no Azure/SSO**, this is a
  deliberate, standing decision). This real worker data (names/phones/emails)
  lives in `prisma/seed-data/workers.local.ts`, which is gitignored - see
  `prisma/seed-data/README.md`. If that file is missing, `npm run seed` skips
  workers with a warning instead of failing.
- Approximate RBAC grants per worker, mapped onto the existing 4-module
  access-level scale. The real permission file
  (`טבלאות לדוגמא - דנה/הרשאות.xlsx`) is far more granular (14 operational
  domains) and uses an opposite-direction 1-5 scale - this seed data is a
  best-effort coarsening, not a literal import. Search `seed.ts` for
  "best-effort" / "approximation" comments before relying on it for real
  permission decisions.
- Pond type (regular/large reservoir/pit/warehouse) is a heuristic based on
  ID prefix, not a column in the source file - confirm with Dana if it
  matters for reporting.
- `GrowingThreshold` rows now exist for בס (4 stages) and אמנון (5 stages,
  the farm's main product) with real stage names, but min/max values are
  still TBD - the source file had no numbers, same open item as before.

**Note:** the Prisma schema (`Worker`, `Pond` models) was extended with new
optional fields to hold this real data. Run `npx prisma generate` and
`npx prisma migrate dev` (or `db push` for the SQLite prototype) before
running `npm run seed` again, so the generated client matches the updated
schema.

## Production / hosting

**Stack: Vercel + Neon (PostgreSQL).** The schema already targets PostgreSQL.
Two env vars are required (Neon gives you both):

| Var | Neon string | Used for |
|---|---|---|
| `DATABASE_URL` | Pooled connection string | App queries at runtime |
| `DIRECT_URL` | Unpooled (direct) connection string | `prisma migrate deploy` |
| `JWT_SECRET` | `openssl rand -base64 32` | Session signing |

See `.env.example` for the exact URL format.

### First deploy checklist (do in this order)

1. Create a Neon project → copy both connection strings into Vercel env vars
   (`DATABASE_URL` pooled, `DIRECT_URL` direct).
2. Generate a fresh `JWT_SECRET`: `openssl rand -base64 32` → paste into Vercel.
3. Connect the repo to Vercel and let it build (it runs `prisma generate` via
   `postinstall`).
4. From your local machine with `DIRECT_URL` set:
   `npx prisma migrate deploy` — applies `prisma/migrations/0001_init`.
5. `npm run seed` (with `DIRECT_URL` pointing at Neon direct URL) — loads
   reference data and creates the admin user.
6. Open the deployed URL, log in as `admin` / your seed password, change it
   immediately.

### Local development against Neon

SQLite is no longer used — the schema targets PostgreSQL. For local dev, use
Neon's **branch** feature:

1. In Neon dashboard → Branches → "Create branch" → call it `dev`.
2. Copy both connection strings for the dev branch into your local `.env`
   (`DATABASE_URL` = pooled, `DIRECT_URL` = direct).
3. `npx prisma migrate dev` applies migrations to the dev branch.
4. `npm run seed` seeds the dev branch.

Local dev then works identically to production (same engine, same SQL dialect)
without needing a locally installed PostgreSQL.

## Not yet built / future scope

- Sending app emails (alerts, notifications) - email service not chosen
  yet (you said "not sure, you choose" - Resend was the standing
  recommendation, revisit when the alerting feature itself gets built).
- 10-year historical data import + predictions feature - explicitly
  deferred, not scoped yet.
