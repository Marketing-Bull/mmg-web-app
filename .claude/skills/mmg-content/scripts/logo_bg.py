#!/usr/bin/env python3
"""Derive each sponsor logo's own backdrop colour, for the tile behind it.

    python3 logo_bg.py assets/partners/*          # inspect
    python3 logo_bg.py --write data/sponsors.json # set every sponsor's "bg"

A logo either sits on transparency or has a flat backdrop baked into the
file. Painting the card that same colour makes the image blend into the tile
instead of sitting on it as a visible rectangle. Guessing this by eye is
unreliable -- a white logo panel against the cream card differs by ~2/255 per
channel and is easy to miss -- so it is measured from the pixels.

Detection: crop to visible content, then treat the artwork as having a baked
backdrop when that content is >=90% opaque AND one flat colour fills >=25% of
the frame. Corner sampling alone is not enough; several of these logos are a
white rectangle sitting inside a transparent margin, so their corners read as
transparent while the visible art is on white.

Near-white snaps to #ffffff so tiles do not land on almost-white values.

Requires Pillow (pip install pillow).
"""
import json
import sys
from collections import Counter

from PIL import Image

OPAQUE_MIN = 0.90   # share of the content box that must be opaque
FILL_MIN = 0.25     # share the modal colour must cover to count as a backdrop
SAME = 26           # per-channel distance treated as "the same colour"


def backdrop(path):
    """Return (size, (r, g, b)) or (size, None) when the logo is transparent."""
    im = Image.open(path).convert("RGBA")
    box = im.split()[3].getbbox()          # visible content only
    if box:
        im = im.crop(box)
    px = im.load()
    w, h = im.size
    frame = w * h
    opaque = [px[x, y][:3] for x in range(w) for y in range(h) if px[x, y][3] > 200]
    if not opaque or len(opaque) / frame < OPAQUE_MIN:
        return im.size, None
    common, _ = Counter(opaque).most_common(1)[0]
    fill = sum(
        1 for c in opaque if max(abs(c[i] - common[i]) for i in range(3)) < SAME
    ) / frame
    return im.size, (common if fill >= FILL_MIN else None)


def to_hex(rgb):
    r, g, b = rgb
    return "#ffffff" if min(r, g, b) > 246 else "#%02x%02x%02x" % (r, g, b)


def bg_for(logo):
    """The `bg` value for a sponsor's logo path ("" means use the card default)."""
    if not logo or logo.startswith("http"):
        return ""
    _, baked = backdrop(logo)
    return to_hex(baked) if baked else ""


def main(argv):
    if argv and argv[0] == "--write":
        path = argv[1] if len(argv) > 1 else "data/sponsors.json"
        data = json.load(open(path))
        for s in data["sponsors"]:
            s["bg"] = bg_for((s.get("logo") or "").strip())
            print(f"{s['name'][:40]:42s} {s['bg'] or '(card default)'}")
        # Keep the file's one-line-per-sponsor style so diffs stay readable.
        keys = ["id", "name", "logo", "bg", "url", "tier"]
        rows = [
            "    { " + ", ".join(f"{json.dumps(k)}: {json.dumps(s.get(k, ''))}" for k in keys) + " }"
            for s in data["sponsors"]
        ]
        out = (
            "{\n"
            f'  "updated": {json.dumps(data["updated"])},\n'
            '  "sponsors": [\n' + ",\n".join(rows) + "\n  ]\n}\n"
        )
        open(path, "w").write(out)
        print(f"\nwrote {path}")
        return 0

    if not argv:
        print(__doc__)
        return 1
    for f in argv:
        size, baked = backdrop(f)
        label = to_hex(baked) if baked else "transparent -> default card"
        print(f"{f:52s} {str(size):12s} {label}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
