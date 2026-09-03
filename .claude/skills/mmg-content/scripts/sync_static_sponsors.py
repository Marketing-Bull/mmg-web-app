#!/usr/bin/env python3
"""Rewrite the static sponsor grid in index.html from data/sponsors.json.

    python3 sync_static_sponsors.py            # rewrite
    python3 sync_static_sponsors.py --check    # exit 1 if out of date

index.html carries a hand-written copy of the sponsor grid that shows before
content.js swaps in the live feed, and that is all a visitor without
JavaScript ever sees. It must stay in step with the data, and the markup must
match what sponsorCard() in assets/js/content.js emits -- otherwise the page
visibly changes as the script lands.

Requires no third-party packages.
"""
import html
import json
import re
import sys

GRID = re.compile(
    r'(<div class="partners-grid" aria-label="[^"]*">\n)(.*?)(\n {10}</div>)', re.S
)
INDENT = " " * 12


def is_dark(hex_value):
    """Mirror of isDarkColor() in content.js -- keep the threshold in step."""
    v = hex_value.lstrip("#")
    if len(v) == 3:
        v = "".join(c * 2 for c in v)
    n = int(v, 16)
    r, g, b = (n >> 16) & 255, (n >> 8) & 255, n & 255
    return 0.2126 * r + 0.7152 * g + 0.0722 * b < 140


def build(sponsors):
    """Emit exactly what sponsorCard() produces, down to the link wrapper and
    the space-free custom property, so the grid does not change as the script
    lands and a visitor without JavaScript still gets clickable sponsors."""
    esc = lambda s: html.escape(str(s or ""), quote=True)
    rows = []
    for s in sponsors:
        bg = (s.get("bg") or "").strip()
        cls = "partner-card partner-card-dark" if bg and is_dark(bg) else "partner-card"
        style = f' style="--partner-bg:{bg}"' if bg else ""
        url = (s.get("url") or "").strip()
        rows.append(f'{INDENT}<figure class="{cls}"{style}>')
        inner = INDENT + "  "
        if url:
            rows.append(
                f'{inner}<a href="{esc(url)}" target="_blank" rel="noreferrer" style="display:contents">'
            )
            inner += "  "
        if s.get("logo"):
            rows.append(
                f'{inner}<img src="{esc(s["logo"])}" alt="{esc(s["name"])}" loading="lazy" />'
            )
        rows.append(f'{inner}<figcaption>{esc(s["name"])}</figcaption>')
        if url:
            rows.append(f"{INDENT}  </a>")
        rows.append(f"{INDENT}</figure>")
    return "\n".join(rows)


def main(argv):
    check = "--check" in argv
    sponsors = json.load(open("data/sponsors.json"))["sponsors"]
    src = open("index.html").read()
    m = GRID.search(src)
    if not m:
        print("could not find the partners grid in index.html", file=sys.stderr)
        return 2
    block = build(sponsors)
    if m.group(2) == block:
        print(f"index.html already in step with {len(sponsors)} sponsors")
        return 0
    if check:
        print("index.html sponsor grid is OUT OF DATE -- run without --check", file=sys.stderr)
        return 1
    open("index.html", "w").write(src[: m.start(2)] + block + src[m.end(2) :])
    print(f"rewrote {len(sponsors)} sponsor cards in index.html")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
