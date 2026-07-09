# Miller's Marketing Group Single-Page Website Plan

**Revised:** June 13, 2026

## 1. Scope

MMG will use a focused single-page website rather than a large multi-page site.
The homepage should explain the business, establish trust, promote events, and
move qualified visitors toward a consultation with Andrew.

Event registration remains on Eventbrite. The MMG website collects consultation
interest and newsletter signups through Vercel serverless functions that forward
submissions to GoHighLevel.

## 2. Site Structure

### Primary page

- `/` - Complete MMG homepage

### Essential supporting pages

- `/privacy/` - Privacy Policy
- `/terms/` - Terms of Service and Disclaimer
- `/accessibility/` - Accessibility Statement
- `/404.html` - Branded not-found page

These supporting pages should be linked from the footer. Separate About,
Services, Sponsorships, Partners, Contact, FAQ, and Events pages are not required
for launch because those subjects are handled on the homepage.

## 3. Homepage Sections

1. Header with anchor navigation and consultation CTA
2. Hero with MMG positioning and featured upcoming event
3. Audience strip for PI attorneys, medical providers, and vendors
4. Marketing, sponsorship, and curated-event offers
5. Simple explanation of how working with MMG feels
6. Upcoming Events with Eventbrite registration links
7. The MMG Experience
8. Past Events with flyers and relevant recap media
9. Andrew Miller story and brand voice
10. Client and sponsor logo wall
11. Sponsorship call to action
12. Consultation section
13. Footer with contact, social, newsletter archive, and legal links

## 4. Content Rules

- Lead with relationships, meaningful introductions, and community.
- Keep marketing retainers and sponsorship packages distinct.
- Focus on personal injury attorneys, medical providers, and vendors.
- Describe the active market as Florida, with an emphasis on South Florida.
- Do not claim guaranteed referrals, cases, clients, or business outcomes.
- Explain that MMG is not a law firm or medical provider.
- Use qualified referral service language only after the exact approved wording
  and registration details are confirmed.
- Avoid unsupported statistics and generic claims.
- Label displayed logos as current clients and sponsors.

## 5. Event Experience

### Upcoming Events

- Support multiple event cards.
- Display all cards on desktop.
- Use a horizontal swipe experience on mobile.
- Include flyer, title, date, location, short description, and status when known.
- Send registration to Eventbrite.
- Include a sponsorship CTA where appropriate.
- Show a useful Eventbrite follow prompt when no specific event is available.

### Past Events

- Use swipeable cards on mobile.
- Include the original flyer.
- Pair each event with a relevant video still or neutral recap image.
- Link to the relevant Instagram recap when available.
- Include a short recap and CTA to the next event or sponsorship conversation.
- Add attendance figures, testimonials, or sponsor outcomes only when verified.

Events may remain manually maintained for the initial static site. Automated
Eventbrite syncing and individual event pages are not required for launch.

## 6. Functional Requirements

- Consultation form must submit through a working service or be replaced by a
  direct email/Calendly flow.
- Forms must include required-field validation, success/error feedback, consent
  language, and basic spam protection.
- Event registration must always lead to Eventbrite.
- Phone, email, Instagram, newsletter, and Eventbrite links must be valid.
- Mobile consultation and event actions must remain easy to reach.

## 7. Accessibility and Technical Requirements

- Responsive desktop and mobile layouts
- Keyboard-accessible navigation and controls
- Visible focus states
- Useful image alt text
- Sufficient color contrast
- Reduced-motion support
- No autoplay video
- Optimized image sizes
- Page title and meta description
- Canonical URL and social-sharing metadata
- Organization and relevant Event structured data
- `sitemap.xml` and `robots.txt`
- Branded `404.html`
- Lightweight analytics for consultation and Eventbrite clicks

## 8. Launch Pages Not Required

The following pages from the original discovery plan are intentionally removed
from launch scope:

