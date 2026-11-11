#!/usr/bin/env node
/*
  Adds the events listed by eventbrite-new-events.mjs to the site. Used by
  .github/workflows/eventbrite-check.yml after the free pre-check finds
  something new.

    node scripts/eventbrite-add-events.mjs [new-events.json]

  Everything mechanical happens here, in code: the data/events.json record,
  the flyer download and WebP conversion (Pillow, quality 88), the `updated`
  stamp and the static card in index.html. Claude Haiku is asked for one thing
  per event: the short summary in the site's voice, the event type, and whether
  the flyer contradicts Eventbrite's time or venue (then the end time is left
  out and the conflict goes into PR_NOTES.md for the reviewer).

  Claude is called directly over HTTPS with workload identity federation: the
  GitHub OIDC token in ANTHROPIC_IDENTITY_TOKEN_FILE is exchanged for a
  short-lived Anthropic token. No API key is involved. (claude-code-action is
  not used here because of anthropics/claude-code-action#1888.)

  Required env: ANTHROPIC_FEDERATION_RULE_ID, ANTHROPIC_ORGANIZATION_ID,
  ANTHROPIC_SERVICE_ACCOUNT_ID, ANTHROPIC_IDENTITY_TOKEN_FILE; optional
  ANTHROPIC_WORKSPACE_ID.
*/
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const EVENTS = "data/events.json";
const INDEX = "index.html";
const FLYER_DIR = "assets/events/upcoming";
const NOTES = "PR_NOTES.md";
const MODEL = "claude-haiku-5-5";
const API = "https://api.anthropic.com";

// ---------- formatting (mirrors assets/js/content.js) ----------

export function esc(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

export function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** "18:00:00" or "18:00" -> "18:00"; "" -> "". */
export function hhmm(value) {
  const m = String(value || "").match(/^(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
}

/** ("18:00", "20:30") -> "6:00-8:30 PM"; ("18:00", "") -> "6:00 PM". */
export function timeLabel(start, end) {
  const parts = (t) => {
    const [h, m] = t.split(":").map(Number);
    return { text: `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")}`, ampm: h < 12 ? "AM" : "PM" };
  };
  if (!start) return "";
  const s = parts(start);
  if (!end) return `${s.text} ${s.ampm}`;
  const e = parts(end);
  return s.ampm === e.ampm ? `${s.text}-${e.text} ${e.ampm}` : `${s.text} ${s.ampm}-${e.text} ${e.ampm}`;
}

function monthName(date) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleString("en-US", { month: "long" });
}

/** Static card markup, indented like the existing cards in index.html. */
export function staticCard(ev) {
  const day = String(Number(ev.date.slice(8, 10)));
  const meta = [ev.type, ev.city].filter(Boolean).map(esc).join(" &bull; ");
  const pad = "            ";
  return [
    `${pad}<article class="event-card">`,
    `${pad}  <div class="event-card-image flyer">`,
    ...(ev.image ? [`${pad}    <img src="${esc(ev.image)}" alt="${esc(ev.title)} flyer" />`] : []),
    `${pad}    <div class="event-date"><strong>${day}</strong><span>${monthName(ev.date)}</span></div>` +
      (ev.image ? '<span class="flyer-label">Event flyer</span>' : ""),
    `${pad}  </div>`,
    `${pad}  <div class="event-card-body">`,
    ...(meta ? [`${pad}    <small>${meta}</small>`] : []),
    `${pad}    <h3>${esc(ev.title)}</h3>`,
    ...(ev.summary ? [`${pad}    <p>${esc(ev.summary)}</p>`] : []),
    `${pad}    <div class="event-actions"><a class="button button-primary" href="${esc(ev.registerUrl)}" target="_blank" rel="noreferrer">${esc(ev.registerLabel)}</a></div>`,
    `${pad}  </div>`,
    `${pad}</article>`,
  ].join("\n");
}

// ---------- data/events.json ----------

/** Newest-first, the order the file already uses for dated events. */
export function insertEvent(events, record) {
  const at = events.findIndex((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date || "") && e.date < record.date);
  if (at === -1) events.push(record);
  else events.splice(at, 0, record);
  return events;
}

export function uniqueId(events, title, date) {
  const base = slugify(title);
  const taken = new Set(events.map((e) => e.id));
  if (!taken.has(base)) return base;
  if (!taken.has(`${base}-${date}`)) return `${base}-${date}`;
  let n = 2;
  while (taken.has(`${base}-${date}-${n}`)) n++;
  return `${base}-${date}-${n}`;
}

// ---------- index.html static upcoming grid ----------

/** Appends a card at the end of the static upcoming grid (replacing the empty-state placeholder). */
export function appendStaticCard(html, ev) {
  const open = html.indexOf('<div class="upcoming-events-grid">');
  if (open === -1) throw new Error("index.html: upcoming-events-grid not found");
  const bodyStart = html.indexOf("\n", open) + 1;

  // Walk the grid's direct children up to its closing </div>.
  let depth = 1;
  let i = bodyStart;
  const tag = /<(\/?)div\b[^>]*>/g;
  tag.lastIndex = bodyStart;
  let m;
  while ((m = tag.exec(html))) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) {
      i = m.index;
      break;
    }
  }
  if (depth !== 0) throw new Error("index.html: upcoming-events-grid is not closed");
  const gridEnd = html.lastIndexOf("\n", i) + 1; // start of the line holding the closing </div>
  let inner = html.slice(bodyStart, gridEnd);

  // An empty grid carries a placeholder instead of cards; the first card replaces it.
  inner = inner.replace(/[ \t]*<div class="events-empty"[\s\S]*?<\/div>\s*\n/, "");

  return html.slice(0, bodyStart) + inner + staticCard(ev) + "\n" + html.slice(gridEnd);
}

