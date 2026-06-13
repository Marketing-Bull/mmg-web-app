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
| `GHL_WEBHOOK_URL` | Vercel env | `api/lead.js` — forwards every contact + newsletter submission to the GoHighLevel inbound webhook | 🔒 secret |
| `GHL_API_TOKEN` | Vercel env | `api/events`, `api/sponsors`, `api/admin/setup-ghl` — reads GHL custom objects (needs `objects/record.readonly`; `objects/schema.write` for setup) | 🔒 secret |
| `GHL_LOCATION_ID` | Vercel env | same as above — the GHL sub-account location id | 🔒 secret |
| `SETUP_SECRET` | Vercel env | guards `api/admin/setup-ghl` (the one-time object-creation route) | 🔒 secret |

All are read server-side only and never exposed to the browser. Without the GHL
vars, `api/events`/`api/sponsors` return empty and the site falls back to the
committed `data/*.json`; the forms need `GHL_WEBHOOK_URL`.

Optional: `GHL_EVENTS_OBJECT_KEY` (default `custom_objects.event`),
`GHL_SPONSORS_OBJECT_KEY` (default `custom_objects.sponsor`).

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

`assets/js/content.js` renders the Events and Sponsors on the homepage. It loads
them in this order, using the first that returns data:

1. **`/api/events` and `/api/sponsors`** — Vercel functions that read the GHL
   **Event** / **Sponsor** custom objects live (token from Vercel env), cached
   ~5 min at the edge.
2. **`data/events.json` / `data/sponsors.json`** — committed seed (offline fallback).
3. The static cards already in `index.html`.

**Setup (one time):**

1. Run the setup route to create the GHL custom objects + fields:
   `GET /api/admin/setup-ghl?key=<SETUP_SECRET>` (idempotent; returns a JSON
   log). It builds the schema in
   [`docs/strategy/ghl-content-model.md`](docs/strategy/ghl-content-model.md) —
   flyer/logo are file-upload fields; sponsors are name + logo + priority. The
   token needs `objects/schema.write` for this step.
2. Add Events/Sponsors as records in GHL. `/api/events` and `/api/sponsors` pick
   them up automatically within the cache window.

> The `.github/workflows/*` + `scripts/sync-ghl.mjs` are an **alternative**
> sync-to-static-JSON path (requires GitHub Actions to be enabled). With the
> Vercel functions above, they are not needed.

When new variables are added, document them and keep this section in sync.

