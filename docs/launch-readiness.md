# MMG Launch Readiness

Last reviewed: August 18, 2026

## Verdict

The architecture is a good fit for Miller's Marketing Group: static pages on
Vercel, serverless form handling, Vercel Blob for Events and Sponsors, GHL for
CRM and newsletter submissions, and Eventbrite for event registration. The
design is polished, responsive, and appropriate for a focused single-page
business website.

The site is not ready for public launch until the open blockers below are
completed. The largest blockers are deployment access, production acceptance
testing, final content approval, and Florida Bar compliance verification.

## Launch Blockers

### 1. Production deployment and domain are not public

**Status: Resolved — verified August 18, 2026**

The site is live. Verified with unauthenticated requests:

- `millersmarketinggroup.com` redirects to `www.millersmarketinggroup.com` and
  returns the new site over HTTPS.
- `www.millersmarketinggroup.com` returns the new site (200), not WordPress.
- `mmg-web-app.vercel.app` also resolves publicly to the same deployment.

Deployment Protection is still enabled for everything *except* production, which
is the configuration to keep: per-deployment URLs and branch previews (for
example the PR preview for this branch) still return a 302 to Vercel's login, so
unreleased work stays private while the live site is open to everyone. Nothing
further is needed here.

Keep the WordPress backup until the site has run clean for a few weeks.

### 2. Production services have not been acceptance-tested

**Status: Partially verified**

Three of the six Production environment variables were confirmed present by
probing the deployment (`mmg-web-app.vercel.app`) on August 18, 2026:

| Variable | Status | How it was established |
| --- | --- | --- |
| `GHL_WEBHOOK_URL` | Confirmed set | `POST /api/lead` with a deliberately invalid email returned `400 A valid email is required.` A missing webhook returns `500 Lead webhook is not configured.` before validation runs. No lead was created. |
| `CONTENT_ADMIN_PASSWORD` | Confirmed set | `POST /api/admin/login` with a wrong password returned `401 Incorrect password.` If either login variable were missing, it would return `500 Content manager login is not configured yet.` |
| `CONTENT_SESSION_SECRET` | Confirmed set | Same probe as above — the handler checks both variables together. |
| `BLOB_READ_WRITE_TOKEN` | Unverified | Not observable without logging in: `/api/events` and `/api/sponsors` fall back to the committed seed silently whether Blob is unreachable or simply has nothing published. Both currently return the seed unchanged. |
| `IG_APP_ID` | Unverified | Only reachable through an authenticated endpoint. |
| `IG_APP_SECRET` | Unverified | Only reachable through an authenticated endpoint. |

To settle the remaining three, log in to `content-manager.html` on the
deployment and open `/api/admin/status` in the same browser. It reports
presence for all six variables plus whether Blob is reachable and whether
Events/Sponsors have ever been published. It never returns a value.

Still required: test the consultation form, newsletter form, content-manager
login, event and sponsor publishing, image upload, Instagram import, logout,
and session expiry against the actual Vercel deployment. Note that Deployment
Protection (Vercel Authentication) is currently on for everything except custom
domains, so the deployment is not publicly reachable yet — see blocker 1.

### 3. Legacy WordPress redirects

**Status: Implemented in repository; pending deployment verification**

`vercel.json` now redirects the important URLs from the previous WordPress
site to the appropriate homepage section or replacement page. Verify every
redirect after the next Vercel deployment and before changing DNS.

### 4. Upcoming-event date rollover

**Status: Implemented in repository; pending deployment verification**

Dated events are now classified against the current local date whenever the
API or browser fallback renders them. Today and future dates remain Upcoming;
expired dates move to Past automatically. Undated records remain hidden from
Upcoming until an explicit date is assigned.

### 5. Final Events and Sponsors content

**Status: Open**

The committed fallback contains recurring event series rather than a complete
set of current dated events, and several sponsor records do not include a
committed logo. Publish and verify the current Blob content before launch:

- Current event dates, cities, flyers, and Eventbrite links
- Past-event flyers, recap links, and recap thumbnails
- Current client and sponsor names, links, logos, and logo permissions

### 6. Final offer positioning

**Status: Decision required**

Andrew previously identified Marketing Retainers and Sponsorship Packages as
the two independently purchasable offers. The homepage currently also presents
Consulting as a standalone offer. Confirm whether Consulting is now a paid
standalone service; otherwise make Marketing Retainers and Sponsorship Packages
the two primary commercial offers and treat Events as the relationship-building
program that supports them.

