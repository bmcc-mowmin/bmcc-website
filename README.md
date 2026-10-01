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
| Admin portal | http://localhost:3000/admin (in production: its own host, `ADMIN_HOST`) |
| Health check | http://localhost:3000/api/health |
| Prayer times API | http://localhost:3000/api/prayer-times?date=YYYY-MM-DD |
| Monthly timetable PDF | http://localhost:3000/api/prayer-times/pdf?month=YYYY-MM |
| Mailpit (local email inbox) | http://localhost:8025 |
| Database browser | `npm run db:studio` |
| Design prototypes | `npx serve docs/design-handoff/design -l 4000` → http://localhost:4000 |

To run the **production build** locally instead of the dev server:
`docker compose --profile app up -d --build` (applies migrations on start).

### Test accounts (local only)

Created by the seed; passwords are in your `.env`.

| Account | Role | Password setting |
|---|---|---|
| `SEED_ADMIN_EMAIL` (admin@bmcc.local) | Super admin | `SEED_ADMIN_PASSWORD` |
| editor@bmcc.local | Content editor | `SEED_STAFF_PASSWORD` |
| prayer@bmcc.local | Prayer times manager | `SEED_STAFF_PASSWORD` |
| membership@bmcc.local | Membership coordinator | `SEED_STAFF_PASSWORD` |
| treasurer@bmcc.local | Treasurer | `SEED_STAFF_PASSWORD` |
| `SEED_MEMBER_EMAIL` (member@bmcc.local) | Member (no admin access) | `SEED_MEMBER_PASSWORD` |

The member account has an active membership and a 3-person household.

## Commands

| Command | Does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` / `npm start` | Production build / run it |
| `npm run lint` / `npm run typecheck` | Checks |
| `npm run test:unit` | Unit tests (prayer times, event dates, calendar files) |
| `npm run test:e2e` | End-to-end tests in a real browser (needs the dev server + seeded DB; first time: `npx playwright install chromium`) |
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

## Events and announcements

Events are stored with per-language title, description, tag and location, a first date/time, and
optionally "every week on the same day" (until an optional end date). Weekly repeats are evaluated on
masjid wall-clock time, so a 1:00 PM Friday event stays at 1:00 PM across daylight-saving changes.
The Home carousel shows the next 8 upcoming published events; the Events page shows all of them.
Each event has a page at `/events/<slug>`, an `.ics` file (`/api/events/<slug>/ics`) and a Google
Calendar link. Photos are uploaded in admin and served from `/media/…`.

Announcements show in the header ticker only between their start and end times and while active;
the ticker disappears when none are showing.

## Community Directory

`/community` shows **approved** listings only (pending/rejected never reach the browser), filtered
instantly by free text (name, categories, city, tags), main category and specific category, 10 per
page, listings with a phone number first. Filters and an open listing are kept in the address bar
(`?q=…&type=…&category=…&page=…&listing=…`) so a view can be shared. "View Details" is a native modal
dialog (focus stays inside, Escape closes, focus returns) with a Google Maps embed when the listing
has an address or city (`GOOGLE_MAPS_EMBED_API_KEY` switches to the Maps Embed API). Below 700px the
table becomes cards with a full-width Call button.

`/community/submit` → listing saved as **pending**, the office (`CONTACT_INBOX`) and the submitter are
emailed. Admin → Directory approves (submitter emailed), rejects with an optional reason, edits, adds,
deletes, and **imports/exports CSV** — use the import to restore the real vetted listings at go-live.

**Every public form** uses a hidden honeypot field, a minimum fill-in time and a Postgres-backed
rate limit (`RATE_LIMIT_MAX` per `RATE_LIMIT_WINDOW_SEC` per visitor IP).

## Admin portal

`/admin` (production: `ADMIN_HOST`, e.g. admin.brmcc.org — `/admin` on the main site redirects there,
and the admin host serves nothing else). Pages get `X-Frame-Options: DENY`, `noindex` and no caching.

- **Roles** (`src/lib/auth/permissions.ts`): Super admin, Content editor, Prayer times manager,
  Membership coordinator, Treasurer. A person can hold several. Each page *and* each server action
  checks its section, and the sidebar shows only what the person may open.
- **Admin users** (Super admin): invite by email with a one-time set-password link (72 hours), change
  roles, disable (signs them out immediately), remove access. There is always at least one active
  Super admin, and nobody can demote or disable themselves.
- **Dashboard** and an **activity log** of every admin change (who, what, when, details).
- **First admin in production** (the seed never runs there): `npm run admin:create -- email "Name"`
  from a checkout whose `DATABASE_URL` points at production; it prints a set-password link.
- **Sign-in:** `AUTH_PROVIDER=dev` is email + password with a signed session cookie and rate-limited
  attempts; it is refused when `APP_ENV=production`, where Clerk takes over (member-login phase).

### Prayer-times source

Admin → Prayer times → *Iqamah rules, Jumu'ah & settings* chooses where daily times come from:
**Built-in** (calculated + overrides) or an external provider. **Masjidi** is listed but unavailable
until Masjidi provides API access; if a selected provider fails, the site falls back to the built-in
times. Adding a provider = one adapter in `src/lib/prayer/sources/`.

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
