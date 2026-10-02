# Production go-live checklist

Everything that must be done or supplied before the site goes live. Items are added as each
build phase lands. Tick them off in the pull request that prepares the launch.

## Payments (Stripe)

- [ ] Create BMCC's Stripe account (501(c)(3) nonprofit), verify the organization and bank account.
- [ ] Create the membership Products/Prices ($100/month, $1,000/year) and set
      `STRIPE_PRICE_MEMBERSHIP_MONTHLY` / `STRIPE_PRICE_MEMBERSHIP_YEARLY`.
- [ ] Set `PAYMENT_PROVIDER=stripe`, `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
- [ ] Implement the Stripe adapter in `src/lib/payments/provider.ts` (Checkout Sessions for donations
      and dues; subscriptions for monthly) and the webhook route that maps Stripe events to the
      provider-neutral events in `src/lib/payments/types.ts` — everything else already works with them.
- [ ] Register the webhook endpoint in Stripe and set `STRIPE_WEBHOOK_SECRET`.
- [ ] Run one real low-value donation and one membership signup end to end, then refund them.
- [ ] Decide whether Zelle / PayPal / Zakat al-Fitr per-person tiers will be offered (Gap Analysis).

## Tax receipts

- [ ] Confirm BMCC's legal name (`ORG_LEGAL_NAME`) and EIN (`ORG_EIN`).
- [ ] Accountant approves the donation receipt wording (IRS written acknowledgment,
      "no goods or services were provided").
- [ ] Accountant decides how membership dues are receipted — dues come with a benefit
      (Funeral Services Benefit), so they may not be fully deductible.

## Accounts and sign-in (Clerk)

- [x] Clerk connected (`AUTH_PROVIDER=clerk`): sign-in/sign-up on `/login` and `/sign-up`, admin on
      `/admin/login`; accounts link to BMCC records by verified email. Tested locally with the
      development instance.
- [ ] Sign-in methods (BMCC's choice): **email (code or password) + Google** only. No phone/SMS,
      passkeys or paid add-ons — the app stays on Clerk's free plan.
- [ ] Clerk → *Go to prod*: create the production instance for brmcc.org, add the DNS records Clerk
      lists, set the production keys (`pk_live_`/`sk_live_`; development keys are refused).
- [ ] Google sign-in in production needs BMCC's own Google OAuth client (Google Cloud console),
      entered in Clerk → SSO connections → Google. (Development uses Clerk's shared credentials.)
- [ ] Rename the Clerk application from "My Application" to "BMCC" (shown on the sign-in box).
- [ ] Register the webhook `https://brmcc.org/api/webhooks/clerk` (user.updated, user.deleted) and
      set `CLERK_WEBHOOK_SECRET`.
- [ ] Consider requiring a second factor for staff (authenticator app is a paid Clerk feature).
- [x] With Clerk, anyone can create an account; someone not yet in BMCC's records lands on
      *My account* with "You're not a member yet" and a *Become a Member* link. (The local test
      sign-in's "email not found" message only applies with `AUTH_PROVIDER=dev`.)
- [ ] Decide whether members may add/remove covered people themselves (today: a request the office
      approves, because it changes who the Funeral Services Benefit covers).
- [ ] Create the first Super admin with `npm run admin:create -- email "Name"`; they invite the rest
      from Admin users and assign roles. The seeded test accounts never exist in production
      (the seed refuses to run and dev login is disabled when `APP_ENV=production`).

## Admin portal

- [ ] DNS: point `admin.brmcc.org` at the app, with a TLS certificate; set `ADMIN_HOST=admin.brmcc.org`.
- [ ] Decide who gets which role (Super admin, Content editor, Prayer times manager, Membership
      coordinator, Treasurer).

## Prayer times from Masjidi

- [ ] Ask Masjidi (support@masjidi.app) for API or data-feed access to BMCC's times. When they
      provide it, a Masjidi adapter is added in `src/lib/prayer/sources/` and switched on in admin.
      Until then the built-in calculated times (with admin overrides) are used.

## Email

- [ ] Choose the provider, verify the sending domain (SPF, DKIM, DMARC) for `MAIL_FROM`.
- [ ] Set `MAIL_TRANSPORT`, `MAIL_PROVIDER_API_KEY` (or SMTP settings), `CONTACT_INBOX`.

## Mailing list and contact form

- [ ] Choose the newsletter tool (Mailchimp, Buttondown, Listmonk…). Either import Admin → Subscribers →
      *Export confirmed (CSV)* before each send, or add a small sync to that tool. Every newsletter
      must include the person's unsubscribe link (in the CSV) and BMCC's postal address (CAN-SPAM).
- [ ] Re-subscribe campaign: announce it (Jumu'ah, old list's final email pointing to the site), and
      decide whether to set `SHOW_RESUB_BAR_SITEWIDE=true` for its duration. Retire the old list after.
- [ ] Decide who answers contact messages and whether `CONTACT_INBOX` is info@brmcc.org or a
      ticketing inbox.
- [ ] Optional: Cloudflare Turnstile on the public forms if spam gets past the honeypot + rate limits.

## Content from BMCC (README "Content blockers")

- [ ] Copy the 10 initial directory listings (already imported locally from the vetted sheet) into
      the production database once, as part of the deployment. After that, new listings come only
      from *Submit a Listing*; the sheet is retired. Optionally fill in missing descriptions and
      addresses in Admin → Directory — only listings with an address or city get a map.
- [ ] Decide who receives "new listing to review" emails (currently `CONTACT_INBOX`).
- [ ] Imam confirms the Fajr/Isha calculation method (ISNA by default; Asr is always Hanafi),
      the Iqamah rules, and the Jumu'ah times — all editable in /admin/prayer-times.
- [ ] Set the masjid's exact coordinates in admin (the default is Brentwood's center, 37.93, -121.70).
- [ ] Real event dates and photos.
- [ ] Food pantry hours ("Saturday 10 AM – 12 PM" is a placeholder in announcements).
- [ ] Photos for About Us (Admin → Media library) and the event cards (each event).
- [ ] Logo as a high-resolution PNG (current one is 216×102 px) — upload it in Admin → Media library.
- [ ] Contact details, EIN and office inbox in Admin → Settings.
- [ ] Vetted human translations for Dari, Urdu, Pashto and Spanish (all current non-English text
      is machine-generated). Arabic is out of scope for launch.
- [ ] Decide whether the "Stay Connected" form stays after the re-subscribe campaign.

## Infrastructure

- [ ] Managed Postgres with automated backups; set `DATABASE_URL`.
- [ ] File storage bucket; set `STORAGE_DRIVER=s3` and `S3_*`.
- [ ] `APP_ENV=production`, `APP_URL=https://…` (the real domain), HTTPS certificate.
- [ ] More than one app instance: set `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`; make sure the proxy sets
      `X-Forwarded-For` (used for rate limiting).
- [ ] Uptime monitor on `/api/health`.
- [ ] Optional: Cloudflare Turnstile keys; Google Maps Embed API key.