- Separate About page
- Separate Services page
- Separate Sponsorships page
- Separate Partners page
- Separate Events hub
- Individual event detail pages
- Results or case-study pages
- FAQ page
- Industry landing pages
- Resource center
- Team page
- Media or press page
- Sponsor portal

These can be added later only when MMG has enough approved content and a clear
business need.

## 9. Current Implementation Status

### Complete

- Single-page homepage structure
- Responsive header and footer
- Clear audience and offer positioning
- Marketing, sponsorship, and event sections
- Multiple upcoming-event cards
- Mobile swipe behavior for events and experience cards
- Past-event flyers and recap links
- Andrew Miller section and portrait
- Client and sponsor logo wall
- Eventbrite registration path
- Mobile quick actions
- Basic accessibility styling and reduced-motion support
- Footer disclaimer language
- Legal and accessibility pages
- FAQ page
- Consultation and newsletter form wiring to `/api/lead`
- JSON-backed Events and Sponsors content rendering
- Browser-based Events and Sponsors content manager
- Google Analytics 4 tracking snippet
- Basic cookie notice
- `sitemap.xml`, `robots.txt`, and branded `404.html`

### Remaining Before Launch

- Add the required Vercel environment variable for the GHL lead webhook.
- Run a real consultation and newsletter submission test after env vars exist.
- Verify current event dates and Eventbrite links when MMG provides the next specific event.
- Confirm any Florida Bar qualifying-provider registration name/number before adding it to the site.
- Optimize unusually large images
- Run final accessibility, mobile, link, and performance checks

## 10. Launch Implementation Plan

### Stage 1 - Confirm Launch Inputs

**Owner:** MMG / website owner

Before final production work begins, confirm:

- Primary phone number and whether the second phone number should remain
- Public business address or whether the site should say only "Plantation,
  Florida"
- Email address that should receive consultation requests
- Whether consultation requests should use a form, Calendly, or both
- Current upcoming events, dates, locations, and Eventbrite URLs
- Exact approved Florida Bar qualified referral service wording, including any
  registration name or number that must appear
- Permission to publish the current logos, event flyers, photos, and video
  thumbnails
- Production domain and preferred analytics choice

**Exit criteria:** one approved launch-information response with no unresolved
contact, event, compliance, or domain details.

### Stage 2 - Finish Core Functionality

**Owner:** Development

- Connect the consultation form to the approved destination.
- Add required-field and email validation.
- Add a consent statement linking to the Privacy Policy.
- Add success, error, and duplicate-submission feedback.
- Add lightweight spam protection.
- Preserve direct phone and email fallbacks.
- Verify every Eventbrite, Instagram, newsletter, phone, and email link.

**Current form approach:** submit consultation and newsletter forms to the Vercel
serverless endpoint at `/api/lead`, which forwards the payload to a GHL webhook.
The Vercel project needs `GHL_WEBHOOK_URL` before submissions can be tested in
production. Events and Sponsors are maintained through `data/events.json`,
`data/sponsors.json`, and `content-manager.html`; they do not use GHL. Calendly
can be added later if MMG provides a booking URL.

**Exit criteria:** a test consultation arrives at the approved inbox and all
external links pass.

### Stage 3 - Add Supporting Pages

**Owner:** Development, with MMG approval

- Create `/privacy/`.
- Create `/terms/` containing Terms of Service and the MMG disclaimer.
- Create `/accessibility/`.
- Create a branded `/404.html`.
- Link all supporting pages from the footer.
- Keep the pages visually consistent with the homepage.

Development can prepare plain-language drafts. MMG is responsible for approving
business facts and compliance language; legal counsel should review legal text
when appropriate.

**Exit criteria:** every footer link works and each page has approved content.

### Stage 4 - SEO, Sharing, and Measurement

**Owner:** Development

- Add the final canonical URL.
- Add Open Graph and social-sharing metadata.
- Create a branded social-sharing image from approved assets.
- Add Organization structured data.
- Add Event structured data for the confirmed featured event.
- Add `sitemap.xml` and `robots.txt`.
- Keep Google Analytics 4 using the approved `G-D3DW5X6G2T` measurement ID.
- Track consultation, phone, email, sponsorship, and Eventbrite clicks.

