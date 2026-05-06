"""Fetch real photos from Basecamp's avatar CDN and save them under
assets/images/basecamp/<slug>.jpg.

Initials-only badges (where the user hasn't uploaded a photo to Basecamp) are
detected by file size + colour variance and SKIPPED — those people will fall
back to the People-overview PowerPoint portraits via build-people.py.

Source URLs come from the local React site's people.json (which has the
canonical Basecamp avatar URL per person). Re-run this script any time those
URLs are refreshed or the roster grows.

Run:  python3 scripts/fetch-basecamp-photos.py
"""
from __future__ import annotations
import json, sys, urllib.request, urllib.error
from io import BytesIO
from pathlib import Path
from statistics import stdev
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
LOCAL_REACT_PEOPLE = Path("/Users/tbd664/Desktop/claude_projects/CPDSE/src/content/people.json")
OUT_DIR = ROOT / "assets/images/basecamp"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Heuristics for "real photo vs initials-only badge"
MIN_BYTES   = 4500     # Basecamp initials badges are typically < 4 KB
MIN_VAR_RGB = 35.0     # average per-channel std-dev across a downscaled version


def is_likely_photo(img: Image.Image) -> tuple[bool, float]:
    """Return (is_photo, avg_rgb_stddev). Photos have visual variation; initials
    badges are mostly a single colour with thin glyph strokes."""
    small = img.copy()
    if small.mode != "RGB":
        small = small.convert("RGB")
    small = small.resize((32, 32))
    pixels = list(small.getdata())
    rs = [px[0] for px in pixels]
    gs = [px[1] for px in pixels]
    bs = [px[2] for px in pixels]
    avg_var = (stdev(rs) + stdev(gs) + stdev(bs)) / 3
    return avg_var >= MIN_VAR_RGB, avg_var


def fetch(url: str, timeout: int = 12) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "CPDSE-build/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def square_resize(img: Image.Image, target: int = 600) -> Image.Image:
    w, h = img.size
    side = min(w, h)
    img = img.crop(((w - side) // 2, (h - side) // 2,
                    (w - side) // 2 + side, (h - side) // 2 + side))
    if side > target:
        img = img.resize((target, target), Image.LANCZOS)
    return img


def main() -> int:
    print(f"Loading {LOCAL_REACT_PEOPLE}", file=sys.stderr)
    with open(LOCAL_REACT_PEOPLE, encoding="utf-8") as f:
        people = json.load(f)

    written, badge, no_url, errored = [], [], [], []
    for p in people:
        if p.get("placeholder"):
            continue
        slug = p["id"]
        url = p.get("avatar")
        if not url:
            no_url.append(p["name"])
            continue

        try:
            data = fetch(url)
        except urllib.error.HTTPError as e:
            errored.append((p["name"], f"HTTP {e.code}"))
            continue
        except Exception as e:
            errored.append((p["name"], str(e)))
            continue

        size = len(data)
        if size < MIN_BYTES:
            badge.append((p["name"], size, "too small"))
            continue

        try:
            img = Image.open(BytesIO(data))
            is_photo, var = is_likely_photo(img)
        except Exception as e:
            errored.append((p["name"], f"PIL: {e}"))
            continue

        if not is_photo:
            badge.append((p["name"], size, f"low-variance {var:.0f}"))
            continue

        out_file = OUT_DIR / f"{slug}.jpg"
        try:
            if img.mode in ("RGBA", "P", "LA"):
                bg = Image.new("RGB", img.size, (255, 255, 255))
                bg.paste(img, mask=img.split()[-1] if "A" in img.mode else None)
                img = bg
            elif img.mode != "RGB":
                img = img.convert("RGB")
            img = square_resize(img, 600)
            img.save(out_file, "JPEG", quality=86, optimize=True)
            written.append((p["name"], size, var, out_file.stat().st_size))
        except Exception as e:
            errored.append((p["name"], f"save: {e}"))
            continue

    print(f"\n{len(written)} real Basecamp photos saved to {OUT_DIR}/", file=sys.stderr)
    for name, src, var, dst in sorted(written):
        print(f"  ✓ {name:30s} src={src // 1024}KB var={var:.0f}  →  {dst // 1024}KB", file=sys.stderr)

    if badge:
        print(f"\n{len(badge)} initials-only badges (will fall back to PPTX portraits):", file=sys.stderr)
        for n, s, why in badge:
            print(f"  – {n:30s} ({why}, {s} B)", file=sys.stderr)

    if no_url:
        print(f"\n{len(no_url)} people with no Basecamp URL: {no_url}", file=sys.stderr)
    if errored:
        print(f"\n{len(errored)} fetch errors:", file=sys.stderr)
        for e in errored:
            print(f"  ! {e}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
