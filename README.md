# Miller's Marketing Group Website

Static homepage mockup for Miller's Marketing Group.

## Project Structure

- `index.html` - deployable GitHub Pages homepage
- `faq.html` - frequently asked questions
- `privacy-policy.html`, `terms-of-service.html`, `disclaimer.html`, `accessibility.html` - legal and accessibility pages (drafts pending legal review)
- `assets/css/pages.css` - shared styles for the sub-pages (header, footer, buttons, prose, FAQ)
- `assets/js/site.js` - Google Tag Manager loader, contact/newsletter form handling, and analytics events
- `api/lead.js` - Vercel serverless function that forwards contact + newsletter submissions to the GHL webhook
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
| Google Tag Manager container ID | `GTM_ID` constant in `assets/js/site.js` | Replace the `GTM-XXXXXXX` placeholder with MMG's real container. GTM IDs are public by design. The loader skips the placeholder so nothing breaks until it's set. |
| Eventbrite | links in `index.html` | Public event/organizer URLs. |
| Instagram | contact + footer links | Public profile URL. |
| Contact email | `contact@millersmarketinggroup.com` in `index.html` | Public address; GHL handles lead routing/notifications. |

> Mailchimp has been removed entirely — forms and the newsletter now flow
> through the GoHighLevel webhook.

### Not built yet

- **Events data backend** (the "Google Sheet" idea). If/when built it would need
  `GOOGLE_SHEET_ID` 🌐 plus `GOOGLE_SHEETS_API_KEY` 🔒 (or `GOOGLE_SERVICE_ACCOUNT_KEY` 🔒).

When new variables are added, document them in a `.env.example` and keep this
section in sync.

