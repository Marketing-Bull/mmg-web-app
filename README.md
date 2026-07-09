# Miller's Marketing Group Website

Static homepage mockup for Miller's Marketing Group.

## Project Structure

- `index.html` - Vercel-served homepage
- `faq.html` - frequently asked questions
- `privacy-policy.html`, `terms-of-service.html`, `disclaimer.html`, `accessibility.html` - legal and accessibility pages
- `404.html`, `robots.txt`, `sitemap.xml` - launch support files
- `content-manager.html` - browser-based editor for Events and Sponsors JSON
- `assets/css/pages.css` - shared styles for the sub-pages (header, footer, buttons, prose, FAQ)
- `assets/js/site.js` - contact/newsletter form handling and GA4 event tracking (gtag.js itself is loaded from each page's `<head>`)
- `assets/js/content.js` - renders Events and Sponsors on the homepage from `data/*.json` (falls back to the static cards)
- `api/lead.js` - Vercel serverless function that forwards contact + newsletter submissions to the GHL webhook
- `data/events.json`, `data/sponsors.json` - source of truth for homepage Events and Sponsors
- `docs/content-management.md` - simple update workflow for Andrew's team
- `package.json` - marks the repo as a Vercel project (Node serverless functions)
- `assets/brand/` - brand and relationship imagery
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

## Configuration & environment variables

Each variable is marked **🔒 secret** (store only in the host's encrypted env
settings — never commit) or **🌐 public** (safe to expose; lives in client code).

### Required

| Variable | Where to set | Used by | Secret? |
| --- | --- | --- | --- |
| `GHL_WEBHOOK_URL` | Vercel env | `api/lead.js` — forwards every contact + newsletter submission to the GoHighLevel inbound webhook | 🔒 secret |

The webhook URL is read server-side only and never exposed to the browser. The
forms need `GHL_WEBHOOK_URL`; Events and Sponsors do not use GHL.

### Public identifiers (not env vars — set directly in code)

| Item | Where | Notes |
| --- | --- | --- |
| Google Analytics 4 measurement ID | gtag.js snippet in the `<head>` of every page (`G-D3DW5X6G2T`) | `assets/js/site.js` sends events (`lead_submit`, `eventbrite_click`, `cta_click`) via the global `gtag`. GA4 measurement IDs are public. |
| Eventbrite | links in `index.html` | Public event/organizer URLs. |
| Instagram | contact + footer links | Public profile URL. |
| Contact email | `contact@millersmarketinggroup.com` in `index.html` | Public address; GHL handles lead routing/notifications. |

> Mailchimp has been removed entirely — forms and the newsletter now flow
> through the GoHighLevel webhook.

### Events and Sponsors content

Events and Sponsors are maintained directly in:

- `data/events.json`
- `data/sponsors.json`

Andrew's team can use `content-manager.html` to load the current files, add or
remove items, edit details, and download updated JSON. Replace the matching file
in `data/` and commit the change. See
[`docs/content-management.md`](docs/content-management.md) for the step-by-step
workflow.

When new variables are added, document them and keep this section in sync.
