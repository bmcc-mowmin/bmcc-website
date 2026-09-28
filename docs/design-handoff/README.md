# Handoff: BMCC Website Redesign — Backend Wiring

## Overview
Public website for the **Brentwood Muslim Community Center (BMCC)**, 7701 Lone Tree Way, Brentwood, CA 94513. It has 11 pages: Home, Prayer Times, Donate, Events, Community Directory, Services, Assistance, Funeral Services, Membership, About Us/Contact, plus a shared Header and Footer. It works in 5 languages, 3 of them right-to-left, and on phones.

The front-end design is signed off. **This handoff covers building the production front end and connecting every form, feed and hard-coded list to a real backend or admin system.**

## About the design files
The files in `design/` are **design references built in HTML**. They are working prototypes that show the intended look and behavior. They are **not** production code to copy directly.

Rebuild them in the target codebase using its own patterns. If there is no codebase yet, choose a suitable framework. A server-rendered or static-first stack such as Next.js, Astro or WordPress with a custom theme fits well, because the site is mostly content with a few forms, and it needs good SEO and fast loading on phones.

To view a prototype, open any `design/*.dc.html` file in a browser. Serve the folder over HTTP, for example with `npx serve design`, because the pages load `i18n.js` as a module. All styling is inline in the markup, and each page's logic sits in a `<script data-dc-script>` class at the bottom of the file.

## Fidelity
The designs are **high-fidelity**: colors, typography, spacing, copy and interactions are final. Rebuild them pixel-accurate.

Content marked "placeholder", "confirm" or "Example schedule" is **not final**. It needs real data from BMCC; see the Content blockers section.

---

## Backend integration map
This is the main work of the handoff. Every item below is currently hard-coded or a no-op in the prototype.

### 1. Prayer times (highest priority — used on 3 surfaces)
| Surface | File | Currently |
|---|---|---|
| Header "Next Prayer" countdown | `Site Header.dc.html` → `PRAYER_SCHEDULE` | Hard-coded 24h times |
| Homepage prayer table | `BMCC Website.dc.html` → `prayerRows` | Hard-coded strings |
| Prayer Times page table and Jumu'ah cards | `Prayer Times.dc.html` → `prayerRows`, `jumuahServices` | Hard-coded strings |

**Requirements**
- Use **one source of truth** for all three.
- Store a daily schedule with an Adhan time and an Iqamah time for each prayer: Fajr, Dhuhr, Asr, Maghrib and Isha. Jumu'ah has a first and a second congregation, each with a khutbah time and a location.
- **Asr uses the Hanafi method**, where an object's shadow is twice its length. If times are calculated rather than entered by an admin, use a library such as `adhan-js` with `Madhab.Hanafi` and Brentwood's coordinates (about 37.93, -121.70). The Iqamah offsets should be admin-editable.
- Admins must be able to **override any single day**, for example for Ramadan, Eid, or daylight-saving changes.
- **Next-prayer logic:** see `nextPrayer()` in the header. Compute it in the **masjid's time zone (`America/Los_Angeles`)**, not the visitor's. On Fridays, Jumu'ah replaces Dhuhr. After Isha, show tomorrow's Fajr with a "(tomorrow)" label. Recompute every 30 seconds.
- **Format times** with `Intl.DateTimeFormat` in the visitor's locale: `en-US`, `fa-AF` (Dari), `ur-PK` (Urdu), `ps-AF` (Pashto), `ar`. The non-English locales show their own digits.
- The "Download PDF" button on Prayer Times needs a real monthly timetable PDF, either uploaded by an admin or generated.
- Suggested endpoint: `GET /api/prayer-times?date=YYYY-MM-DD` returns `{ date, prayers:[{key, adhan, iqamah}], jumuah:[{label, khutbah, iqamah, location}] }`.

### 2. Announcements ticker (header, every page)
- The prototype has 4 items in `Site Header.dc.html` (`annBase`), each with `text` and `href`.
- Needs an admin-managed list with these fields: `text` in each language, `link`, `startAt`, `endAt`, `sortOrder`, `active`.
- Only show items whose start and end dates include the current time. Hide the whole ticker if none are active.
- Behavior to keep:
  - Scrolls at about 45s per loop and pauses on hover.
  - Stops animating when `prefers-reduced-motion` is set.
  - On screens under 760px wide it moves to its own row.
  - The track is forced left-to-right, and each item uses `dir="auto"`.

