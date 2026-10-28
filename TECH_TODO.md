# Technical to-do

Engineering follow-ups for the BMCC website. Launch decisions and content sign-offs live in
[GO_LIVE.md](GO_LIVE.md); Render setup is in [RENDER.md](RENDER.md). Tick items off in the pull
request that does them.

## Code and security review (render branch, Oct 27, 2026)

Overall the code is in good shape: every admin page, server action and CSV export checks the
person's section; public forms have a honeypot, minimum fill time and Postgres-backed rate limits;
uploads are checked by their actual bytes (JPEG/PNG/WebP, `%PDF-`); storage keys can't contain
paths from users; CSV exports neutralize spreadsheet formulas; email HTML escapes user text; no raw
SQL or `dangerouslySetInnerHTML`; the Clerk webhook verifies signatures; production refuses dev
sign-in, mock payments and Clerk development keys. Type check, lint and the 35 unit tests pass.

Fix before launch, most urgent first:

- [x] **P1 — Upgrade Next.js 16.3.6 → 16.4.3.** Done Oct 27: `next` and `eslint-config-next`
      16.4.3, which fixes the critical advisories (unauthenticated remote code execution in the image
      optimization API, [GHSA-2464-fhr4-w9xw](https://github.com/advisories/GHSA-2464-fhr4-w9xw), and
      others). Type check, lint, 35 unit tests, production build and 30 of 31 browser tests (excluding
      those that need Mailpit) pass; the remaining failure is a test bug, below.
- [x] **P1 — Other vulnerable dependencies.** Done Oct 27: `zod` ^4.6.7, `nodemailer` ^10.2.1 and
      the transitive `source-map-js` and `fast-uri` updated; `npm audit` reports 0 vulnerabilities.
- [ ] **P1 — Rotate the Render database password.** The connection URL was shared in a chat; the
      external address accepts connections from anywhere. After rotating, update `DATABASE_URL` in
      Render and delete `~/.render_db_url` on the Pi. Consider restricting the database's external
      access to known IPs.
- [ ] **P2 — Visitor IP can be spoofed, weakening rate limits.** `src/lib/request.ts` trusts the
      *first* `X-Forwarded-For` entry, which the visitor can set themselves (Render and Cloudflare
      append to it). Use `CF-Connecting-IP` when behind Cloudflare, or the entry added by the trusted
      proxy (the right-most one), so sign-in and form limits can't be bypassed.
- [ ] **P2 — Open redirect in `safeNext`** (`src/lib/auth/password-login.ts`, and the same check in
      `src/app/checkout/[id]/actions.ts`). `/\evil.example` passes (`startsWith("/")`, not `//`),
      and browsers treat it as `//evil.example`. Also reject a backslash in the second character, or
      parse with `new URL(next, APP_URL)` and require the same origin.
- [ ] **P2 — Security headers for the public site.** Only admin pages get `X-Frame-Options`,
      `noindex` and no-cache. Add site-wide `Strict-Transport-Security`, `X-Content-Type-Options:
      nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN`
      (or CSP `frame-ancestors`) in `next.config.ts` `headers()` or a Cloudflare rule. A full
      Content-Security-Policy must allow Clerk, Turnstile, Stripe/PayPal and Constant Contact.
- [ ] **P2 — Staging test tools are public.** With `PAYMENT_PROVIDER=mock`, anyone with the Render
      address can complete fake checkouts, which create receipts, active memberships and emails
      (when email is on). Fine for testing; clear that data before launch (see the Clerk-only
      section) and don't share the staging address publicly.
- [ ] **P3 — Mock checkout takes its success URL from the form** instead of the stored checkout
      session; read it from the session (goes away with the real Stripe adapter).
- [ ] **P3 — Directory CSV export isn't written to the activity log** (the subscriber export is).
- [ ] **P3 — `RateLimitBucket` rows are never cleaned up**; add a periodic delete of expired rows
      (or delete on read) so the table doesn't grow forever.

Test suite:

- [ ] **Browser test bug:** `e2e/new-bmcc.spec.ts` "collections: a land photo shows only on the
      project page" fails on a freshly seeded database. With no hero photo set, the New BMCC page
      uses the first land photo as the hero and leaves it out of "The land", so the test's only
      photo lands in the hero. Make the test set a hero photo (or upload two land photos) first.
- [ ] The browser tests find some elements by CSS-module class names (`[class*=EventsCarousel]`),
      which only exist in `npm run dev`. Use roles or `data-testid` so they also run against a
      production build.
- [ ] The tests that need Mailpit (sign-in links, contact, directory, mailing list, payments,
      member, portal) weren't re-run after the upgrade; run the full suite once with Mailpit
      (`npm run db:up`, then `npm run test:e2e`).

## Placeholders and stubs in the code

| Where | What | Replace with |
|---|---|---|
| `src/lib/payments/provider.ts` | Stripe provider throws "connected at go-live" | Stripe adapter (Payments section) |
| `/checkout/[id]`, Admin → Memberships test tools | Mock checkout and simulated renewals (mock provider only) | Stripe / PayPal; tools disappear automatically |
| `src/lib/prayer/sources/` | Masjidi source listed but `available: false` | Masjidi adapter once they give API access |
| `MAIL_TRANSPORT=off` (Render) | Emails are logged, not sent | Real email provider (Hosting section) |
| `STORAGE_DRIVER=local` (Render) | Uploads wiped on each deploy | Cloudflare R2 |
| `AUTH_PROVIDER=dev` code path | Test sign-in, sign-in links, set-password | Remove after launch (Clerk-only section) |
| Seed data (`prisma/seed.ts`) | Fake directory listings, `@bmcc.local` accounts, sample events, announcements, a sample membership and payments | Delete from the live database; real content in admin |
| About Us / New BMCC / events | "Placeholder" photo slots | Real photos in Admin → Media library |
| `messages/dari.json`, `urdu.json`, `pashto.json`, `spanish.json` | Machine-generated translations | Vetted translations (GO_LIVE.md) |
| `ORG_EIN` | Blank, so not printed on receipts | Confirmed EIN in Admin → Settings |
| Theme preview (`THEME_PREVIEW=1`) | Theme picker for comparing designs | Leave unset in production |

Content placeholders (food pantry hours, prayer schedule, membership policy text, logo) are tracked
in [GO_LIVE.md](GO_LIVE.md) under "Content from BMCC".

## Sign-in: Clerk only (no credentials stored by BMCC)

Clerk owns identity (passwords, email codes, Google sign-in, sessions). BMCC's `User` table stays as
the person's record (name, email, roles, `clerkUserId`) that memberships, payments, RSVPs, the
activity log and directory approvals hang off. The verified email links a new Clerk login to an
existing member, donor or invited admin.

- [ ] Before launch: delete the seeded `@bmcc.local` test users (and their sample households,
      payments and RSVPs) from the live database.
- [ ] Set up the Clerk webhook (`/api/webhooks/clerk`, events `user.updated`, `user.deleted`) and set
      `CLERK_WEBHOOK_SECRET`, so email changes and deleted accounts in Clerk update the `User` table.
- [ ] Clerk production instance for brmcc.org (`pk_live_` / `sk_live_`), BMCC's own Google OAuth
      client, rename the Clerk app to "BMCC". Move ownership of the Clerk application to a BMCC
      account (it is currently under the original developer's account).
- [ ] After launch: remove the built-in "dev" sign-in, which is only for local testing —
      `AUTH_PROVIDER=dev`, `src/lib/auth/password-login.ts`, the email sign-in link
      (`src/lib/auth/sign-in-link.ts`) and the admin set-password flow. Then a migration that drops
      `User.passwordHash` and the unused `AuthToken` purposes, and update `scripts/create-admin.ts`
      and the seed. Local development and the browser tests would then use a Clerk development
      instance.

## Payments

- [ ] Stripe adapter in `src/lib/payments/provider.ts`: Checkout Sessions (one-time donation =
      payment mode; monthly donation and dues = subscription mode) with the site's payment reference
      in metadata; cancel the subscription from "Stop this monthly gift" and membership cancel.
- [ ] Stripe webhook route `/api/webhooks/stripe` (verify signature): `checkout.session.completed`,
      `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted` → the provider-neutral
      events in `src/lib/payments/types.ts`.
- [ ] PayPal one-time donations: JS SDK button on Donate, server-side create + capture order,
      webhook `/api/webhooks/paypal` (`PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.REFUNDED`).
      New settings `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`.
- [ ] Let the Donate page offer both providers (today one `PAYMENT_PROVIDER` is used for everything).
- [ ] Later: PayPal monthly giving (Subscriptions API).

## Mailing list: Constant Contact

- [ ] Load Constant Contact's Universal Code once in `src/app/(site)/layout.tsx` (`next/script`).
- [ ] Replace the forms in the re-subscribe bar and the "Stay Connected" band with the Inline Code.
- [ ] Retire the site's own sign-up flow (confirmation emails, `/subscribe`, `/unsubscribe`); keep
      Admin → Subscribers read-only as history; import confirmed subscribers into Constant Contact.
- [ ] If a Content-Security-Policy is added, allow Constant Contact and Google reCAPTCHA.

## Hosting (Render) — temporary settings to replace before launch

- [ ] Email: `MAIL_TRANSPORT=off` → `smtp`, `resend` or `postmark`; verify brmcc.org (SPF, DKIM,
      DMARC) with the provider. Receipts, contact replies and admin invites need it.
- [ ] Files: `STORAGE_DRIVER=local` (wiped on every deploy) → `s3` with a Cloudflare R2 bucket;
      re-upload photos.
- [ ] Upgrade the free web instance (sleeps when idle) and the free database (expires after 30 days,
      no backups) to paid plans, keeping the data.
- [ ] `APP_ENV=production`, `APP_URL=https://brmcc.org`, `ADMIN_HOST=admin.brmcc.org`,
      `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`.
- [ ] Remove the copy of the database URL kept on the Raspberry Pi (`~/.render_db_url`) when no
      longer needed.

## Cloudflare

- [ ] Turnstile keys (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`), then redeploy
      (the site key is read at build time).
- [ ] Confirm the real visitor IP reaches the app behind Cloudflare + Render (`X-Forwarded-For`),
      so per-visitor rate limits don't treat everyone as one visitor.
