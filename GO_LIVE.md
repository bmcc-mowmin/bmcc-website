# Production go-live checklist

Everything that must be done or supplied before the site goes live. Items are added as each
build phase lands. Tick them off in the pull request that prepares the launch.

## Payments (Stripe)

- [ ] Create BMCC's Stripe account (501(c)(3) nonprofit), verify the organization and bank account.
- [ ] Create the membership Products/Prices ($100/month, $1,000/year) and set
      `STRIPE_PRICE_MEMBERSHIP_MONTHLY` / `STRIPE_PRICE_MEMBERSHIP_YEARLY`.
- [ ] Set `PAYMENT_PROVIDER=stripe`, `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
- [ ] Register the webhook endpoint (added in phase 5) and set `STRIPE_WEBHOOK_SECRET`.
- [ ] Run one real low-value donation and one membership signup end to end, then refund them.
- [ ] Decide whether Zelle / PayPal / Zakat al-Fitr per-person tiers will be offered (Gap Analysis).

## Tax receipts

- [ ] Confirm BMCC's legal name (`ORG_LEGAL_NAME`) and EIN (`ORG_EIN`).
- [ ] Accountant approves the donation receipt wording (IRS written acknowledgment,
      "no goods or services were provided").
- [ ] Accountant decides how membership dues are receipted — dues come with a benefit
      (Funeral Services Benefit), so they may not be fully deductible.

## Accounts and sign-in (Clerk)

- [ ] Create the Clerk production instance and set `AUTH_PROVIDER=clerk`,
      `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`.
- [ ] Create the real admin accounts. The seeded test accounts never exist in production
      (the seed refuses to run and dev login is disabled when `APP_ENV=production`).

## Email

- [ ] Choose the provider, verify the sending domain (SPF, DKIM, DMARC) for `MAIL_FROM`.
- [ ] Set `MAIL_TRANSPORT`, `MAIL_PROVIDER_API_KEY` (or SMTP settings), `CONTACT_INBOX`.

## Content from BMCC (README "Content blockers")

- [ ] Restore the real Community Directory listings from the backup Google Sheet
      (local sample data is fake). Fix categories and add missing addresses.
- [ ] Real prayer timetable / Iqamah offsets (Hanafi Asr) and Jumu'ah times.
- [ ] Real event dates and photos.
- [ ] Food pantry hours ("Saturday 10 AM – 12 PM" is a placeholder in announcements).
- [ ] Photos for About Us and the event cards (striped placeholders today).
- [ ] Logo as SVG or high-resolution PNG (current one is 216×102 px).
- [ ] Vetted human translations for Dari, Urdu and Pashto (all current non-English text is
      machine-generated). Arabic is out of scope for launch.
- [ ] Decide whether the "Stay Connected" form stays after the re-subscribe campaign.

## Infrastructure

- [ ] Managed Postgres with automated backups; set `DATABASE_URL`.
- [ ] File storage bucket; set `STORAGE_DRIVER=s3` and `S3_*`.
- [ ] `APP_ENV=production`, `APP_URL=https://…` (the real domain), HTTPS certificate.
- [ ] Uptime monitor on `/api/health`.
- [ ] Optional: Cloudflare Turnstile keys; Google Maps Embed API key.
