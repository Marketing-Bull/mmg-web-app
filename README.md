# Miller's Marketing Group Website

Static homepage mockup for Miller's Marketing Group.

## Project Structure

- `index.html` - deployable GitHub Pages homepage
- `faq.html` - frequently asked questions
- `privacy-policy.html`, `terms-of-service.html`, `disclaimer.html`, `accessibility.html` - legal and accessibility pages (drafts pending legal review)
- `assets/css/pages.css` - shared styles for the sub-pages (header, footer, buttons, prose, FAQ)
- `assets/brand/` - brand and relationship imagery
- `assets/events/upcoming/` - current event flyers
- `assets/events/past/` - archived event flyers
- `assets/events/recaps/` - event-specific video thumbnails and recap imagery
- `assets/events/series/` - recurring-event schedule graphics
- `assets/partners/` - current client and sponsor logos
- `docs/discovery/` - stakeholder discovery notes
- `docs/strategy/` - website strategy and brand guidance

GitHub Pages should publish from the repository root so `index.html` remains the
single source of truth.

## Configuration & environment variables

**This project requires no environment variables.** It is a pure static
HTML/CSS site with no build step, no server code, and no `.env` file. It deploys
as flat files (Vercel / GitHub Pages) and runs as-is. There is nothing to
configure to build or serve it.

All third-party integrations currently in the markup are either plain public
links or client-side embeds that use **non-secret, public identifiers** which
belong directly in the HTML — not in `.env`:

| Integration | Where | Notes |
| --- | --- | --- |
| Eventbrite | links in `index.html` | Public event/organizer URLs. No key. |
| Instagram | contact + footer links | Public profile URL. No key. |
| Mailchimp newsletter | embedded form in `index.html` | Public embed (account `u=2102fd3b9a354ec9fef50a91d`, server `us21`). The only value still needed is the **audience ID** (the `AUDIENCE_ID` placeholder in the form `action` and honeypot field), which also goes **in the HTML**, not `.env`. |

### Variables needed only if future backend features are built

None of these exist yet. They become necessary **only if** the corresponding
feature is moved from static markup to a backend / serverless function. Provision
them in the host (e.g. Vercel project settings), not in the repo.

| Feature (not yet built) | Variables | Secret? |
| --- | --- | --- |
| Server-side newsletter signup (instead of the public embed) | `MAILCHIMP_API_KEY`, `MAILCHIMP_AUDIENCE_ID`, `MAILCHIMP_SERVER_PREFIX` (`us21`) | API key is secret |
| Contact form backend (currently a `mailto:`) | `RESEND_API_KEY` **or** `SENDGRID_API_KEY`, plus `CONTACT_TO_EMAIL`; optional `RECAPTCHA_SITE_KEY` / `RECAPTCHA_SECRET_KEY` | API & secret keys are secret |
| Events data backend (the "Google Sheet" idea) | `GOOGLE_SHEET_ID` + `GOOGLE_SHEETS_API_KEY` **or** `GOOGLE_SERVICE_ACCOUNT_KEY` | Key is secret |
| Web analytics | `GA4_MEASUREMENT_ID` (e.g. `G-XXXX`) | Public (script tag) |

If any of the above features are implemented, add a `.env.example` documenting
the variables and keep this table in sync.

