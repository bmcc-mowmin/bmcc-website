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
| `PAYMENT_PROVIDER` | `mock` | Clearly labelled test checkout, no real money (`live` = Stripe / PayPal; see Payments) |
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

## Email: Resend

Until this is set, `MAIL_TRANSPORT=off`: nothing is sent and each skipped email is logged.

1. Sign up at resend.com (a BMCC address), **Domains → Add domain** `brmcc.org`.
2. Add the DNS records Resend shows (SPF and DKIM) in Cloudflare (**DNS only**, grey cloud), plus a
   DMARC record if brmcc.org has none, e.g. `_dmarc` TXT `v=DMARC1; p=none; rua=mailto:info@brmcc.org`.
   Wait for Resend to show the domain as verified.
3. **API Keys → Create** (sending access) and set:
   ```
   MAIL_TRANSPORT=resend
   MAIL_PROVIDER_API_KEY=re_…
   MAIL_FROM=BMCC <no-reply@brmcc.org>
   MAIL_REPLY_TO=info@brmcc.org
   CONTACT_INBOX=info@brmcc.org
   ```
Before the domain is verified, Resend only delivers to the account owner's own address.

## Payments: Stripe and PayPal

Card and PayPal details are entered on Stripe's or PayPal's own page; this site never sees them.
`PAYMENT_PROVIDER=live` turns the real providers on, and `PAYMENT_METHODS` chooses which are offered
for each payment type — the Donate and Membership pages show one button per method, main one first:

```
PAYMENT_PROVIDER=live
PAYMENT_METHODS=donation:stripe,paypal;donation_monthly:stripe;dues:stripe,paypal
```

Types: `donation` (one-time gift), `donation_monthly`, `dues` (membership, monthly or yearly).
Methods: `stripe`, `paypal`. Use test/sandbox credentials while `APP_ENV=staging`.

**Stripe** — BMCC uses a separate Stripe account per purpose. `STRIPE_ACCOUNT_MAP` says which account
takes membership dues (`dues`) and each donation fund (`new-bmcc`, `masjid-membership`,
`construct-run`, `sadaqah-zakat`, `zakat-fitr`); each account name then has its own key:

```
STRIPE_ACCOUNT_MAP=dues:operations;masjid-membership:operations;sadaqah-zakat:zakah;zakat-fitr:zakah;new-bmcc:construction;construct-run:building
STRIPE_SECRET_KEY_OPERATIONS=sk_test_…
STRIPE_SECRET_KEY_ZAKAH=sk_test_…
STRIPE_SECRET_KEY_CONSTRUCTION=sk_test_…
STRIPE_SECRET_KEY_BUILDING=sk_test_…
```

Anything not in the map uses `STRIPE_SECRET_KEY` (and with no map, that one key takes everything).
Keys: each account's Developers → API keys (test mode on Render). No products or prices need creating.

Webhooks — in **each** account, Developers → Webhooks → **Add endpoint**
`https://<site>/api/webhooks/stripe/<account>` (e.g. `/api/webhooks/stripe/zakah`; the unmapped
account uses `/api/webhooks/stripe`) with events `checkout.session.completed`,
`checkout.session.async_payment_succeeded`, `invoice.paid`, `invoice.payment_failed`,
`customer.subscription.deleted`. Put each signing secret in `STRIPE_WEBHOOK_SECRET_<ACCOUNT>`
(e.g. `STRIPE_WEBHOOK_SECRET_ZAKAH=whsec_…`). Without them, payments still record when people return
from Stripe, but renewals, failed renewals and cancellations made in Stripe don't.

