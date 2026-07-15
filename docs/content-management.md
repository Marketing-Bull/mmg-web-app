# Events and Sponsors Content Management

MMG Events and Sponsors are edited through a password-protected content
manager. Publishing is instant — no downloads, no git, no file replacing.

- Editor: `content-manager.html` (linked from the deployed site, not the public nav)
- Login: one shared password for Andrew's team
- Media: paste an Instagram post or reel URL; the image is copied
  automatically to fast site storage — no manual resizing or uploading

## Workflow

1. Open `content-manager.html` on the deployed site and log in.
2. Choose **Events** or **Sponsors**.
3. Add, update, duplicate, or remove items. Changes are saved in your
   browser as you go.
4. For any image (event flyer, recap thumbnail, sponsor logo): paste the
   Instagram post or reel URL into the Instagram field and click
   **Use this Instagram photo**. The image is fetched and copied to the
   site's own storage automatically.
5. Click **Publish Events** (or **Publish Sponsors**) to make the changes
   live. The homepage picks them up within a minute or two.

If your session expires while editing, log back in — your in-progress
changes are still there; nothing is lost.

## Event Fields

| Field | Required | Notes |
| --- | --- | --- |
| `id` | Yes | Stable unique slug, generated automatically from the title if left blank. |
| `title` | Yes | Event title shown on the homepage. |
| `status` | Yes | Use `upcoming` or `past`. Only `upcoming` appears in Upcoming Events. |
| `date` | No | Use `YYYY-MM-DD` for dated events. Leave blank for recurring series. |
| `cadence` | No | Recurring schedule, such as `Last Thursday each month`. |
| `city` | No | City shown in the event card. |
| `venue` | No | Venue name. |
| `type` | No | Event category, such as `Networking mixer`. |
| `summary` | No | One or two short sentences. |
| `image` | No | Paste an Instagram URL, or a direct image URL under "Or paste an image URL directly". |
| `registerUrl` | No | Eventbrite or organizer URL. |
| `registerLabel` | No | Button label. Defaults to Eventbrite wording when blank. |
| `recapUrl` | No | Instagram recap or other recap URL for past events. |
| `recapImage` | No | Thumbnail for the past-event recap link — same Instagram-paste flow as `image`. |
| `recapLabel` | No | Text shown on the recap link. |
| `recapMeta` | No | Comma-separated tags, such as `Flyer archive, Video recap, Sponsor recognition`. |
| `featured` | No | Reserved for future highlighting. |

## Sponsor Fields

| Field | Required | Notes |
| --- | --- | --- |
| `id` | Yes | Stable unique slug, generated automatically from the name if left blank. |
| `name` | Yes | Sponsor or partner name. |
| `logo` | No | Paste an Instagram URL, or a direct image URL under "Or paste an image URL directly". |
| `url` | No | Sponsor website URL. |
| `tier` | No | Optional internal label, such as `Gold`. |

## How publishing works (for reference)

- Publishing writes the current list to the site's storage (Vercel Blob).
  The homepage's `/api/events` and `/api/sponsors` read from there, so a
  publish goes live without a deploy.
- If nothing has ever been published, the homepage falls back to the
  committed seed files (`data/events.json`, `data/sponsors.json`), and
  further back to the static cards already in `index.html` if those are
  unavailable too.
- Move finished events from `upcoming` to `past` after the event date.
- Keep Eventbrite as the registration destination.