### 3. Events
- Used on the **Home carousel** (`BMCC Website.dc.html` → `carouselEvents`) and the **Events page** (`Events.dc.html` → `events`).
- Model: `id, slug, title, description, tag, startAt, endAt, recurrence (e.g. weekly Friday), location, imageUrl`. Title and description are needed in each language.
- The Home carousel shows the **next 4–8 upcoming** events, and the Events page lists all upcoming events.
- "Read More" should open an event detail page. The prototype links to the Events index because no detail page exists yet.
- The Events page has "+ iCal" and "+ Google" buttons. Generate an `.ics` file per event and a Google Calendar link built with `action=TEMPLATE`.
- The carousel's photo spots are placeholders for testing only. In production, use `imageUrl`.

### 4. Community Directory (`Community.dc.html`)
- The 10 listings are hard-coded in `allListings` and taken from the BMCC-vetted CSV.
- Model: `id, name, listingType (business|individual), parentCategory, category, tags[], description, author, phone, email, website, address, city, state, zip, googleMapUrl, status (pending|approved|rejected), createdAt`.
- **Search and filters:**
  - Free-text search across name, category, parent category, location and tags.
  - A parent-category filter and a sub-category filter.
  - 10 results per page.
  - Listings with a phone number sort first.
- **View Details popup:** embeds a Google Map using `https://maps.google.com/maps?q=<name, address>&z=15&output=embed`. It also has "Open in Google Maps" (`/maps/search/?api=1&query=`) and "Get Directions" (`/maps/dir/?api=1&destination=`) buttons.
  - Listings with no address show "No location provided" in place of the map.
  - To style the map or remove the embed's branding, switch to the **Maps Embed API**, which needs an API key.
- **Mobile, under 700px:** the table is replaced by stacked cards with a full-width "Call" button and a "View Details" button. Keep both layouts.
- **"Submit a Listing" button:** currently links to `#`. Build a submission form, send submissions to an **admin moderation queue**, and publish only approved listings. The page already says "All listings are reviewed by our admin team before they go live."
- **Data clean-up before launch:** some listings are in the wrong category, and 8 of 10 have no address.

### 5. Donations (`Donate.dc.html`)
- **Funds (ids):** `new-bmcc`, `masjid-membership` (the default), `construct-run`, `sadaqah-zakat`, `zakat-fitr`.
- **Frequency:** `one-time` or `monthly`. Monthly is the default and can be changed through the page's `defaultDonationFrequency` setting.
- **Amount:** preset buttons plus a custom amount, defaulting to $50.
- Integrate a payment processor. Stripe Checkout and Donorbox are common choices for 501(c)(3) organizations. It needs recurring billing, tax receipts emailed automatically, and a record of which fund each gift went to.
- The page promises "Automatic tax receipts for all contributions."
- The header's "Donate Now" button links to this page.

### 6. Membership application (`Membership.dc.html`)
The form has 5 steps:
1. **Primary member:** full legal name, home address, date of birth, phone, email, and emergency contact (name and phone).
2. **Household and dependents:** repeatable rows added with "+ Add Household Member". Each row has name, relationship, and optional phone and email.
3. **Fees:** `monthly` ($100/mo) or `yearly` ($1,000/yr, shown as "Save $200").
4. **Funeral Services Benefit:** information only. It links to the policy page.
5. **Declaration:** a checkbox that must be checked before the form can be submitted.

On submit:
- Create a pending membership, start the payment subscription, and email a confirmation.
- Show the success screen with the `referenceId`, which the prototype currently generates on the page.

The household members listed here are the people **eligible for the Funeral Services Benefit**, so store them as structured records, not free text.

### 7. Funeral Services Benefit (`Funeral Services.dc.html`)
- This page is static policy content. The figures to enforce in the backend and in admin tools are:
  - Up to **$10,000 per household**.
  - **6-month waiting period** after enrollment and first payment.
  - **30-day grace period** for missed dues.
  - Paid **directly to the funeral home or vendor**.
- The waiting-period end date should be stored on each membership, as `benefitEligibleFrom = enrolledAt + 6 months`.
- Claims are handled offline by the office. If you build a claims intake later, follow the "Claim checklist" section on this page.

### 8. Contact form (`About Us.dc.html#contact`)
- Fields: name, email, and message ("How can we help?").
- Send submissions to `info@brmcc.org` and/or a ticketing inbox.
- Add spam protection, such as a honeypot field plus Turnstile or reCAPTCHA.
- Many pages link here with `#contact`, including the Services and Assistance calls to action. Consider accepting a `?topic=` parameter so the form knows which service the visitor came from.

### 9. Mailing list — re-subscribe campaign (critical)
- There are **two** signup forms on the Home page:
  - The **re-subscribe bar** at the top (`resub*` in the page logic). It can be dismissed, and the dismissal is remembered per browser session under the storage key `bmcc_resub_dismissed`.
  - The **"Stay Connected" newsletter form** near the bottom (`newsletter*`).
