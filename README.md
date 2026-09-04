# Miller's Marketing Group Website

Static homepage mockup for Miller's Marketing Group.

## Project Structure

- `index.html` - Vercel-served homepage
- `faq.html` - frequently asked questions
- `privacy-policy.html`, `terms-of-service.html`, `disclaimer.html`, `accessibility.html` - legal and accessibility pages
- `404.html`, `robots.txt`, `sitemap.xml` - launch support files
- `llms.txt` - plain-text summary of the site for AI assistants and agents, linked from every footer under **For LLMs**
- `vercel.json` - security headers (CSP and friends) and permanent redirects from legacy WordPress URLs
- `content-manager.html` - password-protected editor for Events and Sponsors, with Instagram-based image import and direct file upload
- `assets/css/pages.css` - shared styles for the sub-pages (header, footer, buttons, prose, FAQ)
- `assets/js/site.js` - contact/newsletter form handling, GA4 event tracking (gtag.js itself is loaded from each page's `<head>`), and the footer's "Site last updated" date
- `assets/js/content.js` - renders Events and Sponsors on the homepage: `/api/events`+`/api/sponsors` (live, published) → `data/*.json` (seed) → static cards; also emits schema.org Event JSON-LD for the upcoming events and the sponsor-tile scroll reveal
- `api/lead.js` - forwards contact + newsletter submissions to the GHL webhook
- `api/events.js`, `api/sponsors.js` - public read endpoints; serve published content from Vercel Blob, falling back to the `data/*.json` seed
- `api/admin/login.js`, `api/admin/logout.js` - shared-password session login for the content manager
- `api/admin/content.js` - authenticated read/publish of Events and Sponsors (writes to Vercel Blob)
- `api/admin/instagram.js` - authenticated: resolves a pasted Instagram post/reel URL to its image and copies it to Vercel Blob
- `api/admin/eventbrite.js` - authenticated: reads a pasted public Eventbrite event URL (title, date, times, venue, city, summary, flyer) so the content manager can create the site event from it; copies the flyer to Vercel Blob
- `api/admin/upload.js` - authenticated: direct file upload (event flyers, sponsor logos, recap video clips) to Vercel Blob, 3MB limit
- `api/admin/status.js` - authenticated: reports which environment variables are set and whether Blob is reachable (presence only, never values)
- `lib/auth.js` - password check + signed session cookie helpers
- `lib/rateLimit.js` - per-IP rate limiting shared by the lead and admin endpoints
- `lib/uploadTypes.js` - accepted upload formats, their file-signature checks, and the size ceiling
- `lib/eventbrite.js` - pure parsing/mapping for the Eventbrite import (URL → event ID, Eventbrite's event data → site event fields), tested on captured fixtures
- `lib/http.js` - JSON body parsing, input length caps, `no-store` helper
- `lib/blobStore.js` - Vercel Blob read/write helpers for content JSON and imported media
- `data/events.json`, `data/sponsors.json` - initial seed content (used until the first Publish, and as a fallback after)
- `docs/content-management.md` - editing workflow for Andrew's team
- `docs/launch-readiness.md` - current verdict, blockers, and pre-launch acceptance requirements
- `scripts/validate.mjs` - syntax/JSON validation for every JS file, inline page script, and data file
- `scripts/hardening.test.mjs` - tests for the rate limiter and the upload allowlist
- `scripts/eventbrite.test.mjs`, `scripts/fixtures/` - tests for the Eventbrite import mapping, against responses captured from a real MMG event
- `scripts/social-card.html`, `scripts/render-social-card.mjs` - source artwork and renderer for the link-preview image
- `.github/workflows/ci.yml` - runs the validator and the tests on every push and pull request
- `package.json` - marks the repo as a Vercel project (Node serverless functions, `@vercel/blob`)
- `assets/brand/` - brand and relationship imagery, including `social-card.jpg` (the link-preview image)
- `assets/events/upcoming/` - current event flyers
- `assets/events/past/` - archived event flyers
- `assets/events/recaps/` - event-specific video thumbnails and recap imagery
- `assets/events/series/` - recurring-event schedule graphics
- `assets/partners/` - current client and sponsor logos
- `docs/discovery/` - stakeholder discovery notes
- `docs/strategy/` - website strategy and brand guidance

The static pages are served from the repository root, but the contact and
newsletter forms rely on a serverless function (`api/lead.js`), so the site must
be deployed on **Vercel** (static files + Node functions) rather than plain
GitHub Pages. `index.html` remains the homepage source of truth.

## Checks

There is no build step, so a syntax typo or a malformed data file would
otherwise reach production unnoticed. Before pushing, run:

```bash
node scripts/validate.mjs
```

It parses every `.js`/`.mjs` file, every inline `<script>` in the HTML pages,
and every JSON data file, and exits non-zero on the first problem.

There are also tests covering the rate limiter and the upload allowlist:

```bash
node --test scripts/*.test.mjs
```

`.github/workflows/ci.yml` runs both on every push and pull request. Both are
also wired up as `npm run validate` and `npm test`.

## Event structured data

Upcoming events are published as schema.org `Event` JSON-LD (`BusinessEvent`,
or `EducationEvent` for Lunch & Learn), built by `renderEventSchema()` in
`assets/js/content.js` from the same list that renders the cards.

It is emitted from script rather than written into `index.html` on purpose.
Events are published from the content manager straight to Blob without a
deploy, so committed markup would describe whatever was last committed —
exactly the case where the schema would be wrong, and stale structured data is
worse than none. Google renders JavaScript for structured data; non-rendering
AI consumers are served `llms.txt` instead.

Details worth knowing:

- **Only upcoming events are described**, so a past date is never advertised.
  Undated recurring series carry no `startDate` and are skipped.
- **`startTime`/`endTime` are optional.** With a time, `startDate` carries the
  UTC offset for that date, read per event via `Intl` so daylight saving is
  right (`-04:00` in July, `-05:00` in December). Without a usable offset it
  falls back to the plain date rather than emitting a time that would be read
  as UTC and land five hours out.
- **`offers` is deliberately omitted.** Ticket prices are not stored, and
  Google wants a price whenever offers are present; a guessed one would be a
  fabricated claim on a live listing.
- **`addressRegion` is omitted** for the same reason — only venue and city are
  stored, and hard-coding `FL` would be wrong the first time MMG runs an event
  elsewhere. Adding a region field to the event record would let this improve.

## "Site last updated" in the footer

Every footer carries a `Site last updated <date>` line. Nothing generates it and
nothing needs bumping by hand: `wireLastUpdated()` in `assets/js/site.js` reads
`document.lastModified`, which reflects the `Last-Modified` header the host
sends for the page. Vercel stamps every static file in a deployment with that
deployment's build time, so the date advances on its own each time the site
ships.

Verified against production on September 3, 2026: `index.html` and
`assets/js/content.js` both came back with `last-modified: Thu, 03 Sep 2026
20:40:11 GMT`, the time of that deployment, rather than per-file timestamps.

Two things worth knowing:

- **It is the deploy date, not the content date.** Publishing Events or
  Sponsors from the content manager writes to Vercel Blob without a deploy, so
  it does not move this date. A code push does.
- **No header means no date.** Where a host sends no `Last-Modified`, the spec
  has `document.lastModified` fall back to the current time, which would render
  "updated today" forever. Anything within a minute of now is treated as that
  fallback and the line stays hidden instead. That is also why the markup ships
  with `hidden` and is only revealed once a real date is in hand.

## Link previews (the social card)

When someone pastes a millersmarketinggroup.com link into X/Twitter, LinkedIn,
Facebook, Slack, iMessage, or WhatsApp, they see `assets/brand/social-card.jpg`
— a 1200x630 branded card — plus the page's title and description. Every page
carries a full set of Open Graph and `twitter:card` (`summary_large_image`)
tags, so a shared link never falls back to a random image or a bare URL.

To change the card, edit the copy or layout in `scripts/social-card.html`, then:

```bash
npm run social-card    # rewrites assets/brand/social-card.jpg
```

That renders the template in headless Chromium at exactly 1200x630. It needs
Playwright's Chromium (`npx playwright install chromium`) and network access to
Google Fonts, which it inlines so the card uses the real brand faces.

Platforms cache preview images hard. After changing the card, re-scrape the URL:

- X/Twitter: <https://cards-dev.twitter.com/validator>
- Facebook / Instagram: <https://developers.facebook.com/tools/debug/>
- LinkedIn: <https://www.linkedin.com/post-inspector/>

## Security

| Protection | Where | Notes |
| --- | --- | --- |
| Rate limiting | `lib/rateLimit.js` | Per IP. Leads: 5 per 10 min. Content-manager login: 8 per 15 min. Admin content: 60 per 5 min. Uploads + Instagram/Eventbrite imports: 30 per 10 min. |
| Upload allowlist | `api/admin/upload.js` | JPG, PNG, GIF, WebP, MP4, MOV, WebM only — verified against each file's magic bytes, so a script payload labelled `image/png` is rejected. SVG is deliberately excluded (browsers execute script inside it). |
| Input caps | `api/lead.js`, `api/admin/content.js` | Submitted fields are trimmed and length-capped before reaching GHL; a publish is capped at 500 items / 512KB. |
| Upstream timeouts | `api/lead.js`, `api/admin/instagram.js`, `api/admin/eventbrite.js` | A stalled third party fails in 10-15s instead of hanging the visitor's request. |
| SSRF guard | `api/admin/instagram.js`, `api/admin/eventbrite.js` | Instagram: only downloads thumbnails from Meta's own CDNs. Eventbrite: only ever requests `eventbrite.com` by numeric event ID, and only downloads flyers from Eventbrite's `evbuc.com` image CDN. |
| Security headers | `vercel.json` | CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`, and `X-Robots-Tag: noindex` on `/api/*` and the content manager. |
| No-store on admin | `lib/http.js` | Admin responses are never cached by a browser or by Vercel's edge. |

Two things worth knowing about these:

**Rate limits are per function instance, not global.** Vercel scales each
endpoint independently and the counters live in instance memory, so requests
from one client get spread across instances that each count separately.
Measured against a real deployment on August 18, 2026, hitting `/api/lead` from
a single IP against a nominal limit of 5 per 10 minutes:

| Load | Rejected with 429 |
| --- | --- |
| 7 requests, serial | 0 |
| 30 requests, serial | 10 |
| 20 requests, concurrent | 13 |

So it throttles a sustained or concurrent flood, and a small burst passes
through. That is the right shape for stopping abuse without tripping up a real
visitor who resubmits a form, but it is not an exact quota and should not be
relied on as the only control:

- For a hard limit, enable **Vercel Firewall → Rate Limiting** on the project.
  It runs at the edge with shared state, before any function is invoked, and is
  the durable fix. The in-code limiter then stays as defense in depth.
- Because the per-instance ceiling also applies to `/api/admin/login`, the value
  of `CONTENT_ADMIN_PASSWORD` matters more than the limit does. Use a long
  random passphrase, not a memorable one.
- If MMG ever wants exact limits in code instead, swap the `Map` in
  `lib/rateLimit.js` for Vercel KV or Upstash; the API is designed to stay the
  same.

**The CSP allowlists GA4 and GoHighLevel by name.** It was verified two ways: a
headless browser loading every page in this repo produced no violations, and
GoHighLevel's `external-tracking.js` was checked directly — it only calls
`backend.leadconnectorhq.com`, which `connect-src` already covers via
`https://*.leadconnectorhq.com`. If a third-party script is ever added or
updated, load the site with the browser console open and look for
`Refused to load...`, then add the host to the matching directive in
`vercel.json`.

## Repository maintenance

### Stale branches to delete

Every feature branch below was **squash-merged** into `main` (PRs #1–#9), so
its commits don't appear in `main`'s history even though all of its content
did land. They're safe to delete:

```
claude/faq-and-legal-pages-WgPI1
claude/ga4-head-snippet-WgPI1
claude/ghl-events-sponsors-backend-WgPI1
claude/ghl-object-setup-WgPI1
claude/ghl-vercel-runtime-WgPI1
claude/homepage-markup-revisions-WgPI1
claude/mobile-experience-improvements-WgPI1
claude/readme-env-config-WgPI1
codex/remove-ghl-content-sync
```

Delete them from **[the branches page](https://github.com/Marketing-Bull/mmg-web-app/branches)**,
or locally with:

```bash
git push origin --delete <branch-name>
```

To avoid this piling up again, enable **Settings → General → Pull Requests →
Automatically delete head branches**.

> `gh-pages` and `master` are *not* in the list above — leave them alone
> unless you've confirmed they're unused. The site deploys from `main` via
> Vercel, so `gh-pages` is likely a leftover from the original GitHub Pages
> setup, but it hasn't been verified as safe to remove.

## Configuration & environment variables

Each variable is marked **🔒 secret** (store only in the host's encrypted env
settings — never commit) or **🌐 public** (safe to expose; lives in client code).

### Required

| Variable | Where to set | Used by | Secret? |
| --- | --- | --- | --- |
| `GHL_WEBHOOK_URL` | Vercel env | `api/lead.js` — forwards every contact + newsletter submission to the GoHighLevel inbound webhook | 🔒 secret |
| `CONTENT_ADMIN_PASSWORD` | Vercel env | `api/admin/login.js` — the shared password for `content-manager.html` | 🔒 secret |
| `CONTENT_SESSION_SECRET` | Vercel env | `lib/auth.js` — signs the login session cookie. Use a long random string, e.g. `openssl rand -hex 32` | 🔒 secret |
| `BLOB_READ_WRITE_TOKEN` | Vercel env (auto-added) | `lib/blobStore.js` — read/write access to the project's Vercel Blob store | 🔒 secret |
| `IG_APP_ID`, `IG_APP_SECRET` | Vercel env | `api/admin/instagram.js` — Meta Developer App credentials used to resolve a pasted Instagram URL to its image via the oEmbed API | 🔒 secret |

None of these are ever exposed to the browser. Setup notes:

- **`BLOB_READ_WRITE_TOKEN`**: in the Vercel dashboard, go to **Storage → Create → Blob**, then connect the store to
  this project. Vercel adds this env var automatically — no manual copying needed.
- **`IG_APP_ID` / `IG_APP_SECRET`**: create a free app at
  [developers.facebook.com](https://developers.facebook.com/), note the App ID and App Secret from the app's
  Settings → Basic page. No app review is required for oEmbed reads of public posts.
- Without `CONTENT_ADMIN_PASSWORD`/`CONTENT_SESSION_SECRET`, the content manager login is disabled. Without
  `IG_APP_ID`/`IG_APP_SECRET`, the "Use this Instagram photo" import fails (a direct image URL can still be pasted
  manually as a fallback). Without `BLOB_READ_WRITE_TOKEN`, Publish fails and the site keeps serving the
  `data/*.json` seed.

**To check what a deployment actually has configured**, log in to
`content-manager.html` and then open `/api/admin/status` in the same browser.
It reports which of the six variables are present and whether Blob storage is
reachable. It never returns a value, and it never confirms that a value is
correct — only that something is set. Every other endpoint hides a missing
variable behind a graceful fallback, so this is the only direct way to tell a
fully configured deployment from a half-configured one.

### Public identifiers (not env vars — set directly in code)

| Item | Where | Notes |
| --- | --- | --- |
| Google Analytics 4 measurement ID | gtag.js snippet in the `<head>` of every page (`G-D3DW5X6G2T`) | `assets/js/site.js` sends events (`lead_submit`, `eventbrite_click`, `cta_click`) via the global `gtag`. GA4 measurement IDs are public. |
| Eventbrite | links in `index.html`; `api/admin/eventbrite.js` | Public event/organizer URLs. The content manager's **Add from Eventbrite** reads public event pages only, so it needs no Eventbrite API key. |
| Instagram | contact + footer links | Public profile URL. |
| Contact email | `contact@millersmarketinggroup.com` in `index.html` | Public address; GHL handles lead routing/notifications. |

> Mailchimp has been removed entirely — forms and the newsletter now flow
> through the GoHighLevel webhook.

### Events and Sponsors content

Andrew's team edits Events and Sponsors through the password-protected
`content-manager.html`. Publishing writes straight to Vercel Blob — no git,
no file replacing, no redeploy. `/api/events` and `/api/sponsors` serve that
published content to the homepage, falling back to the committed
`data/events.json` / `data/sponsors.json` seed if nothing has been published
yet (or if Blob is unreachable). See
[`docs/content-management.md`](docs/content-management.md) for the step-by-step
workflow.

Images (event flyers, recap thumbnails, sponsor logos) are imported by
pasting an Instagram post or reel URL — the content manager resolves it via
the Instagram oEmbed API and copies the image into Vercel Blob automatically,
so there's no manual resizing or file uploading.

An event can also be created straight from its Eventbrite listing: paste the
event URL into **Add from Eventbrite** and the title, date, venue, city,
summary, flyer and registration link are filled in. This reads the same
public data Eventbrite publishes for search engines (the page's schema.org
block), preferring the cleaner JSON the event page itself loads when it is
available, so there is nothing to configure. Pasting the same link again
updates the existing event (matched on the Eventbrite event ID stored as
`eventbriteId`) rather than adding a duplicate.

Each sponsor also has a **Logo Background** (`bg`) — a hex colour painted
behind that logo's tile. Set it to the logo artwork's own backdrop so the
image blends into the card instead of showing as a rectangle on it; a logo
drawn in white needs a dark value here or it disappears. Leave it blank for
logos on a transparent background, which use the default card colour. The
homepage inverts the caption automatically on dark tiles.

When new variables are added, document them and keep this section in sync.
