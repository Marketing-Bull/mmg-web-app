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
| `status` | **Automatic** — `upcoming` or `past`, based on `date` (undated/recurring events are always `upcoming`). Read-only. |
| `cadence` | Recurring schedule, such as `Last Thursday each month`. |
| `city` | City shown in the event card. |
| `venue` | Venue name. |
| `type` | Dropdown of previously-used categories. Pick **+ Add new type…** to add one on the fly. |
| `summary` | One or two short sentences. |
| `image` (Event Flyer Image) | Paste an Instagram post/reel URL and click **Use this Instagram photo**, or use **Upload an image** to pick a file directly. Max 3MB. |
| `registerUrl` | Eventbrite or organizer URL. |
| `registerLabel` | Button label. Defaults to Eventbrite wording when blank. |
| Recap | One combined control: paste an Instagram reel URL and click **Pull from Instagram**, or **upload a video** directly (max 3MB). Whichever is used populates the recap link/thumbnail shown on past-event cards. |

## Sponsor Fields

| Field | Notes |
| --- | --- |
| `name` | Sponsor or partner name. |
| `id` | **Automatic** — generated from the name, read-only. |
| `logo` | **Upload only** (no Instagram option) — pick an image file directly. Max 3MB. |
| `url` | Sponsor website URL. |
| `tier` | Optional internal label, such as `Gold`. |

## Upload limits

Files (images and recap videos) go through the site's own server, which has
a **3MB per-file limit**. For a longer or larger recap video, use the
Instagram reel pull option instead, or compress the clip before uploading.

## How publishing works (for reference)

- Publishing writes the current list to the site's storage (Vercel Blob).
  The homepage's `/api/events` and `/api/sponsors` read from there, so a
  publish goes live without a deploy.
- If nothing has ever been published, the homepage falls back to the
  committed seed files (`data/events.json`, `data/sponsors.json`), and
  further back to the static cards already in `index.html` if those are
  unavailable too.
- Events move themselves from "upcoming" to "past" automatically once their
  date passes — no manual status update needed.
- Keep Eventbrite as the registration destination.
