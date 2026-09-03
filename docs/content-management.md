# Events and Sponsors Content Management

MMG Events and Sponsors are edited through a password-protected content
manager. Publishing is instant — no downloads, no git, no file replacing.

- Editor: `content-manager.html` (linked from the deployed site, not the public nav)
- Login: one shared password for Andrew's team
- Media: paste an Instagram URL for auto-import, or upload a file directly —
  either way it's copied to fast site storage automatically, up to 3MB per file

## Workflow

1. Open `content-manager.html` on the deployed site and log in.
2. Choose **Events** or **Sponsors**.
3. Add, update, duplicate, or remove items. Changes are saved in your
   browser as you go. The list is sorted **newest first** (recurring/undated
   events sort to the bottom).
4. Click **Publish Events** (or **Publish Sponsors**) to make the changes
   live. The homepage picks them up within a minute or two.

If your session expires while editing, log back in — your in-progress
changes are still there; nothing is lost.

## Event Fields

| Field | Notes |
| --- | --- |
| `featured` | Checkbox at the top of the form. Reserved for future highlighting. |
| `title` | Event title shown on the homepage. |
| `id` | **Automatic** — generated from the title, read-only. |
| `date` | Use `YYYY-MM-DD` for dated events. Leave blank for recurring series. |
| `status` | **Automatic** — `upcoming`, `past`, or `undated`, based on `date`. Only dated events can appear in Upcoming. Read-only. |
| `cadence` | Recurring schedule, such as `Last Thursday each month`. |
| `city` | City shown in the event card. |
| `venue` | Venue name. |
| `type` | Dropdown of previously-used categories. Pick **+ Add new type…** to add one on the fly. |
| `summary` | One or two short sentences. |
| `image` (Event Flyer Image) | Paste an Instagram post/reel URL and click **Use this Instagram photo**, or use **Upload an image** to pick a file directly. Max 3MB. |
| `registerUrl` | Eventbrite or organizer URL. |
| `registerLabel` | Button label. Defaults to Eventbrite wording when blank. |
| Recap | One combined control: paste an Instagram reel URL and click **Pull from Instagram**, or **upload a video** directly (max 3MB). Whichever is used populates the recap link/thumbnail shown on past-event cards. |
| `recapMeta` | Comma-separated tags under a past-event card. Leave blank and it is built from what the event actually has. |

### What an event needs to look right

**An event moves from Upcoming to Past on its own.** The saved `status` is only a
hint — both `/api/events` and the homepage recompute it from `date` on every
load, against Florida time. Nothing to publish or edit on the day; a September 24
event is in Upcoming on the 24th and in Past on the 25th.

To appear at all, an event needs **`title`** and a **`date`** in `YYYY-MM-DD`.
Without a date it is `undated` and shows in neither list — only recurring series
should be undated.

While it is **upcoming**, the card shows the date badge, `type` • `city`, the
`summary`, and a Register button if `registerUrl` is set. The flyer is optional:
without one the card shows the date on a plain brand-coloured panel, which reads
as a date announced before its artwork exists. Time and venue are not fields the
card renders, so put them in the `summary` if visitors need them.

Once it is **past**, the card switches to the flyer and the recap. All four
combinations are handled, so nothing looks broken while artwork is still coming:

| Has | Card shows |
| --- | --- |
| Flyer + recap | Flyer beside the recap thumbnail |
| Flyer only | Flyer across the full width |
| Recap only | Recap thumbnail across the full width |
| Neither | Clean text card, no media strip |

The badge over the flyer is the `city`, so set it. Leave `recapMeta` blank unless
you want specific tags — the default is derived from what exists (*Flyer archive*
only when there is a flyer, *Video recap* only when there is a recap), so a card
never advertises something it does not have.

## Sponsor Fields

| Field | Notes |
| --- | --- |
| `name` | Sponsor or partner name. |
| `id` | **Automatic** — generated from the name, read-only. |
| `logo` | **Upload only** (no Instagram option) — pick an image file directly. Max 3MB. |
| `bg` | Colour painted behind the logo. Match the logo image's own background so it blends into the tile — white for a logo saved on white, the brand colour for one saved on colour. A logo drawn in **white** needs a dark colour here, otherwise it disappears. Leave blank for a logo with a transparent background. |
| `url` | Sponsor website URL. |
| `tier` | Optional internal label, such as `Gold`. |

## Upload limits

Files (images and recap videos) go through the site's own server, which has
a **3MB per-file limit**. For a longer or larger recap video, use the
Instagram reel pull option instead, or compress the clip before uploading.

Accepted formats:

- **Images:** JPG, PNG, GIF, WebP
- **Video:** MP4, MOV, WebM

Anything else is refused — including SVG, which browsers can run code from.
The file picker only offers the formats above, and the server double-checks
the file's contents rather than trusting its name or extension.

If you are publishing or uploading in quick succession and see a "too many
requests" message, wait a minute and continue — it's an anti-abuse limit, not
an error, and nothing you've entered is lost.

## How publishing works (for reference)

- Publishing writes the current list to the site's storage (Vercel Blob).
  The homepage's `/api/events` and `/api/sponsors` read from there, so a
  publish goes live without a deploy.
- If nothing has ever been published, the homepage falls back to the
  committed seed files (`data/events.json`, `data/sponsors.json`), and
  further back to the static cards already in `index.html` if those are
  unavailable too.
- Dated events move themselves from "upcoming" to "past" automatically once
  their date passes in the `America/New_York` time zone — no manual status
  update needed. Undated records stay hidden from Upcoming until a date is set.
- Keep Eventbrite as the registration destination.
