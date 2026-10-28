# Deploying to Render (Node runtime, free plan)

The `render` branch runs on a Render **Web Service** (Node) with a **Render Postgres** database, both
created by hand in the dashboard. No payment details are needed on the free plan. No env files are
committed: every setting is entered in the service's **Environment** tab and validated at startup by
`src/lib/env.ts`.

## 1. Create the database

Render → **New → Postgres**

| Field | Value |
|---|---|
| Name | `bmcc-db` |
| Database / User | `bmcc` / `bmcc` |
| Region | Oregon (use the same region for the web service) |
| PostgreSQL version | 17 |
| Plan | Free |

When it's ready, copy its **Internal Database URL**.

## 2. Create the web service

Render → **New → Web Service** → this repository, branch **`render`**

| Field | Value |
|---|---|
| Language | Node |
| Region | Oregon |
| Build command | `npm ci && npm run render:build` |
| Start command | `npm run render:start` |
| Instance type | Free |
| Health check path (Advanced) | `/api/health` |

`render:build` builds the site and copies its static files into the standalone server.
`render:start` applies pending database migrations, then starts the server.

## 3. Environment variables

In the service's **Environment** section, choose **Add from .env** and paste the block below, then fill
in the three blank values.

```
NODE_VERSION=24
HOSTNAME=0.0.0.0
APP_ENV=staging
APP_URL=https://bmcc-website.onrender.com
AUTH_PROVIDER=clerk
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/account
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/account
MAIL_TRANSPORT=off
PAYMENT_PROVIDER=mock
STORAGE_DRIVER=local
NEXT_TELEMETRY_DISABLED=1
CLIENT_IP_HEADER=cf-connecting-ip
DATABASE_URL=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
```

- `DATABASE_URL` = the Internal Database URL from step 1.
- Clerk keys: Clerk dashboard → API keys (development keys, `pk_test_…` / `sk_test_…`, are fine on staging).
- `APP_URL` = the service's real address (shown at the top of its page). If it differs, fix it and redeploy.
- Do **not** set `NODE_ENV`: the build needs the development tools that `npm ci` installs.
- `HOSTNAME=0.0.0.0` makes the server listen on Render's network; Render sets `PORT` itself.
- `CLIENT_IP_HEADER=cf-connecting-ip`: Render's edge is Cloudflare, which sets this header to the visitor's
  real address (visitors can't fake it). Rate limits count per visitor using it.

What the staging values mean:

| Setting | Staging value | Effect |
|---|---|---|
| `APP_ENV` | `staging` | Clerk development keys and the test checkout are allowed |
| `MAIL_TRANSPORT` | `off` | No email is sent; each skipped email is logged |
| `PAYMENT_PROVIDER` | `mock` | Clearly labelled test checkout, no real money |
| `STORAGE_DRIVER` | `local` | Uploaded photos/PDFs are on the service's disk and **wiped on every deploy or restart** |

## 4. Deploy and check

Deploy, then in **Logs** look for `Applying migration …` (first deploy) and `Ready`. Open
`https://<service>.onrender.com/api/health` — it should show `"status":"ok","database":"ok"`.

**First Super admin** (needs Clerk): from any computer with a checkout of this branch and Node 24
(the Raspberry Pi works), using the database's **External Database URL**:

```
DATABASE_URL='<External Database URL>' APP_URL=https://bmcc-website.onrender.com AUTH_PROVIDER=clerk \
  npm run admin:create -- you@brmcc.org "Your Name"
```

Then sign up at `/admin/login?mode=sign-up` with that email.

## Free plan limits

- The service sleeps after about 15 minutes without visits; the next visit takes up to a minute.
- Uploaded files are lost on every deploy or restart (`STORAGE_DRIVER=local`).
- The free database expires after 30 days and has no backups. Upgrade it in place (same data) before launch.

## Settings that are read at build time

Values whose names start with `NEXT_PUBLIC_`, and `SERVER_ACTIONS_ALLOWED_ORIGINS`, are compiled in
when the site is built. After changing them, use **Manual Deploy → Deploy latest commit**, not just a restart.

## Before launch (GO-LIVE)

| Area | Change to | Also set |
|---|---|---|
| Environment | `APP_ENV=production`, `APP_URL=https://brmcc.org` | `ADMIN_HOST=admin.brmcc.org`, `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` (`openssl rand -base64 32`) |
| Sign-in | Clerk production keys (`pk_live_` / `sk_live_`) | `CLERK_WEBHOOK_SECRET` |
| Payments | `PAYMENT_PROVIDER=stripe` (after the Stripe adapter is built) | `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MEMBERSHIP_MONTHLY`, `STRIPE_PRICE_MEMBERSHIP_YEARLY` |
| Email | `MAIL_TRANSPORT=smtp` (or `resend` / `postmark`) | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` (or `MAIL_PROVIDER_API_KEY`); `MAIL_FROM`, `MAIL_REPLY_TO`, `CONTACT_INBOX` |
| Files | `STORAGE_DRIVER=s3` (Cloudflare R2) | `S3_ENDPOINT` (`https://<account-id>.r2.cloudflarestorage.com`), `S3_REGION=auto`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, optional `S3_PUBLIC_URL` |
| Spam protection | Cloudflare Turnstile (optional) | `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` |
| Plans | Paid web instance (no sleeping) and paid database (backups) | — |

Other optional settings, all with built-in defaults (see `src/lib/env.ts`): `ORG_LEGAL_NAME`, `ORG_EIN`,
`ORG_ADDRESS`, `ORG_PHONE`, `ORG_PHONE_TEL`, `ORG_EMAIL` (also editable in Admin → Settings),
`MASJID_TIMEZONE`, `MASJID_LAT`, `MASJID_LNG`, `RATE_LIMIT_WINDOW_SEC`, `RATE_LIMIT_MAX`,
`DEFAULT_DONATION_FREQUENCY`, `GOOGLE_MAPS_EMBED_API_KEY`, `SHOW_RESUB_BAR_SITEWIDE`, `LOG_LEVEL`,
`SERVER_ACTIONS_ALLOWED_ORIGINS` (extra hostnames a proxy or tunnel serves the site from).