### 7. Link previews when the URL is shared

**Status: Implemented in repository; pending deployment verification**

Every page now carries a full Open Graph and Twitter Card set pointing at a
purpose-built 1200x630 card (`assets/brand/social-card.jpg`, source in
`scripts/social-card.html`). Previously only the homepage had preview tags, and
its image was the WebP hero photo — a format several scrapers skip, at an
aspect ratio no platform crops cleanly.

After deployment, re-scrape the URL in each validator so the platforms drop
their cached previews: X/Twitter (cards-dev.twitter.com/validator), Facebook
(developers.facebook.com/tools/debug), LinkedIn (linkedin.com/post-inspector).

### 8. Florida Bar compliance verification

**Status: Documentation and legal approval required**

Obtain Andrew's current qualifying-provider registration or annual-reporting
documentation and have Florida counsel approve the final website and disclaimer
language. The site must not imply endorsement by The Florida Bar, guarantee
referrals or cases, or describe MMG as a law firm or medical provider.

### 9. Lead and admin hardening

**Status: Implemented in repository; pending deployment verification**

Completed:

- Per-IP rate limiting on lead submissions (5 per 10 minutes), the
  content-manager login (8 per 15 minutes), admin content reads and publishes
  (60 per 5 minutes), and uploads and Instagram imports (30 per 10 minutes).
  See `lib/rateLimit.js`.
- Uploads restricted to an explicit MIME allowlist (JPG, PNG, GIF, WebP, MP4,
  MOV, WebM), each verified against the file's magic bytes. SVG is excluded
  because browsers execute script inside it. The content manager's file
  pickers now offer the same list.
- Submitted lead fields are trimmed and length-capped before being forwarded
  to GHL; publishes are capped at 500 items and 512KB.
- Timeouts on both outbound calls (GHL webhook, Instagram oEmbed) so a stalled
  third party can't hold a request open.
- The Instagram importer only downloads thumbnails from Meta's own CDNs.
- Security headers in `vercel.json`: Content-Security-Policy, HSTS,
  `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`,
  `Permissions-Policy`, `Cross-Origin-Opener-Policy`, and `X-Robots-Tag:
  noindex` on `/api/*` and the content manager.
- Admin responses are marked `no-store`.
- Tests covering the limiter and the upload allowlist run in CI
  (`scripts/hardening.test.mjs`).

Verified against the preview deployment on August 18, 2026:

- **Security headers** are present on every response, and the social card is
  served as `image/jpeg`.
- **The CSP** produced no violations across every page (headless browser), and
  GoHighLevel's `external-tracking.js` was inspected directly — it only calls
  `backend.leadconnectorhq.com`, already covered by `connect-src`'s
  `https://*.leadconnectorhq.com`. Re-check the console if a third-party script
  is ever added or updated.
- **Rate limiting** returns 429 with `Retry-After` under load. Measured against
  `/api/lead` from a single IP, nominal limit 5 per 10 minutes: 7 serial
  requests were all allowed, 30 serial requests produced 10 rejections, and 20
  concurrent requests produced 13. The counters are per function instance, so a
  small burst passes and a sustained or concurrent flood is throttled.

Recommended before launch, given that measurement:

- Enable **Vercel Firewall → Rate Limiting** on the project. It runs at the
  edge with shared state, before any function is invoked, and gives a hard
  limit that the in-code limiter cannot. The in-code limiter then stays as
  defense in depth.
- Set `CONTENT_ADMIN_PASSWORD` to a long random passphrase rather than a
  memorable one. The per-instance ceiling applies to the login endpoint too, so
  password strength matters more than the attempt limit does.

Still open:

- The lead endpoint still sends submissions directly to GHL without a durable
  secondary copy or retry queue. If maintaining a backup is a launch
  requirement, add a serverless database such as Turso or Postgres rather than
  a local SQLite file on Vercel.
- Add production monitoring for failed form submissions and server errors.
- The public `/api/events` and `/api/sponsors` feeds are intentionally not rate
  limited: they set `s-maxage=60`, so a flood is absorbed by the CDN rather than
  the origin, and a per-IP limit there would risk blocking legitimate visitors
  behind shared networks. Confirmed working on the live site — repeated requests
  return `x-vercel-cache: HIT` with a rising `age`. The `cache-control: public,
  max-age=0, must-revalidate` in the response is what Vercel sends to the
  browser; `s-maxage` is consumed by the CDN and not passed through, so it is
  not a sign that caching is off.