- Both must go to the **new** list. The old list is being retired because it is full of spam.
- **Double opt-in is required.** The bar's wording promises a confirmation link.
- Suggested providers: Mailchimp, Buttondown, or Listmonk if self-hosted.
- Add rate limiting and a honeypot field.
- Optional: show the re-subscribe bar on every page by moving it into the shared header for the length of the campaign.

### 10. Member login
- The header's "Member Login" link currently points to `BMCC Website.dc.html#member-access`, the marketing section on the Home page.
- Build a member portal with login. Its features, as promised in the Home page's Member Portal section:
  - Manage the membership.
  - View donation receipts.
  - RSVP to events.
  - Update the household profile.

### 11. Site search
- The header has a search box with a `searchQuery` state but no results page.
- Build full-text search across pages, events and directory listings. It must work in all languages.

### 12. Services and Assistance calls to action
- `Services.dc.html` has 8 cards and `Assistance.dc.html` has 7. Most of their buttons link to `About Us.dc.html#contact`.
- Decide per card whether it needs its own intake form. Candidates:
  - Du'a request
  - Ask an Imam
  - Nikah scheduling
  - Facility rental availability
  - Refugee support request
  - Clothing, furniture and vehicle donation drop-offs

---

## Build approach: local first, deploy later
Build a fully working local version first so every flow can be tested end to end. The same code will then be pushed to a GitHub repository and deployed to a server, so build it that way from the start:
- **Use Git from the first commit**, with a `.gitignore` that leaves out `.env`, `node_modules/`, local database files and uploaded files.
- **All settings and secrets go in environment variables.** Commit a `.env.example` with every variable listed and blank values. Nothing secret goes in the code.
- **Run the same database locally as in production:** Postgres in Docker, not SQLite, so nothing behaves differently after deployment. Every database change goes through migrations; no manual edits.
- **Put anything that differs between local and production behind a setting:**
  - Email: Mailpit locally, a real email service in production.
  - Payments: Stripe test keys locally, live keys in production.
  - File storage: local folder locally, cloud storage in production.
- **One command starts everything locally:** `docker compose up` (app, Postgres, Mailpit) or `npm run dev` after it.
- **Seed script:** sample prayer times, events, announcements, directory listings and an admin user for local testing. It must never run in production.
- **Deployable as-is:** a production build command, a health-check URL, and a README section covering how to deploy.
- **Automated tests for the main flows:** donation, membership, directory submission and approval, re-subscribe confirmation, and the contact form. They should run before every push.

## Internationalization
- The translations live in `i18n.js`, and the language codes are `en`, `dari`, `urdu`, `pashto` and `arabic`. **Right-to-left languages:** `dari`, `urdu`, `pashto`. Set `dir="rtl"` on the page root when one of these is selected.
- The chosen language is saved in `localStorage` under `bmcc_lang`. Every page and the header listen for the `storage` event so all open tabs switch together.
- `t(lang)` merges the chosen language over English, so any key without a translation falls back to English. Keep this fallback.
- **All non-English text is machine-generated and must be replaced with vetted human translations before launch.** Arabic is the least complete; most Arabic keys fall back to English.
- New text added recently has **English only** so far:
  - Re-subscribe bar
  - Events carousel heading and buttons
  - 3 of the 4 announcements
  - Community Directory popup labels
- If you use a CMS, move this dictionary into its translation system so admins can edit the text.

## Responsive breakpoints
| Width | Behavior |
|---|---|
| ≤1140px | Desktop navigation is replaced by the menu button (`[data-desktop-nav]` / `[data-mobile-toggle]`) |
| ≤980px | Events carousel shows 2 cards |
| ≤900px | Two-column grids stack; the Home hero stacks in the order heading → table → buttons → paragraph |
| ≤760px | Announcements ticker moves to its own full-width row |
| ≤700px | Community Directory switches from table to cards |
| ≤640px | Events carousel shows 1 card at 86% width, with no arrows (swipe only) |
| ≤480px / ≤420px | Compact table text; smaller hero buttons |

## Interactions and motion
- **Events carousel:**
  - **Drifts continuously** at about 32px per second, looping seamlessly (the event list is rendered twice and the scroll position wraps at the halfway point).
  - The arrows move one card at a time (card width + 20px gap). Drifting resumes from wherever the arrows or a swipe leave it.
  - Pauses on hover, keyboard focus, touch, or when the tab is hidden.
  - Turns off under `prefers-reduced-motion`.
