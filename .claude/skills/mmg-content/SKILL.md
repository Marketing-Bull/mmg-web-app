---
name: mmg-content
description: Add or update sponsors and events on the Miller's Marketing Group site - sourcing a sponsor's logo from their own website, setting the tile background colour so the logo blends, adding upcoming or past events with flyers and recap videos, and keeping index.html's static fallback in step with data/*.json. Use whenever asked to add, remove, or change a sponsor, partner, partner logo, event, mixer, or flyer on this site.
---

# Sponsors and events on the MMG site

## The one thing that trips everyone up

`/api/sponsors` and `/api/events` serve **Vercel Blob first** and only fall back to
the committed `data/*.json`. If content has ever been published from
`content-manager.html`, the Blob copy wins and **your commit will not appear on the
live site** until someone opens the content manager and clicks **Publish Sponsors** /
**Publish Events** once.

Always say this in the PR. It is not optional context — it is the difference between
the change going live and silently doing nothing.

## Where things live

| | |
| --- | --- |
| Sponsor data | `data/sponsors.json` — one line per sponsor, keep that style |
| Event data | `data/events.json` |
| Logos | `assets/partners/` |
| Event flyers | `assets/events/upcoming/`, `assets/events/past/` |
| Renderer | `assets/js/content.js` — `sponsorCard()`, `eventCard()`, `pastEventCard()` |
| Static fallback | `index.html` — hand-written copies of both grids |
| Admin UI | `content-manager.html` — field schemas near `fields: [` |
| CI | `node scripts/validate.mjs` |

`index.html` carries a copy of each grid that shows before `content.js` swaps in the
live feed, and it is **all a visitor without JavaScript ever sees**. It must stay in
step with the data and match the renderer's markup exactly.

## Adding a sponsor

1. **Get the real logo from the sponsor's own site.** Fetch the homepage and look for
   `logo` in image URLs, a WordPress `id="logo"` / `wp-custom-logo` image, a Squarespace
   `logoImageUrl`, or the `og:image`. Prefer a wordmark lockup over an icon-only mark.
   Never redraw or approximate a brand logo.

2. **Trim and size it.** Crop to the alpha bounding box, cap at 400×200, save WebP q90.
   That lands around 5–35KB and is ~55% smaller than PNG.

3. **Derive the tile background — measure it, do not eyeball it:**
   ```bash
   python3 .claude/skills/mmg-content/scripts/logo_bg.py assets/partners/<file>
   python3 .claude/skills/mmg-content/scripts/logo_bg.py --write data/sponsors.json
   ```
   See "Background colours" below for why this matters.

4. **Add the record** to `data/sponsors.json`. The `id` must equal what the content
   manager's own `slug()` would produce from the name — lowercase, non-alphanumerics to
   `-`, trimmed, capped at 60 chars. Get this wrong and editing the sponsor in the
   admin UI creates a *second* record instead of updating yours.

5. **Sync the static grid** (never hand-edit it):
   ```bash
   python3 .claude/skills/mmg-content/scripts/sync_static_sponsors.py
   ```

6. **Verify** (see the checklist).

## Background colours

A logo either sits on transparency or has a flat backdrop baked into the file. The card
paints `--partner-bg` behind it so the image blends into the tile instead of sitting on
it as a visible rectangle.

- **Baked-in backdrop** → set `bg` to that exact colour. A white logo panel against the
  cream card differs by about 2/255 per channel — invisible when skimming, obvious once
  you know. This is why it is measured, not judged by eye.
- **White or light artwork on transparency** → needs a **dark** `bg`, or it disappears
  entirely on the light card. Also **flatten that dark backdrop into the asset itself**,
  so the logo stays legible even if a stale published record omits the colour.
- **Dark artwork on transparency** → leave `bg` empty for the default card.

`content.js` sanitises `bg` to a hex literal before it reaches the style attribute and
adds `partner-card-dark` (inverting caption and border) below a luminance of 140. The
sync script mirrors that threshold — change one, change both.

## Adding an event

Same shape, in `data/events.json`. `status` is recomputed from `date` at render time, so
it is a hint, not the source of truth. `venue` is stored but not displayed — put the time
and venue in `summary` if visitors need them.

