# Technical to-do

Engineering follow-ups for the BMCC website. Launch decisions and content sign-offs live in
[GO_LIVE.md](GO_LIVE.md); Render setup is in [RENDER.md](RENDER.md). Tick items off in the pull
request that does them.

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
