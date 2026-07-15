# Miller's Marketing Group Website

Static homepage mockup for Miller's Marketing Group.

## Project Structure

- `index.html` - Vercel-served homepage
- `faq.html` - frequently asked questions
- `privacy-policy.html`, `terms-of-service.html`, `disclaimer.html`, `accessibility.html` - legal and accessibility pages
- `404.html`, `robots.txt`, `sitemap.xml` - launch support files
- `content-manager.html` - password-protected editor for Events and Sponsors, with Instagram-based image import and direct file upload
- `assets/css/pages.css` - shared styles for the sub-pages (header, footer, buttons, prose, FAQ)
- `assets/js/site.js` - contact/newsletter form handling and GA4 event tracking (gtag.js itself is loaded from each page's `<head>`)
- `assets/js/content.js` - renders Events and Sponsors on the homepage: `/api/events`+`/api/sponsors` (live, published) → `data/*.json` (seed) → static cards
- `api/lead.js` - forwards contact + newsletter submissions to the GHL webhook
- `api/events.js`, `api/sponsors.js` - public read endpoints; serve published content from Vercel Blob, falling back to the `data/*.json` seed
- `api/admin/login.js`, `api/admin/logout.js` - shared-password session login for the content manager
- `api/admin/content.js` - authenticated read/publish of Events and Sponsors (writes to Vercel Blob)
- `api/admin/instagram.js` - authenticated: resolves a pasted Instagram post/reel URL to its image and copies it to Vercel Blob
- `api/admin/upload.js` - authenticated: direct file upload (event flyers, sponsor logos, recap video clips) to Vercel Blob, 3MB limit
- `lib/auth.js` - password check + signed session cookie helpers
- `lib/blobStore.js` - Vercel Blob read/write helpers for content JSON and imported media
- `data/events.json`, `data/sponsors.json` - initial seed content (used until the first Publish, and as a fallback after)
- `docs/content-management.md` - editing workflow for Andrew's team
- `package.json` - marks the repo as a Vercel project (Node serverless functions, `@vercel/blob`)
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

When new variables are added, document them and keep this section in sync.