- **Upcoming**: replace the `.events-empty` block in `index.html` with the card.
- **Past**: `image` is the flyer, `recapUrl` / `recapImage` the recap link and thumbnail.
  `pastEventCard()` omits the media strip entirely when there is neither, so a card
  without artwork renders as clean text rather than an empty dark "Original flyer" panel.

**Flyer source.** If the flyer is not attached, the Eventbrite listing's `og:image` is
the same artwork the organizer uploaded. It needs the signed URL from the tag —
`img.evbuc.com` returns 403 for an unsigned one. Eventbrite **delists past events**, so
this only works while the event is upcoming; grab flyers before the date passes.

**Recap video — link it, do not host it.** `recapUrl` is an outbound link, not a video
file. Every past event points at Instagram, and `docs/content-management.md` says to use
the reel for anything past the content manager's 3MB upload limit — a phone recording of
a mixer is tens of megabytes, so that is always. Do not commit a transcode into the repo
to fill this in; it bloats git permanently and breaks the pattern. If someone hands you a
recap file, ask for the reel URL instead.

When there is no reel for that event yet, use the fallback the bowling and February cards
already use rather than inventing one: the profile URL
`https://www.instagram.com/millers_marketing_group34/`, an existing still from
`assets/events/recaps/`, and the **plural** label `Watch event recaps`. The plural matters
— it is what keeps a reused still from implying it is that evening's footage. Say in the
PR that `recapUrl` should be swapped for the real reel when one exists.

A card with a recap and no flyer is single-media; `pastEventCard()` handles that, so let
it, rather than padding the card with a stand-in flyer.

**Video that genuinely is hosted here** — the MMG Connect promo in `#app`, not recaps —
is HEVC out of a phone, which **Safari plays and Chrome and Firefox do not**. Transcode
it and generate a poster so the section costs nothing until play:
```bash
ffmpeg -i in.mov -c:v libx264 -profile:v high -pix_fmt yuv420p -crf 26 -preset slow \
       -c:a aac -b:a 128k -movflags +faststart out.mp4
```
Then `<video controls playsinline preload="none" poster="...">`. Check for narration
(`silencedetect` — speech shows repeated short gaps, a music bed shows none); narration
needs captions.

## Files the user references but you cannot read

A `file:///Users/...` path is on their machine, not in this container. Do not guess at the
contents and do not silently skip it — try a legitimate remote source (the sponsor's site,
the Eventbrite `og:image`), and if that fails, say plainly that the file needs attaching
as an upload. An image pasted into chat is visible to you but is **not** a file you can
commit; only actual uploads land in the uploads directory.

**Google Drive links.** The Drive connector authenticates fine — `get_file_metadata` and
`get_file_permissions` work, so read those first to get the real size and sharing before
deciding anything. The catch is transport, not permission: `download_file_content` returns
the file **base64 into the conversation**, so it is fine for a logo and unusable for a
video (50MB of media is ~67MB of base64, past any context window). And a file shared only
to the `getmarketingbull.com` domain gives an anonymous `curl` a sign-in page, not the
bytes.

So for anything large: ask them to set link sharing to "Anyone with the link" for a minute
and fetch it with `curl` straight to disk. `share_file` could flip that yourself, but it
makes their file reachable by anyone holding the link — never do it without them saying so
explicitly. Be precise about which of these is the blocker; "I can't access it" is wrong
and invites a reasonable "can't you use the connector?"

## Verification checklist

```bash
node scripts/validate.mjs   # fails on a logo path pointing at no file, or a bad bg
python3 .claude/skills/mmg-content/scripts/sync_static_sponsors.py --check
```

Then render the page and confirm:

- Static (JavaScript disabled) and live markup are **identical** for the grid you touched.
- Every logo/flyer actually loads, and no card shows an empty media panel.
- Dark tiles have light captions.
- No console errors.

**Logos are `loading="lazy"`.** Scroll the grid into view and wait before checking
`naturalWidth`, or every off-screen image reports as broken and you will chase a bug that
does not exist.

Screenshot at 1440px and 390px. Layout bugs here hide at in-between widths — a square
image in a `object-fit: cover` box that goes wide and short crops the subject out, and
that only shows up between breakpoints, so sweep several widths rather than two.
