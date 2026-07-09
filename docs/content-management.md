# Events and Sponsors Content Management

MMG Events and Sponsors are managed with simple JSON files, not GHL.

- Events: `data/events.json`
- Sponsors: `data/sponsors.json`
- Optional helper: `content-manager.html`

## Recommended Workflow

1. Open `content-manager.html` from the deployed site or local preview.
2. Choose **Events** or **Sponsors**.
3. Add, update, duplicate, or remove items.
4. Click **Download JSON**.
5. Replace the matching file in `data/`.
6. Commit and deploy the change.

The content manager only edits files in your browser. It does not publish by
itself, so the downloaded JSON still needs to be added to the repository.

## Event Fields

| Field | Required | Notes |
| --- | --- | --- |
| `id` | Yes | Stable unique slug, for example `july-pi-mixer`. |
| `title` | Yes | Event title shown on the homepage. |
| `status` | Yes | Use `upcoming` or `past`. Only `upcoming` appears in Upcoming Events. |
| `date` | No | Use `YYYY-MM-DD` for dated events. Leave blank for recurring series. |
| `cadence` | No | Recurring schedule, such as `Last Thursday each month`. |
| `city` | No | City shown in the event card. |
| `venue` | No | Venue name. |
| `type` | No | Event category, such as `Networking mixer`. |
| `summary` | No | One or two short sentences. |
| `image` | No | Site-relative asset path or public image URL. |
| `registerUrl` | No | Eventbrite or organizer URL. |
| `registerLabel` | No | Button label. Defaults to Eventbrite wording when blank. |
| `recapUrl` | No | Instagram recap or other recap URL for past events. |
| `recapImage` | No | Thumbnail shown on the past-event recap link. |
| `recapLabel` | No | Text shown on the recap link. |
| `recapMeta` | No | Comma-separated tags, such as `Flyer archive, Video recap, Sponsor recognition`. |
| `featured` | No | `true` or `false`; reserved for future highlighting. |

## Sponsor Fields

| Field | Required | Notes |
| --- | --- | --- |
| `id` | Yes | Stable unique slug, for example `the-mri-guys`. |
| `name` | Yes | Sponsor or partner name. |
| `logo` | No | Site-relative asset path or public image URL. |
| `url` | No | Sponsor website URL. |
| `tier` | No | Optional internal label, such as `Gold`. |

## Publishing Notes

- Upload new event flyers to `assets/events/upcoming/` or `assets/events/past/`.
- Upload sponsor logos to `assets/partners/`.
- Use WebP, PNG, or JPG assets that are reasonably compressed.
- Move finished events from `upcoming` to `past` after the event date.
- Keep Eventbrite as the registration destination.