**PayPal** (developer.paypal.com → Apps & Credentials, Sandbox):
1. Add `PAYPAL_ENV=sandbox`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`.
2. If PayPal takes monthly gifts or dues, create the subscription plans once (from any checkout of
   this branch, e.g. the Pi) and add the two printed settings:
   ```
   PAYPAL_ENV=sandbox PAYPAL_CLIENT_ID=… PAYPAL_CLIENT_SECRET=… npm run paypal:setup
   # → PAYPAL_PLAN_MONTHLY=P-…  PAYPAL_PLAN_YEARLY=P-…
   ```
3. Your app → **Webhooks → Add webhook** `https://<site>/api/webhooks/paypal` with events
   `PAYMENT.CAPTURE.COMPLETED`, `BILLING.SUBSCRIPTION.ACTIVATED`, `PAYMENT.SALE.COMPLETED`,
   `BILLING.SUBSCRIPTION.PAYMENT.FAILED`, `BILLING.SUBSCRIPTION.SUSPENDED`,
   `BILLING.SUBSCRIPTION.CANCELLED`, `BILLING.SUBSCRIPTION.EXPIRED`. Put its Webhook ID in
   `PAYPAL_WEBHOOK_ID`.
4. Test with a sandbox **personal** account (Testing Tools → Sandbox Accounts).

These settings are read at runtime: save them and Render restarts the service (no rebuild needed).
The app refuses to start if a method in `PAYMENT_METHODS` is missing its credentials, and in
production it requires live keys (`sk_live_`, `PAYPAL_ENV=live`) and every webhook secret.

## Mailing list: Constant Contact

From Constant Contact's Sign-up Forms → the form → Inline: the Universal Code's `_ctct_m` value and
the Inline Code's `data-form-id`:

```
CONSTANT_CONTACT_ACCOUNT=<_ctct_m value>
CONSTANT_CONTACT_FORM_ID=<data-form-id>
```

The "Stay Connected" band on Home then shows that form, and the re-subscribe bar's button scrolls to
it. Read at runtime (restart, no rebuild). Blank = the site's own sign-up form.

## Before launch (GO-LIVE)

| Area | Change to | Also set |
|---|---|---|
| Environment | `APP_ENV=production`, `APP_URL=https://brmcc.org` | `ADMIN_HOST=admin.brmcc.org`, `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` (`openssl rand -base64 32`) |
| Sign-in | Clerk production keys (`pk_live_` / `sk_live_`) | `CLERK_WEBHOOK_SECRET` |
| Payments | `PAYMENT_PROVIDER=live` with live Stripe/PayPal credentials (see Payments below) | each `STRIPE_SECRET_KEY_<ACCOUNT>` (`sk_live_`) and `STRIPE_WEBHOOK_SECRET_<ACCOUNT>`, `PAYPAL_ENV=live`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `PAYPAL_PLAN_MONTHLY`, `PAYPAL_PLAN_YEARLY` |
| Email | `MAIL_TRANSPORT=smtp` (or `resend` / `postmark`) | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` (or `MAIL_PROVIDER_API_KEY`); `MAIL_FROM`, `MAIL_REPLY_TO`, `CONTACT_INBOX` |
| Files | `STORAGE_DRIVER=s3` (Cloudflare R2) | `S3_ENDPOINT` (`https://<account-id>.r2.cloudflarestorage.com`), `S3_REGION=auto`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, optional `S3_PUBLIC_URL` |
| Spam protection | Cloudflare Turnstile (optional) | `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` |
| Plans | Paid web instance (no sleeping) and paid database (backups) | — |

Other optional settings, all with built-in defaults (see `src/lib/env.ts`): `ORG_LEGAL_NAME`, `ORG_EIN`,
`ORG_ADDRESS`, `ORG_PHONE`, `ORG_PHONE_TEL`, `ORG_EMAIL` (also editable in Admin → Settings),
`MASJID_TIMEZONE`, `MASJID_LAT`, `MASJID_LNG`, `RATE_LIMIT_WINDOW_SEC`, `RATE_LIMIT_MAX`,
`DEFAULT_DONATION_FREQUENCY`, `GOOGLE_MAPS_EMBED_API_KEY`, `SHOW_RESUB_BAR_SITEWIDE`, `LOG_LEVEL`,
`SERVER_ACTIONS_ALLOWED_ORIGINS` (extra hostnames a proxy or tunnel serves the site from).