/**
 * Adds a card to the static upcoming grid, oldest-first ("newest event last").
 * Cards only show day and month, so each existing card is dated through its
 * registerUrl in events.json; the new card goes before the first later one.
 */
export function addStaticCardOrdered(html, ev, events) {
  const byUrl = new Map(events.filter((e) => e.registerUrl).map((e) => [e.registerUrl, e.date || ""]));
  const open = html.indexOf('<div class="upcoming-events-grid">');
  if (open === -1) throw new Error("index.html: upcoming-events-grid not found");
  const re = /[ \t]*<article class="event-card">[\s\S]*?<\/article>\n/g;
  re.lastIndex = open;
  let m;
  while ((m = re.exec(html))) {
    const href = (m[0].match(/href="([^"]+)"/) || [])[1] || "";
    const url = href.replace(/&amp;/g, "&");
    const date = byUrl.get(url) || "";
    if (date && date > ev.date) {
      return html.slice(0, m.index) + staticCard(ev) + "\n" + html.slice(m.index);
    }
    // Stop at the end of the upcoming grid (past cards use a different class).
    const next = html.indexOf('<article class="event-card">', re.lastIndex);
    const gridClose = html.indexOf("</div>\n", re.lastIndex);
    if (next === -1 || next > gridClose) break;
  }
  return appendStaticCard(html, ev);
}

// ---------- flyer ----------

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`flyer download failed: HTTP ${res.status}`);
  const type = (res.headers.get("content-type") || "").split(";")[0].trim();
  return { bytes: Buffer.from(await res.arrayBuffer()), type };
}

