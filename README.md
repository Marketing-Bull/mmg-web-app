# Miller's Marketing Group Website

Static homepage mockup for Miller's Marketing Group.

## Project Structure

- `index.html` - deployable GitHub Pages homepage
- `faq.html` - frequently asked questions
- `privacy-policy.html`, `terms-of-service.html`, `disclaimer.html`, `accessibility.html` - legal and accessibility pages (drafts pending legal review)
- `assets/css/pages.css` - shared styles for the sub-pages (header, footer, buttons, prose, FAQ)
- `assets/js/site.js` - contact/newsletter form handling and GA4 event tracking (gtag.js itself is loaded from each page's `<head>`)
- `assets/js/content.js` - renders Events & Sponsors on the homepage from `data/*.json` (falls back to the static cards)
- `api/lead.js` - Vercel serverless function that forwards contact + newsletter submissions to the GHL webhook
- `data/events.json`, `data/sponsors.json` - content the site reads for Events & Sponsors (synced from GHL; seeded with current content)
- `scripts/sync-ghl.mjs` - pulls GHL Custom Objects (Event, Sponsor) into `data/*.json`
- `.github/workflows/sync-ghl.yml` - scheduled job that runs the sync and commits any changes
- `docs/strategy/ghl-content-model.md` - the GHL custom-object schema to create for Events & Sponsors
- `package.json` - marks the repo as a Vercel project (Node serverless functions)
- `assets/brand/` - brand and relationship imagery
- `assets/events/upcoming/` - current event flyers
- `assets/events/past/` - archived event flyers
- `assets/events/recaps/` - event-specific video thumbnails and recap imagery
- `assets/events/series/` - recurring-event schedule graphics
- `assets/partners/` - current client and sponsor logos
- `docs/discovery/` - stakeholder discovery notes
- `docs/strategy/` - website strategy and brand guidance

The static pages can be served from the repository root, but the contact and
newsletter forms rely on a serverless function (`api/lead.js`), so the site is
deployed on **Vercel** (static files + Node functions) rather than plain GitHub
Pages. `index.html` remains the homepage source of truth.

## Configuration & environment variables

Each variable is marked **🔒 secret** (store only in the host's encrypted env
settings — never commit) or **🌐 public** (safe to expose; lives in client code).

### Required

| Variable | Where to set | Used by | Secret? |
| --- | --- | --- | --- |
| `GHL_WEBHOOK_URL` | Vercel → Project → Settings → Environment Variables | `api/lead.js` — forwards every contact + newsletter submission to the GoHighLevel inbound webhook | 🔒 secret |

Without `GHL_WEBHOOK_URL` the forms return a configuration error. The value is
read server-side only and is never exposed to the browser.

### Public identifiers (not env vars — set directly in code)

| Item | Where | Notes |
| --- | --- | --- |
| Google Analytics 4 measurement ID | gtag.js snippet in the `<head>` of every page (`G-D3DW5X6G2T`) | `assets/js/site.js` sends events (`lead_submit`, `eventbrite_click`, `cta_click`) via the global `gtag`. GA4 measurement IDs are public. |
| Eventbrite | links in `index.html` | Public event/organizer URLs. |
| Instagram | contact + footer links | Public profile URL. |
| Contact email | `contact@millersmarketinggroup.com` in `index.html` | Public address; GHL handles lead routing/notifications. |

> Mailchimp has been removed entirely — forms and the newsletter now flow
> through the GoHighLevel webhook.

### Events & Sponsors content sync (GHL Custom Objects)

Events and Sponsors are read from `data/events.json` / `data/sponsors.json`,
which the homepage renders via `assets/js/content.js` (with the static cards as
fallback). Those files are refreshed by a scheduled GitHub Action
(`.github/workflows/sync-ghl.yml`) that runs `scripts/sync-ghl.mjs` to pull the
GHL **Event** and **Sponsor** custom objects. No token is used at request time —
the site only serves the committed JSON.

**Setup:** create the custom objects per
[`docs/strategy/ghl-content-model.md`](docs/strategy/ghl-content-model.md), then
add these **GitHub Actions secrets** (Settings → Secrets and variables → Actions):

| Secret | Required | Notes |
| --- | --- | --- |
| `GHL_API_TOKEN` 🔒 | yes | GHL Private Integration token with `objects/record.readonly` scope |
| `GHL_LOCATION_ID` | yes | Sub-account location id |
| `GHL_EVENTS_OBJECT_KEY` | no | Defaults to `custom_objects.event` |
| `GHL_SPONSORS_OBJECT_KEY` | no | Defaults to `custom_objects.sponsor` |

Until the secrets are set, the sync is a no-op and the seeded JSON is served.
The GHL API request/field mapping in `scripts/sync-ghl.mjs` should be validated
against a live response once the objects and token exist.

When new variables are added, document them and keep this section in sync.

