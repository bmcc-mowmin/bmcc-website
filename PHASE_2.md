# Phase 2 — features after launch

Ideas agreed for after the website goes live. Each item lists what it would do, what it needs, and
the decisions BMCC has to make first. Nothing here is built yet. Go-live work stays in
[GO_LIVE.md](GO_LIVE.md).

| # | Feature | Status |
|---|---------|--------|
| 1 | Phone number verification via Clerk | Planned |
| 2 | iOS and Android app | Planned |
| 3 | Pay by scanning a QR code (sign in and pay) | Planned |
| 4 | More to add later | — |

---

## 1. Phone number verification via Clerk

**What it does.** When someone creates a website account, Clerk texts a code to their phone to
confirm the number. Members could then also sign in with a text code instead of email, which may
suit members who don't check email often.

**What's already in place.** The Become a Member form already requires a phone number and email
for the main member (checked in the browser and on the server). Accounts link to member and donor
records by verified email.

**What it needs.**
- Clerk **Pro plan** or higher. SMS is not on the free plan. About $20–25/month, plus about $0.01
  per text to US/Canada numbers (international at local rates). Check current prices on
  [clerk.com/pricing](https://clerk.com/pricing).
- In the Clerk dashboard: turn on **Phone number**, required at sign-up and verified by SMS code.
  Optionally allow **sign-in with phone**.
- On the website: still require email at sign-up, so accounts keep linking to member records by
  email. Optionally also match by phone number against member records, which works only if the
  member list's phone numbers are accurate.
- Update the sign-in page's "not found → Become a Member" check to accept a phone number.
- Can be tried for free in the development setup first, using Clerk's test numbers (code `424242`).

**Decisions for BMCC.**
- [ ] Approve the Clerk Pro subscription and the per-text cost.
- [ ] Phone required for every account, or optional?
- [ ] Allow sign-in by text code, or use phone for verification only?

---

## 2. iOS and Android app

**What it does.** A BMCC app on the App Store and Google Play: prayer times, Jumu'ah, events,
announcements, giving and membership, and the member's account. The big gain over the website is
**push notifications**: prayer-time and iqamah reminders, Jumu'ah and Eid changes, event reminders
and urgent announcements.

**What's already in place.** The website already has all the data and logic the app needs:
prayer times, events, announcements, giving, membership, the account area and the five languages
(including right-to-left Dari, Urdu and Pashto). Clerk has mobile sign-in kits, so members would use
the same account in the app and on the website.

**How it could be built (to decide).**
- **Option A — one shared app for both phones** (React Native / Expo). One codebase for iOS and
  Android. It talks to the website through a small set of new API endpoints. Recommended.
- **Option B — installable website first** (a "progressive web app"). Members add the website to
  their home screen; quickest and cheapest, but it isn't in the app stores and notifications on
  iPhone are more limited. Could be a stepping stone to Option A.

**What it needs.**
- Apple Developer account ($99/year) and Google Play developer account ($25 once), registered to
  BMCC as an organization.
- A public read API on the website (prayer times, events, announcements) and signed-in endpoints
  for the account, giving history and RSVPs.
- A push-notification service and an **Admin → Notifications** screen to send announcements,
  with per-member preferences (which reminders, which prayers).
- App Store / Google Play listings: screenshots, privacy policy and data-use answers.
- Giving inside the app has to follow store rules. Donations to a registered nonprofit are
  generally allowed but often handled through the browser or Apple Pay / Google Pay. Confirm current
  rules before building.

**Decisions for BMCC.**
- [ ] Option A, Option B, or B first then A?
- [ ] Which notifications at launch (adhan/iqamah reminders, Jumu'ah, events, announcements)?
- [ ] Who in the committee approves and sends push announcements?
- [ ] Should the app also show the Monthly prayer timetable PDF and the Community Directory?

---

## 3. Pay by scanning a QR code (sign in and pay)

**What it does.** QR codes printed at the masjid (donation boxes, the Jumu'ah area, the school
office, event tables, flyers, the New BMCC project board). Scanning one with a phone camera opens
the BMCC website straight to a ready-filled giving page, for example the New BMCC fund, Zakat, or
an event fee. The person pays in a few taps. If they're signed in, the gift is recorded on their
account and in their giving history and tax receipt.

**What's already in place.** The Donate page already accepts the fund and frequency in the link
(e.g. `/donate?fund=new-bmcc&frequency=monthly`). Each QR code would just be one of these links.

**What it needs.**
- **Stripe live** (from GO_LIVE.md) with **Apple Pay and Google Pay** turned on, so paying takes
  one tap with no card typing.
- An **Admin → QR codes** screen: pick a fund (and optionally a suggested amount, campaign or
  event), and download a print-ready QR code (PNG/PDF) with the BMCC logo and a short label.
- Tracking: each QR code gets its own tag, so the treasurer can see how much came in from each
  one (e.g. "Jumu'ah box" vs "Eid flyer").
- Sign-in kept optional: guests can give without an account (as today), with a "sign in to add
  this to your giving history" link. Making sign-in mandatory would cost donations.
- Optional: a "Pay membership dues" QR code that opens the member's account to pay or renew.
- Optional later: a tap-to-pay card reader at events (Stripe Terminal). This is separate hardware
  and setup.

**Decisions for BMCC.**
- [ ] Which places and funds get QR codes first?
- [ ] Suggested amounts on any codes (e.g. Zakat al-Fitr per person)?
- [ ] Sign-in optional (recommended) or required to pay by QR?

---

## 4. More to add later

Add new ideas here as they come up, with a line on what they would do.

- …