function toWebp(bytes, outPath) {
  const dir = join(tmpdir(), `flyer-${process.pid}-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  const src = join(dir, "flyer.bin");
  writeFileSync(src, bytes);
  execFileSync(
    "python3",
    ["-I", "-c", "import sys\nfrom PIL import Image\nImage.open(sys.argv[1]).convert('RGB').save(sys.argv[2], 'WEBP', quality=88)", src, outPath],
    { stdio: "inherit" },
  );
  rmSync(dir, { recursive: true, force: true });
}

// ---------- Claude (workload identity federation, direct API) ----------

let accessToken = null;

async function anthropicToken() {
  if (accessToken) return accessToken;
  const need = ["ANTHROPIC_FEDERATION_RULE_ID", "ANTHROPIC_ORGANIZATION_ID", "ANTHROPIC_SERVICE_ACCOUNT_ID", "ANTHROPIC_IDENTITY_TOKEN_FILE"];
  const missing = need.filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`Missing ${missing.join(", ")} (workload identity federation)`);
  const body = {
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: readFileSync(process.env.ANTHROPIC_IDENTITY_TOKEN_FILE, "utf8").trim(),
    federation_rule_id: process.env.ANTHROPIC_FEDERATION_RULE_ID,
    organization_id: process.env.ANTHROPIC_ORGANIZATION_ID,
    service_account_id: process.env.ANTHROPIC_SERVICE_ACCOUNT_ID,
  };
  if (process.env.ANTHROPIC_WORKSPACE_ID) body.workspace_id = process.env.ANTHROPIC_WORKSPACE_ID;
  const res = await fetch(`${API}/v1/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Anthropic token exchange failed: HTTP ${res.status} ${text.slice(0, 300)}`);
  accessToken = JSON.parse(text).access_token;
  return accessToken;
}

const DESCRIBE_TOOL = {
  name: "describe_event",
  description: "Return the website copy for one MMG event.",
  input_schema: {
    type: "object",
    properties: {
      summary: { type: "string", description: "One or two sentences in the site's voice." },
      type: { type: "string", description: "Event type; reuse one of the existing types when it fits." },
      flyer_conflict: {
        type: "string",
        description: "Empty string, or a short note if the flyer states a time or venue that differs from Eventbrite.",
      },
    },
    required: ["summary", "type", "flyer_conflict"],
  },
};

export function describePrompt(ev, examples, types) {
  return [
    "You write the event listings for Miller's Marketing Group (MMG), which hosts networking events",
    "for personal injury attorneys, medical professionals and industry leaders in South Florida.",
    "",
    "Write the `summary` for the new event below in the same voice as these existing summaries:",
    ...examples.map((s) => `- ${s}`),
    "",
    "Rules:",
    `- One or two sentences. Include the venue ("${ev.venue}") and the time exactly as "${ev.timeLabel}".`,
    "- Eventbrite's own summary is only a hint and is often just \"Join us\".",
    "- Do not invent details such as food, prizes or sponsors that you cannot see in the title,",
    "  Eventbrite's summary or the flyer.",
    `- For \`type\`, use one of ${JSON.stringify(types)} if it fits; otherwise a short new type.`,
    "- If a flyer image is attached and it states a time or venue that differs from the Eventbrite",
    "  details below, describe the difference in `flyer_conflict`; otherwise leave it empty.",
    "",
    "New event (from Eventbrite):",
    JSON.stringify(
      {
        title: ev.title,
        date: ev.date,
        time: ev.timeLabel,
        venue: ev.venue,
        address: [ev.streetAddress, ev.city, ev.state, ev.postalCode].filter(Boolean).join(", "),
        eventbriteSummary: ev.ebSummary,
      },
      null,
      2,
    ),
  ].join("\n");
}

async function describeWithClaude(ev, examples, types, flyer) {
  const content = [];
  const imageTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (flyer && imageTypes.includes(flyer.type) && flyer.bytes.length < 4.5 * 1024 * 1024) {
    content.push({ type: "image", source: { type: "base64", media_type: flyer.type, data: flyer.bytes.toString("base64") } });
  }
  content.push({ type: "text", text: describePrompt(ev, examples, types) });
  const res = await fetch(`${API}/v1/messages`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${await anthropicToken()}`,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      tools: [DESCRIBE_TOOL],
      tool_choice: { type: "tool", name: DESCRIBE_TOOL.name },
      messages: [{ role: "user", content }],
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Claude request failed: HTTP ${res.status} ${text.slice(0, 500)}`);
  const msg = JSON.parse(text);
  const out = msg.content.find((b) => b.type === "tool_use")?.input;
  if (!out || typeof out.summary !== "string" || !out.summary.trim()) throw new Error("Claude returned no summary");
  return {
    summary: out.summary.trim(),
    type: String(out.type || "").trim(),
    flyerConflict: String(out.flyer_conflict || "").trim(),
  };
}

