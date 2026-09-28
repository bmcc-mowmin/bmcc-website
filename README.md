# BMCC website

Public website, member portal and admin for the **Brentwood Muslim Community Center**
(7701 Lone Tree Way, Brentwood, CA). Built from the design handoff in
[`docs/design-handoff/`](docs/design-handoff/README.md), which is the visual and behavioral spec.

**Stack:** Next.js 16 (App Router, TypeScript, server-rendered) · Postgres 17 + Prisma 7 ·
Docker Compose (Postgres, Mailpit) · 5 languages (English, Dari, Urdu, Pashto, Spanish; Dari, Urdu and Pashto are RTL).

## Run it locally

Requirements: **Node 24** (`.nvmrc`) and Docker (Docker Desktop, Colima or OrbStack).

```bash
npm install
npm run setup        # creates .env from .env.example and generates local secrets/passwords
npm run db:up        # starts Postgres + Mailpit in Docker
npm run db:deploy    # applies database migrations
npm run db:seed      # loads sample data (refuses to run when APP_ENV=production)
npm run dev          # http://localhost:3000
```

| What | Where |
|---|---|
| Website | http://localhost:3000 |
| Admin | http://localhost:3000/admin (sign in with the test admin account) |
| Health check | http://localhost:3000/api/health |
| Prayer times API | http://localhost:3000/api/prayer-times?date=YYYY-MM-DD |
| Monthly timetable PDF | http://localhost:3000/api/prayer-times/pdf?month=YYYY-MM |
| Mailpit (local email inbox) | http://localhost:8025 |
| Database browser | `npm run db:studio` |
| Design prototypes | `npx serve docs/design-handoff/design -l 4000` → http://localhost:4000 |

To run the **production build** locally instead of the dev server:
`docker compose --profile app up -d --build` (applies migrations on start).

### Test accounts (local only)

Created by the seed. Emails and passwords are in your `.env`
(`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`, `SEED_MEMBER_EMAIL` / `SEED_MEMBER_PASSWORD`).
The member account has an active membership and a 3-person household.

## Commands

| Command | Does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` / `npm start` | Production build / run it |
| `npm run lint` / `npm run typecheck` | Checks |
| `npm run test:unit` | Unit tests (prayer-time logic) |
| `npm run db:migrate` | Create + apply a migration after editing `prisma/schema.prisma` |
| `npm run db:deploy` | Apply pending migrations (what production runs) |
| `npm run db:seed` | Reload sample data (wipes the seeded tables) |
| `npm run db:reset` | Drop everything, re-migrate, re-seed |

## How it is organized

```
prisma/schema.prisma      database schema (every change via migrations)
prisma/seed.ts            local sample data
messages/*.json           UI text per language; missing keys fall back to English
src/app/(site)/           public pages
src/components/           header, footer, shared UI
src/lib/env.ts            every setting, validated at startup
src/lib/prayer/           prayer times — the single source for header, Home and Prayer Times
src/lib/i18n/             languages, RTL, English fallback
docs/design-handoff/      the signed-off design and spec
```

## Prayer times

One module, `src/lib/prayer/schedule.ts`, feeds the header's Next Prayer, the Home table, the
Prayer Times page, the API and the PDF:

1. **Adhan** is calculated with `adhan-js` for the masjid's coordinates, **Hanafi Asr**, and the
   method chosen in admin (ISNA by default), in `America/Los_Angeles`.
2. A **day override** from admin replaces any single Adhan/Iqamah (or that Friday's Jumu'ah list).
3. **Iqamah** comes from the admin's rules — minutes after Adhan or a fixed time — where a dated rule
   (Ramadan, DST season) takes priority over the everyday rule.

Next Prayer is computed in the masjid's time zone and refreshes every 30 seconds; on Fridays the
first Jumu'ah replaces Dhuhr; after Isha it shows tomorrow's Fajr. The monthly PDF is generated on
request unless an admin uploaded one for that month.

## Admin sign-in

`AUTH_PROVIDER=dev` (local): email + password for the seeded accounts, a signed session cookie,
rate-limited attempts. It is refused when `APP_ENV=production`. Clerk replaces it in phase 7.

## Settings

Everything that differs between local and production is an environment variable —
see [`.env.example`](.env.example) for the full, commented list. Nothing secret is committed.
Key switches: `APP_ENV`, `AUTH_PROVIDER` (dev → clerk), `PAYMENT_PROVIDER` (mock → stripe),
`MAIL_TRANSPORT` (smtp/Mailpit → provider), `STORAGE_DRIVER` (local → s3).

## Languages

UI text lives in `messages/<lang>.json`. Content stored in the database (announcements, events,
Jumu'ah labels) holds one text per language and also falls back to English. The chosen language
is kept in the `bmcc_lang` cookie (so the server renders the right language and `dir` on the first
request) and in `localStorage`, so all open tabs switch together.

All non-English text is machine-generated and must be replaced with vetted translations before
launch — see [GO_LIVE.md](GO_LIVE.md).

To add a language: add it to `LANGS` in `src/lib/i18n/config.ts` (and to `RTL_LANGS` if it is
right-to-left), add `messages/<code>.json`, and add the code to `LANGS` in `prisma/seed.ts`. If its
menu labels are too long for the desktop header, the header automatically falls back to the menu button.

## Deployment

A deployment guide is added in phase 8. In short: build the Docker image, provide the environment
variables for production, point `DATABASE_URL` at a managed Postgres, and route traffic to port 3000
with `/api/health` as the health check. See [GO_LIVE.md](GO_LIVE.md) for everything BMCC must supply.