**Recommended analytics approach:** use Cloudflare Web Analytics if the final
site uses Cloudflare, or Google Analytics only if MMG already has a property and
wants its broader reporting. Analytics can be omitted at initial launch rather
than delaying publication.

**Exit criteria:** metadata validates, crawlers can discover the public pages,
and approved conversion actions are measured.

### Stage 5 - Performance and Accessibility

**Owner:** Development

- Convert oversized PNG/JPEG images to appropriately sized WebP or AVIF assets.
- Replace the 6.7 MB February event flyer with an optimized version.
- Create responsive image sizes for large hero and recap images.
- Confirm heading order, landmarks, labels, and keyboard navigation.
- Test contrast, visible focus, reduced motion, and mobile swipe behavior.
- Test at common phone, tablet, and desktop widths.
- Run Lighthouse or equivalent performance and accessibility checks.

**Exit criteria:** no broken layout or keyboard blockers, no avoidable oversized
images, and acceptable mobile performance.

### Stage 6 - Content Approval and Production Launch

**Owner:** MMG and Development

- Review the homepage on desktop and mobile.
- Confirm all contact details and event information one final time.
- Send a real consultation test and verify Andrew receives it.
- Configure Vercel to deploy the repository root from `main`.
- Add the custom domain and DNS records if one is being used.
- Verify HTTPS, canonical redirects, the sitemap, and the 404 page.
- Tag or record the launch commit.

**Exit criteria:** the production URL loads over HTTPS, all CTAs work, and MMG
has approved the published content.

## 11. What MMG Must Provide

The following is the minimum launch packet needed from the website owner:

1. **Contact**
   - Primary public phone number
   - Whether `954-869-8435` should remain
   - Consultation inbox
   - Public location or full address
   - Correct Calendly URL, if used

2. **Events**
   - Every event that should appear as upcoming on launch day
   - Event title, date, time, location, and Eventbrite URL
   - Events that should move to Past Events
   - Correct Instagram recap URL for each featured past event

3. **Compliance**
   - Approved wording for MMG's Florida Bar qualified referral service status
   - Registered name and registration number, if the number must be displayed
   - Confirmation that MMG does not provide legal or medical advice and does not
     guarantee referrals, cases, clients, or outcomes
   - Any required cancellation, photo/video, or event accessibility language

4. **Permissions**
   - Written confirmation that MMG may publish the displayed client and sponsor
     logos
   - Written confirmation that MMG may publish the event flyers, Andrew photo,
     event photos, and recap thumbnails
   - Corrections to any logo relationship label

5. **Publishing**
   - Final production domain, or approval to launch first at the Vercel production URL
   - Access to the domain's DNS settings when the custom domain is connected
   - Analytics choice: none, Cloudflare Web Analytics, or Google Analytics
   - Google Analytics measurement ID if Google Analytics is selected

6. **Approval**
   - Andrew's approval of the homepage messaging and biography
   - Approval of the legal-page drafts
   - Name of the person authorized to approve the final launch

## 12. Items That Do Not Need To Delay Launch

- Automated Eventbrite syncing
- Individual event pages
- Case studies and testimonials
- Attendance statistics
- Newsletter signup
- Advanced analytics
- A content management system
- A custom domain, if the Vercel production URL is acceptable temporarily

These can be added after launch without changing the single-page strategy.

## 13. Definition of Done

The site is ready when:

- Andrew can understand and approve the offer, audience, and next step.
- Visitors understand MMG within ten seconds.
- Upcoming and past events are accurate.
- Every CTA works.
- Consultation requests reach Andrew reliably.
- Legal and accessibility pages are published.
- Approved compliance language is visible.
- The site passes mobile, keyboard, link, and basic performance checks.
- Vercel serves the current production branch successfully.