// ---------- main ----------

export async function addEvents(newEvents, { describe = describeWithClaude, fetchFlyer = download, convert = toWebp, now = new Date() } = {}) {
  const data = JSON.parse(readFileSync(EVENTS, "utf8"));
  let html = readFileSync(INDEX, "utf8");
  const notes = [];
  const examples = data.events.filter((e) => e.summary && e.date).slice(0, 4).map((e) => e.summary);
  const types = [...new Set(data.events.map((e) => e.type).filter(Boolean))];

  for (const ne of newEvents) {
    const startTime = hhmm(ne.startTime);
    let endTime = hhmm(ne.endTime);
    const id = uniqueId(data.events, ne.title, ne.date);

    let flyer = null;
    let image = "";
    if (ne.flyerUrl) {
      flyer = await fetchFlyer(ne.flyerUrl); // signed URL: used exactly as given
      mkdirSync(FLYER_DIR, { recursive: true });
      image = `${FLYER_DIR}/${id}-flyer.webp`;
      convert(flyer.bytes, image);
    }

    const ev = { ...ne, timeLabel: timeLabel(startTime, endTime) };
    const copy = await describe(ev, examples, types, flyer);
    if (copy.flyerConflict) {
      endTime = ""; // the flyer and Eventbrite disagree: keep Eventbrite's venue, drop the end time
      notes.push(`- **${ne.title}**: the flyer differs from Eventbrite. ${copy.flyerConflict} The end time was left out; Eventbrite's venue was kept.`);
    }
    if (!copy.summary.includes(ne.venue)) {
      notes.push(`- **${ne.title}**: the summary does not name the venue (${ne.venue}). Please check it.`);
    }

    const record = {
      id,
      title: ne.title,
      status: "upcoming",
      date: ne.date,
      startTime,
      ...(endTime ? { endTime } : {}),
      cadence: "",
      city: ne.city,
      venue: ne.venue,
      streetAddress: ne.streetAddress,
      state: ne.state,
      postalCode: ne.postalCode,
      type: copy.type || "Networking mixer",
      summary: copy.summary,
      image,
      registerUrl: ne.url,
      registerLabel: "Register on Eventbrite",
      featured: false,
    };
    // Place the static card relative to the events already in the file, then add the record.
    html = addStaticCardOrdered(html, record, data.events);
    insertEvent(data.events, record);
    console.log(`Added ${id} (${record.date}, ${record.venue})`);
  }

  data.updated = now.toISOString().replace(/\.\d{3}Z$/, "Z");
  writeFileSync(EVENTS, JSON.stringify(data, null, 2) + "\n");
  writeFileSync(INDEX, html);
  if (notes.length) writeFileSync(NOTES, ["**Notes from the event check**", "", ...notes, ""].join("\n"));
  return { notes };
}

/**
 * Checks the Claude sign-in and request end to end without changing anything:
 * asks for the copy of the next upcoming event already on the site.
 */
async function probe() {
  const data = JSON.parse(readFileSync(EVENTS, "utf8"));
  const sample = data.events.find((e) => e.status === "upcoming" && e.date) || data.events.find((e) => e.date);
  const examples = data.events.filter((e) => e.summary && e.date && e !== sample).slice(0, 4).map((e) => e.summary);
  const types = [...new Set(data.events.map((e) => e.type).filter(Boolean))];
  const copy = await describeWithClaude(
    { ...sample, ebSummary: "", timeLabel: timeLabel(sample.startTime || "", sample.endTime || "") },
    examples,
    types,
    null,
  );
  console.log(`Claude sign-in and request OK (${MODEL}). Sample copy for "${sample.title}":`);
  console.log(JSON.stringify(copy, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv[2] === "--probe") {
    await probe();
    process.exit(0);
  }
  const input = process.argv[2] || "new-events.json";
  if (!existsSync(input)) {
    console.error(`${input} not found; run scripts/eventbrite-new-events.mjs first.`);
    process.exit(1);
  }
  await addEvents(JSON.parse(readFileSync(input, "utf8")));
}
