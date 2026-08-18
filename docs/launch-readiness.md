# MMG Launch Readiness

Last reviewed: August 17, 2026

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

**Status: Open**

The Vercel production deployment currently requires Vercel authentication, and
the public `millersmarketinggroup.com` domain still serves the previous
WordPress website.

Before launch:

- Disable Deployment Protection for the public Production environment.
- Add `millersmarketinggroup.com` and `www.millersmarketinggroup.com` to the
  Vercel project.
- Update DNS only after the Vercel URL passes acceptance testing.
- Confirm SSL is active on both domain variants.
- Keep a backup of the WordPress site for rollback.

### 2. Production services have not been acceptance-tested

**Status: Open**

Confirm these Production environment variables are configured in Vercel:

- `GHL_WEBHOOK_URL`
- `CONTENT_ADMIN_PASSWORD`
- `CONTENT_SESSION_SECRET`
- `BLOB_READ_WRITE_TOKEN`
- `IG_APP_ID`
- `IG_APP_SECRET`

Test the consultation form, newsletter form, content-manager login, event and
sponsor publishing, image upload, Instagram import, logout, and session expiry
against the actual Vercel deployment.

### 3. Legacy WordPress redirects

**Status: Implemented in repository; pending deployment verification**

`vercel.json` now redirects the important URLs from the previous WordPress
site to the appropriate homepage section or replacement page. Verify every
redirect after the next Vercel deployment and before changing DNS.

### 4. Upcoming-event date rollover

**Status: Implemented in repository; pending deployment verification**

Dated events are now classified against the current local date whenever the
API or browser fallback renders them. Today and future dates remain Upcoming;
expired dates move to Past automatically. Undated recurring series remain
Upcoming until an explicit date is assigned or the record is removed.

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

### 7. Florida Bar compliance verification

**Status: Documentation and legal approval required**

Obtain Andrew's current qualifying-provider registration or annual-reporting
documentation and have Florida counsel approve the final website and disclaimer
language. The site must not imply endorsement by The Florida Bar, guarantee
referrals or cases, or describe MMG as a law firm or medical provider.

### 8. Lead and admin hardening

**Status: Open**

The lead endpoint currently sends submissions directly to GHL without a
durable secondary copy or retry queue. If maintaining a backup is a launch
requirement, add a serverless database such as Turso or Postgres rather than a
local SQLite file on Vercel.

Before or immediately after launch:

- Add rate limiting or bot protection to lead submissions.
- Add rate limiting to the content-manager login.
- Restrict uploads to an explicit safe MIME-type allowlist.
- Add production monitoring for failed form submissions and server errors.