- **Popups** (the Directory's View Details):
  - Fixed overlay in `rgba(11,21,36,0.6)`.
  - Clicking outside or on the × closes it.
  - Needs a focus trap and Escape-to-close. The prototype doesn't have these; add them in production.
- **Navigation:** menus close when clicking outside them. The current page's tab gets a 2px `#2f6fed` underline.

## Design tokens
**Font:** Inter at weights 400, 500, 600, 700 and 800, falling back to `ui-sans-serif, system-ui`.

**Colors**
| Token | Hex | Use |
|---|---|---|
| navy | `#101d33` | Top bar, dark sections, primary dark buttons, event cards |
| ink | `#0b1524` | Headings, footer background |
| primary | `#2f6fed` | Primary buttons, links, "Updates" tag |
| primary-hover | `#1d54c4` | Button hover |
| eyebrow | `#2354a6` | Small uppercase labels, text on light-blue backgrounds |
| sky-100 | `#eaf1fe` | Light-blue bands and tags |
| sky-200 | `#d7e4fb` | Borders on light-blue bands |
| sky-on-dark | `#8fb0e8` | Accent text on navy |
| body | `#384152` | Body text |
| muted | `#6b7280` | Secondary text |
| subtle | `#98a2b3` | Tertiary text, notes |
| mist-on-dark | `#c5d2e4` | Body text on navy |
| border | `#e2e5ea` | Card and section borders |
| page | `#f6f7f9` | Light-grey section background |
| white | `#ffffff` | White sections and cards |
| success | `#12653a` on `#e6f4ec` | Confirmation states |

**Type scale**
- Page h1: `clamp(28px,3.6vw,42px)`, weight 800, letter-spacing -0.02em.
- Home hero h1: `clamp(32px,4.2vw,52px)`, line-height 1.08.
- Section h2: `clamp(24px,2.8vw,32px)` or `clamp(26px,3.2vw,36px)`, weight 800.
- Eyebrow labels: 13px, weight 700, uppercase, letter-spacing 0.12em.
- Body text: 15–16.5px with line-height 1.7. The hero paragraph is 18px.

**Spacing** (made consistent across the site in the latest pass)
- Space above and below each section's content: `clamp(36px,5vw,56px)`. The Home hero uses `clamp(36px,5vw,60px)` and the Member Portal section `clamp(40px,5vw,64px)`.
- Space on either side of the content: `clamp(20px,4vw,32px)`. Content is at most 1180px wide; policy pages 900px; forms 820px.
- Gap from a section heading to its content: 22px.
- Gap between two columns: 36px. The Home hero uses a 56px gap between columns and 20px between rows.
- Card grids: 16–20px gaps.

**Corner radius:** 7–9px on buttons and inputs, 10–14px on cards, 16px on popups, 999px on pill tags.

**Shadows:** cards use `0 16px 40px rgba(15,42,32,0.08)`, popups `0 30px 70px rgba(11,21,36,0.35)`, carousel arrows `0 6px 18px rgba(16,29,51,0.14)`.

**Alternating section backgrounds:** light grey and white alternate, with 1px `#e2e5ea` dividers between them. On Home the order is re-subscribe bar (light blue) → hero (light grey) → events (white) → tiles (light grey) → announcement strip (light blue) → Member Portal (navy) → Get Involved → newsletter (light blue).

## Assets
- `design/assets/bmcc-logo.jpeg` is the current logo, shown in the header at 34px tall. **Ask BMCC for an SVG or high-resolution PNG version.**
- There are no other images yet. The event cards, the About Us facility image and similar spots are placeholders that need real photos from BMCC.

## Content blockers — need confirmation from BMCC
- Real prayer timetable and Iqamah offsets, calculated with the Hanafi Asr method.
- Real event dates. The current dates are placeholders.
- Food pantry hours ("Saturday 10 AM – 12 PM" is a placeholder).
- Donation account and payment-processor details, and Zelle/PayPal details if those will be offered.
- Human translations for all 4 non-English languages.
- Addresses and correct categories for the directory listings.
- A decision on keeping or removing the "Stay Connected" form once the re-subscribe campaign ends.

## Files
All the prototype files are in `design/`:
- **Shared:** `Site Header.dc.html` (top bar with next prayer, announcements, language menu, Member Login and Donate Now; main navigation; search) and `Site Footer.dc.html`.
- **Pages:** `BMCC Website.dc.html` (Home), `Prayer Times.dc.html`, `Donate.dc.html`, `Events.dc.html`, `Community.dc.html`, `Services.dc.html`, `Assistance.dc.html`, `Funeral Services.dc.html`, `Membership.dc.html`, `About Us.dc.html`.
- **Supporting files:**
  - `i18n.js`: translations, language list and right-to-left helpers.
  - `support.js`: the prototype's runtime (not needed in production).
  - `image-slot.js`: the prototype's photo placeholder (not needed in production).
  - `assets/`: the logo.
- **Reference:** `Gap Analysis.dc.html` compares this design with the current BMCC site built by SoftSprouts.
