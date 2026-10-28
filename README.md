# BMCC website

Public website, member portal and admin for the **Brentwood Muslim Community Center**
(7701 Lone Tree Way, Brentwood, CA). Built from the design handoff in
[`docs/design-handoff/`](docs/design-handoff/README.md), which is the visual and behavioral spec.

**Stack:** Next.js 16 (App Router, TypeScript, server-rendered) · Postgres 17 + Prisma 7 ·
Docker Compose (Postgres, Mailpit) · 5 languages (English, Dari, Urdu, Pashto, Spanish; Dari, Urdu and Pashto are RTL).

| Document | What it's for |
|---|---|
| **README.md** (this file) | Running it locally, how each part works, and [deploying to a server](#deployment) |
| [GO_LIVE.md](GO_LIVE.md) | Checklist of what BMCC must decide or supply before launch |
| [PHASE_2.md](PHASE_2.md) | Features planned after launch (phone verification, mobile app, QR-code giving) |
| [docs/design-handoff/](docs/design-handoff/README.md) | The original design spec and prototypes |
| [CLAUDE.md](CLAUDE.md) / [AGENTS.md](AGENTS.md) | Notes for AI coding assistants working on this repo |

## Run it locally

Requirements: **Node 24** (`.nvmrc`) and Docker (Docker Desktop, Colima or OrbStack).

```bash
npm install
npm run setup        # creates .env with local defaults and generates local secrets/passwords
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

**Sign-in locally:** `AUTH_PROVIDER=dev` uses the seeded test accounts below (and is what the
browser tests need). `AUTH_PROVIDER=clerk` uses BMCC's Clerk development instance — set the two
Clerk keys in `.env` and restart `npm run dev`. Switch back to `dev` to run `npm run test:e2e`.

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
| `npm run test:unit` | Unit tests (prayer times, dates, coverage, permissions, search, translations) |
| `npm run test:e2e` | Browser tests for every flow, accessibility (axe) and phone layout. Needs the seeded database, Mailpit and `AUTH_PROVIDER=dev`; first time: `npx playwright install chromium` |
| `npm run db:migrate` | Create + apply a migration after editing `prisma/schema.prisma` |
| `npm run db:deploy` | Apply pending migrations (what production runs) |
| `npm run db:seed` | Reload sample data (wipes the seeded tables) |
| `npm run db:reset` | Drop everything, re-migrate, re-seed |
| `npm run admin:create -- email "Name"` | Make someone a Super admin (the way to create the first admin in production) |

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
deletes, and exports a CSV backup.

**Source of truth:** the website's database. BMCC's initial listings were imported once from the
vetted sheet; from now on every new listing comes in through **Submit a Listing** and is approved or
edited in Admin → Directory (there is no import). **Export CSV** gives a backup copy. The seed never
deletes or changes existing listings — only an empty directory (a fresh clone) gets fake samples —
and the browser tests create and remove their own "E2E…" listings.

**Every public form** uses a hidden honeypot field, a minimum fill-in time and a Postgres-backed
rate limit (`RATE_LIMIT_MAX` per `RATE_LIMIT_WINDOW_SEC` per visitor IP).

## Donations and membership

**Payments** go through one provider interface (`src/lib/payments`). `PAYMENT_PROVIDER=mock` (local)
sends visitors to a clearly-labelled **test checkout** at `/checkout/<id>` — no card details, no money —
with *Pay*, *Simulate a declined card* and *Cancel*. `stripe` (go-live) swaps in Stripe Checkout and
its webhook. Both produce the same provider-neutral events, handled in **one place**
(`src/lib/payments/events.ts`): each event is applied exactly once and all-or-nothing, then receipts
are emailed (numbered `BMCC-YYYY-000001` from a database sequence).

- **Donate** (`/donate`): five funds, one-time or monthly (`DEFAULT_DONATION_FREQUENCY`), $25–$250
  presets or a custom amount ($5–$25,000), thank-you page with the receipt number.
- **Membership** (`/membership`): the 5-step application stores the household as structured records
  (the primary member and everyone listed are the people covered by the Funeral Services Benefit),
  then checkout for $100/month or $1,000/year. The **first dues payment** activates the membership:
  `enrolledAt` = that payment, `benefitEligibleFrom` = 6 calendar months later on the masjid's
  calendar. A failed renewal starts a **30-day grace period**; after it coverage is **paused**, and
  paying resumes it (never skipping the waiting period). Coverage is computed when read
  (`src/lib/membership/coverage.ts`), so no scheduled job is needed.
- **Admin → Memberships** (Membership coordinator): coverage status, benefit dates, Membership ID,
  notes, household members (add/edit/remove), payments, cancel. **Admin → Donations** (Treasurer,
  read-only): totals, by fund, filters, recurring donors, CSV export.
- **Test tools** (mock provider only): *Next payment succeeds / fails* and *Grace period ends now*
  stand in for what Stripe does on its own schedule.

## Mailing list and contact form

**Mailing list (double opt-in).** The re-subscribe bar at the top of Home and the "Stay Connected"
band at the bottom both add to the **new** list (`src/lib/mailing-list`). Signing up emails a
confirmation link (Mailpit locally) in the visitor's language; the person is on the list only after
pressing **Confirm my subscription** on that page (a button, because mail scanners open links on
their own). The link works once, for 7 days. Confirming sends a welcome email with an unsubscribe
link and `List-Unsubscribe` headers (one-click unsubscribe in mail apps, `/api/unsubscribe`).
The form answers the same way whether or not an address is already subscribed, and one address gets
at most 3 confirmation emails a day. Dismissing the bar lasts for the browser session
(`bmcc_resub_dismissed`); `SHOW_RESUB_BAR_SITEWIDE=true` shows it on every page during the campaign.

**Admin → Subscribers** (Content editor): confirmed / waiting / unsubscribed, search, unsubscribe or
delete an address, and **Export confirmed (CSV)** — with each person's unsubscribe link — for the
newsletter tool chosen at go-live.

**Contact form** (About Us → `#contact`): name, email, message and "What is this about?", preselected
from `?topic=` (the Services, Assistance and Home links). Each message is saved, emailed to
`CONTACT_INBOX` with the visitor as reply-to, and acknowledged to the visitor (without repeating
what they wrote). **Admin → Messages** (Content editor, Membership coordinator): New / Handled,
reply by email, mark handled, delete.

## Member portal, RSVPs and search

**Sign-in** (`/login`, also the Home "Member Portal" card and the header's *Member Login*):
`AUTH_PROVIDER=dev` offers email + password (seeded accounts) and **"Email me a sign-in link"** — a
one-time, 30-minute link (Mailpit locally) for anyone BMCC knows by email: a donor, a member, or an
applicant who hasn't paid yet. Opening the link shows a *Sign in* button (mail scanners open links).
An address not in BMCC's member/donor records is told so, with a *Become a Member* link (lookups are
rate limited); staff accounts never get links and are pointed to the password form.
Member sessions last 30 days, staff sessions 8 hours. In production Clerk replaces this page
(GO_LIVE.md) and everything else stays the same — pages ask `getCurrentUser()` / `requireMember()`.

**My account** (`/account`), matched to the person by account and by email:
- *Membership* — coverage status, plan, reference and Membership ID, benefit start date, next dues
  date; an unpaid application gets *Complete payment*.
- *Household* — the people covered, and contact details the member can edit. Adding or removing
  covered people is a **request** emailed to the office (and saved in Admin → Messages), because it
  changes who the Funeral Services Benefit covers; the office makes it in Admin → Memberships.
- *Giving & receipts* — payment history, printable receipts, a yearly giving statement (donations
  only), and *Stop this monthly gift*. Receipts and statements are always in English (official
  records); everything around them is translated.
- *My RSVPs* — upcoming RSVPs, with cancel.

**RSVPs:** switched on per event in Admin → Events (*Members can RSVP*, optional limit in people per
date). Signed-in members pick a date and party size (1–10); the limit can't be exceeded even by two
people at once. Admin → Events → an event lists who's coming per date.

**Search** (`/search`, the header's magnifier): pages, Services/Assistance cards, upcoming events and
approved directory listings. It matches in the visitor's language *and* English, ignores case, accents
and Arabic-script spelling variants (ي/ی, ك/ک, short vowels, Persian digits), and highlights matches.

## Site text, settings and media (admin)

- **Site text** (Content editor): every built-in text — headings, buttons, paragraphs, form messages,
  emails — in all five languages, searchable by the words on the page. Edits are stored in the
  database (`MessageOverride`) on top of `messages/<lang>.json`; clearing a box or *Reset* brings the
  built-in text back. Placeholders such as `{name}` must stay. Edits show at once on this server and
  within 15 seconds on others.
- **Settings** (Super admin): organization name, address, phones, public email, EIN (printed on
  receipts once set), the office inbox for notifications, the site-wide re-subscribe bar and the
  Donate page's default. Blank = the value from `.env`.
- **Media library** (Content editor): upload JPEG/PNG/WebP photos (≤ 5 MB, type checked from the
  file itself) with a description in each language for screen readers, then choose which photo shows
  in each place: the logo and the four About Us photos. A photo in use can't be deleted.

## Bug reports

Anyone can report a problem with the website at **/report-a-problem** — linked as “Report a problem”
at the bottom of every page, which also records the page they were on. The form (5 languages) asks
what went wrong, the type of problem, the page, what happened, steps to see it, what they expected,
how much it affects them, up to 3 screenshots or PDFs (5 MB each, 10 MB in all; checked by their
content, not their name), and optionally a name and email. Device details (browser, screen size,
site language) and the signed-in account are captured automatically. Spam protection: honeypot,
timer and 5 reports per hour per connection.

**Admin → Bugs** is the ticket system:

| Status | Meaning | Who sets it |
|---|---|---|
| Needs triage | New report, nobody has looked yet | (automatic) |
| Triaged | Area, priority and owner set | Super admin — automatic once priority + owner are saved |
| In progress | The owner is working on it | Owner or super admin |
| Waiting for reporter | Needs more information from the reporter | Owner or super admin |
| Fixed — check it | Fix is live; check it and close | Owner or super admin |
| Closed / Won't fix / Can't reproduce / Duplicate | Done | Super admin (owners may also set Can't reproduce) |

- **Triage** (super admins): the **area** is guessed from the page (Prayer times, Events, Donations
  and payments, Membership, Directory, Sign-in and account, Text/translations/photos, Admin, Other);
  the **priority** is suggested from the reporter's answers; the **owner** defaults to the area's owner
  (Admin → Bugs → Area owners). Priorities set the due date: **P1** critical — 1 day, **P2** high —
  3 days, **P3** normal — 14 days, **P4** low — none. Overdue bugs are flagged in the list.
- **Every admin** sees the Bugs section, gets their own **Mine** tab, can comment on any bug and can
  move the bugs they own through the statuses above. The dashboard shows untriaged bugs (super
  admins) or your open bugs (everyone else).
- **Timeline:** every report keeps its history — comments, replies to the reporter and each change
  (with who and when); changes are also in the activity log.
- **Emails:** the **bug reports inbox** (Admin → Settings; `it_support@brmcc.org` by default) and all super admins get each new report; the owner is emailed when a bug is assigned; the
  reporter gets a reference number (BUG-0001), any reply written to them, and — when ticked — a note
  when it's fixed, closed or needs their input, in the language they used. Their replies go to the
  office inbox. The bug reports inbox also gets a labelled copy (“[Copy · BUG-0007] …”) of every email
  sent to a reporter.
- **Duplicates** are closed with a link to the original; **Delete** (super admins) removes spam and
  its files for good.
- **Languages:** the form, its messages and the reporter's emails are in the visitor's language.
  The choices (type of problem, impact) are saved as codes and shown in English in admin; the text
  the reporter types is stored exactly as written (not translated) and shown with the site language
  it came from.
- **Privacy:** attachments are private — served only to signed-in admins at `/admin/bugs/files/…`,
  never cached, PDFs downloaded rather than opened. Reporters are asked not to include passwords or
  card numbers.

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
  attempts; it is refused when `APP_ENV=production`, where Clerk takes over (see GO_LIVE.md).

### Prayer-times source

Admin → Prayer times → *Iqamah rules, Jumu'ah & settings* chooses where daily times come from:
**Built-in** (calculated + overrides) or an external provider. **Masjidi** is listed but unavailable
until Masjidi provides API access; if a selected provider fails, the site falls back to the built-in
times. Adding a provider = one adapter in `src/lib/prayer/sources/`.

## Settings

Everything that differs between local and production is an environment variable —
see [`render.yaml`](render.yaml) for the full, commented list (and `src/lib/env.ts` for defaults).
No env files are committed; hosted settings are entered in Render's dashboard.
Key switches: `APP_ENV`, `AUTH_PROVIDER` (dev → clerk), `PAYMENT_PROVIDER` (mock → stripe),
`MAIL_TRANSPORT` (smtp/Mailpit → provider), `STORAGE_DRIVER` (local → s3).

## Site theme

The public site has two themes. Which one is live is **one line** in
[`src/site-theme.ts`](src/site-theme.ts):

```ts
export const SITE_THEME: "current" | "warm" = "current";
```

- `"current"` — the default theme, the one we go live with.
- `"warm"` — the backup theme "Warm and people-first": cream and maroon, rounded cards, Nunito fonts
  and its own Home layout (today's prayers card, photo tiles, upcoming and weekly events, New BMCC
  banner). Other pages keep their layout and take the theme's colours, fonts and corners.

Change the line, commit and deploy. The admin portal is not themed.

To compare the two without changing the live theme, set `THEME_PREVIEW=1` in `.env` and restart:
a **Theme preview** picker appears at the bottom right of the site (remembered per browser). Leave
`THEME_PREVIEW` unset in production.

The theme's colours live in [`src/app/(site)/themes.css`](src/app/(site)/themes.css) (it re-points the
design tokens from `globals.css`); its Home layout is in `src/app/(site)/_themes/`.

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

The site is **one Docker image** (Next.js standalone server, port 3000) plus services you rent:
Postgres, file storage, an email provider, Clerk (sign-in) and Stripe (payments). Every setting is
an environment variable, so the same image runs anywhere containers run (Render, Railway, Fly.io,
DigitalOcean App Platform, AWS App Runner/ECS, a VPS with Docker…). [GO_LIVE.md](GO_LIVE.md) lists
what BMCC must decide or supply first.

### Render (branch `render`)

`render.yaml` is a Render Blueprint: Render → **New → Blueprint** → this repo, branch `render`.
It creates the Docker web service (`bmcc-website`, health check `/api/health`, migrations applied on
every start) and Postgres 17 (`bmcc-db`, private network only). Render asks once for every value marked
`sync: false` (Clerk, SMTP, R2 storage, Stripe…); change them later under the service's **Environment**
tab. Values whose names start with `NEXT_PUBLIC_` (and `SERVER_ACTIONS_ALLOWED_ORIGINS`) are read at
**build** time, so changing them needs a redeploy, not just a restart. The Blueprint starts as
`APP_ENV=staging` with the test checkout; switch the items marked GO-LIVE at launch.

### 1. Put the code on GitHub

Create a **private** repository and push this folder (`.env`, uploads, test sessions and local data
are ignored). The workflow in `.github/workflows/ci.yml` then runs on every push: type check, lint,
unit tests, production build, all browser tests (against throwaway Postgres + Mailpit), and the
Docker build. Keep `main` protected so only changes with a green run are deployed.

### 2. Create the services

| Service | What to set up | Settings |
|---|---|---|
| Postgres 17 | Managed database with daily backups and point-in-time restore | `DATABASE_URL` |
| File storage | An S3-compatible bucket (AWS S3, Cloudflare R2, DigitalOcean Spaces) for event photos, the media library and uploaded timetables | `STORAGE_DRIVER=s3`, `S3_*` |
| Email | Resend, Postmark or any SMTP relay; verify brmcc.org (SPF, DKIM, DMARC) | `MAIL_TRANSPORT`, `MAIL_PROVIDER_API_KEY` or `SMTP_*`, `MAIL_FROM`, `MAIL_REPLY_TO` |
| Clerk | Production instance for brmcc.org (Clerk → *Go to prod*), Google OAuth client | `AUTH_PROVIDER=clerk`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET` |
| Stripe | Live account, two membership prices, webhook (the Stripe adapter is a go-live task) | `PAYMENT_PROVIDER=stripe`, `STRIPE_*` |

### 3. Production settings

Start from [`render.yaml`](render.yaml); anything not listed keeps its default. Never commit these.

```
APP_ENV=production
APP_URL=https://brmcc.org
ADMIN_HOST=admin.brmcc.org
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=<openssl rand -base64 32>
DATABASE_URL=postgresql://…?sslmode=require
AUTH_PROVIDER=clerk            # plus the Clerk keys (pk_live_/sk_live_)
PAYMENT_PROVIDER=stripe        # plus the Stripe keys and price ids
MAIL_TRANSPORT=resend          # or postmark / smtp, plus its key or SMTP_*
STORAGE_DRIVER=s3              # plus S3_*
# THEME_PREVIEW               # leave unset: the live theme is set in src/site-theme.ts
```

The app refuses to start in production with the local test sign-in, mock payments or Clerk
development keys, and the seed script refuses to run — so test data can't reach the live site.
Contact details, EIN, the office inbox and the site switches are then set in **Admin → Settings**.

### 4. Run it

- Image: build from the `Dockerfile` (or let the host build from the GitHub repo). The container
  **applies pending database migrations on start**, then serves on port **3000**.
- Health check: `GET /api/health` (also used by the image's own `HEALTHCHECK`).
- Put it behind HTTPS. The proxy must set `X-Forwarded-For` (visitor IP for rate limits) and
  `Host` unchanged (the admin host check uses it).
- DNS: `brmcc.org` (and `www`) and `admin.brmcc.org` point to the app; add the records Clerk lists.
- More than one instance is fine: set `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` (same value everywhere).
  Site-text, settings and photo changes reach other instances within 15 seconds.

### 5. First day

1. **First Super admin** — from a checkout of this repository on a trusted computer, with
   `DATABASE_URL` pointing at production: `npm run admin:create -- you@brmcc.org "Your Name"`, then
   sign in at `https://admin.brmcc.org/admin/login?mode=sign-up` with that email. Invite everyone
   else from Admin → Admin users.
2. **Directory listings** — copy the vetted listings from the local database once:
   ```bash
   pg_dump --data-only --table='"DirectoryListing"' "$LOCAL_DATABASE_URL" > listings.sql
   psql "$PRODUCTION_DATABASE_URL" -f listings.sql
   ```
   (Delete `listings.sql` afterwards — it contains contact details.)
3. **Photos** — photos are not in the repository (`uploads/` is ignored), so upload them again in
   Admin → Media library on the live site: the logo, the current General photos (Eid, Jumu'ah) and
   the land photos into the **New BMCC project** collection. Old photos of the previous building go
   into **Archive** (never shown) or are left out. Then pick the Home, About Us and New BMCC photos
   in the "Where photos appear" section, and add photos to events.
4. **Content** — Admin → Settings, Prayer times (method, coordinates, Iqamah rules, Jumu'ah),
   Events, Announcements, and Admin → New BMCC project (goal, amount raised offline, updates).
5. **Smoke test** — a real low-value donation and a membership sign-up end to end, then refund them;
   the contact form, a mailing-list sign-up and its confirmation email; sign-in with email and Google.
6. **Monitoring** — an uptime check on `/api/health`, and alerts from the database and email provider.

### Updating the live site

Merge to `main` → CI passes → the host deploys the new image → migrations run on start. To roll
back, redeploy the previous image — that's safe when the newer migrations only added things; if a
migration removed or renamed something, restore the database backup taken before the deploy too.
Take a database snapshot before deploying any change that includes a migration.
