# GHL content model — Events & Sponsors

This document defines the **Custom Objects** to create in GoHighLevel (GHL) so the
website can pull Events and Sponsors from GHL. After you create these, the
scheduled sync (`scripts/sync-ghl.mjs` via `.github/workflows/sync-ghl.yml`)
pulls the records into `data/events.json` and `data/sponsors.json`, which the
site reads at runtime.

> Field **keys** below are the GHL custom-field keys the sync script maps from.
> If you name fields differently in GHL, update the `FIELD_MAP` in
> `scripts/sync-ghl.mjs` (or set the matching env vars) — no other code changes
> needed.

## 1. Event (custom object)

- **Object key:** `custom_objects.event` (GHL prefixes custom objects with `custom_objects.`)
- **Primary display field:** Name (the event title)

| Field label | Key | Type | Notes |
| --- | --- | --- | --- |
| Name | `name` | Text | Event title (primary field) |
| Status | `status` | Single option | `upcoming` or `past` |
| Date | `date` | Date | Start date. Leave empty for recurring "series" events |
| Cadence | `cadence` | Text | For recurring events, e.g. "Last Thursday each month" |
| City | `city` | Text | e.g. "Dania Beach" |
| Venue | `venue` | Text | e.g. "Lucky Strike" |
| Type | `type` | Text | e.g. "Networking mixer", "Lunch & Learn" |
| Summary | `summary` | Large text | 1–2 sentence description |
| Flyer | `image_url` | File upload | Upload the flyer image directly in GHL (its URL is stored) |
| Register URL | `register_url` | Text/URL | Eventbrite (or other) registration link |
| Register label | `register_label` | Text | Optional button text (defaults to "Register on Eventbrite") |
| Featured | `featured` | Checkbox | Optional; featured event |
| Priority | `sort_order` | Number | Lower number shows first |

## 2. Sponsor (custom object)

- **Object key:** `custom_objects.sponsor`
- **Primary display field:** Name

| Field label | Key | Type | Notes |
| --- | --- | --- | --- |
| Name | `name` | Text | Sponsor/partner name (primary field) |
| Logo | `logo_url` | File upload | Upload the logo directly in GHL (its URL is stored) |
| Priority | `sort_order` | Number | Lower number shows first on the page |

## 3. Output JSON shape (what the site reads)

`data/events.json`:

```json
{
  "updated": "2026-06-13T00:00:00Z",
  "events": [
    {
      "id": "…",
      "title": "Personal Injury Professionals Bowling Mixer",
      "status": "upcoming",
      "date": "2026-06-25",
      "cadence": "",
      "city": "Dania Beach",
      "venue": "Lucky Strike",
      "type": "Networking mixer",
      "summary": "…",
      "image": "https://…/flyer.jpg",
      "registerUrl": "https://www.eventbrite.com/e/…",
      "registerLabel": "Register on Eventbrite",
      "featured": true
    }
  ]
}
```

`data/sponsors.json`:

```json
{
  "updated": "2026-06-13T00:00:00Z",
  "sponsors": [
    { "id": "…", "name": "The MRI Guys", "logo": "https://…/logo.jpg", "url": "", "tier": "" }
  ]
}
```

## 4. Auth & secrets

The sync needs a **GHL Private Integration token** with the
`objects/record.readonly` (and `objects/schema.readonly`) scopes, plus the
sub-account **Location ID**. Store these as **GitHub Actions secrets** (used only
by the scheduled workflow — never shipped to the browser):

- `GHL_API_TOKEN` 🔒
- `GHL_LOCATION_ID`
- `GHL_EVENTS_OBJECT_KEY` (optional, defaults to `custom_objects.event`)
- `GHL_SPONSORS_OBJECT_KEY` (optional, defaults to `custom_objects.sponsor`)

Until these exist, the committed seed JSON is served as-is (and is the fallback
if a sync ever fails).
