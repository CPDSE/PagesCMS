"""Extract embedded portrait photos from the "Peope overview.pptx" deck and save
them under assets/images/portraits/<slug>.jpg, ready to be referenced from
people.json via the avatarLocal field.

Slides 2-30 each show one person. Each slide references one image from
ppt/media/. The slide's text runs include the person's name. We match the slide
text against a known list of canonical names (PPTX_PEOPLE) and write the file
under that person's slug.

Run:  python3 scripts/extract-pptx-photos.py
"""
from __future__ import annotations
import re, sys, zipfile
from io import BytesIO
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ONEDRIVE = Path("/Users/tbd664/Library/CloudStorage/OneDrive-UniversityofCopenhagen/UCPH_CPDSE - Dokumenter")
PPTX = ONEDRIVE / "General/Peope overview.pptx"
OUT_DIR = ROOT / "assets/images/portraits"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Canonical names (must match the keys in build-people.py's PPTX dict and
# the names in people.json so the slug-matching works)
PPTX_PEOPLE = [
    "Lotte Stig Nørgaard",
    "Morten Lindow",
    "Nadia Andersen",
    "Marin Matic",
    "Anton Pottegård",
    "Trine M. Lund",
    "Emma Bjørk",
    "Jacob Fredegaard Hansen",
    "Karlis Berzins",
    "Alexander S. Hauser",
    "Arnault-Quentin Vermillet",
    "Kasper Harpsøe",
    "Lykke Pedersen",
    "Noémie Roland",
    "Jane Knöchel",
    "Philipp Hans",
    "Stine Marie Jensen",
    "Jonas Verhellen",
    "Jeppe Hartmann",
    "Sarah Mittenentzwei",
    "Sebastian Jakobsen",
    "Icaro Ariel Simon",
    "Jacob Kongsted",
    "Christian Schönbeck",
    "Adrienne Traxler",
    "Frederik V. Christiansen",
    "Lucy Rebecca Davies",
    "Anders Ø. Madsen",
    "Finn Kollerup",
]

def slugify(s: str) -> str:
    s = s.lower()
    for src, dst in (("ø","o"),("æ","ae"),("å","a"),("ö","o"),("ü","u"),("é","e"),("è","e"),("ç","c")):
        s = s.replace(src, dst)
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")

def first_last(name: str) -> tuple[str, str]:
    parts = re.sub(r"\(.*?\)", "", name).strip().split()
    return parts[0], parts[-1]

def name_matches(slide_text: str, name: str) -> bool:
    """True when both the first and last token of `name` appear in slide_text."""
    first, last = first_last(name)
    # Use simple substring match on case-folded text. Slides may split the name
    # into multiple text runs separated by ' | ' so substring is more reliable
    # than tokenisation.
    text = slide_text.casefold()
    return first.casefold() in text and last.casefold() in text


def main() -> int:
    print(f"Opening {PPTX}", file=sys.stderr)
    z = zipfile.ZipFile(PPTX)
    slides = sorted(
        [n for n in z.namelist() if re.fullmatch(r"ppt/slides/slide\d+\.xml", n)],
        key=lambda x: int(re.search(r"slide(\d+)", x).group(1)),
    )

    written = []
    skipped = []
    name_to_slide = {}

    for slide_path in slides:
        slide_num = int(re.search(r"slide(\d+)", slide_path).group(1))
        if slide_num == 1:
            continue  # title slide

        slide_xml = z.read(slide_path).decode("utf-8", errors="ignore")
        runs = re.findall(r"<a:t[^>]*>([^<]+)</a:t>", slide_xml)
        flat_text = " | ".join(runs)

        # Find which canonical person matches this slide
        matched = next((n for n in PPTX_PEOPLE if name_matches(flat_text, n)), None)
        if not matched:
            skipped.append(("no name match", slide_num, flat_text[:80]))
            continue

        # Find the slide's image relationship (skip layout/notes)
        rels_path = slide_path.replace("slides/", "slides/_rels/").replace(".xml", ".xml.rels")
        if rels_path not in z.namelist():
            skipped.append(("no rels", slide_num, matched))
            continue

        rels_xml = z.read(rels_path).decode("utf-8", errors="ignore")
        # Find the first image-type relationship
        m = re.search(
            r'<Relationship[^>]+Type="[^"]*relationships/image"[^>]+Target="([^"]+)"',
            rels_xml,
        )
        if not m:
            skipped.append(("no image", slide_num, matched))
            continue
        img_target = m.group(1)
        # Resolve relative path: e.g. ../media/image18.tiff -> ppt/media/image18.tiff
        img_path = "ppt/" + img_target.replace("../", "")
        if img_path not in z.namelist():
            skipped.append(("image not found in zip", slide_num, matched, img_path))
            continue

        # Read and convert image
        img_bytes = z.read(img_path)
        slug = slugify(matched)
        out_file = OUT_DIR / f"{slug}.jpg"

        try:
            img = Image.open(BytesIO(img_bytes))
            # Convert mode if needed (TIFF can be CMYK / palette)
            if img.mode in ("RGBA", "P", "LA"):
                bg = Image.new("RGB", img.size, (255, 255, 255))
                bg.paste(img, mask=img.split()[-1] if "A" in img.mode else None)
                img = bg
            elif img.mode != "RGB":
                img = img.convert("RGB")
            # Square-crop to centre, resize for web
            w, h = img.size
            side = min(w, h)
            left = (w - side) // 2
            top = (h - side) // 2
            img = img.crop((left, top, left + side, top + side))
            if side > 600:
                img = img.resize((600, 600), Image.LANCZOS)
            img.save(out_file, "JPEG", quality=86, optimize=True)
            written.append((matched, str(out_file.name), out_file.stat().st_size))
            name_to_slide[matched] = slide_num
        except Exception as e:
            skipped.append(("image conversion failed", slide_num, matched, str(e)))

    # Summary
    print(f"\n{len(written)} portraits written:", file=sys.stderr)
    for name, fname, size in sorted(written):
        print(f"  ✓ {name:30s} -> {fname} ({size // 1024} KB)", file=sys.stderr)
    if skipped:
        print(f"\n{len(skipped)} skipped:", file=sys.stderr)
        for s in skipped:
            print(f"  – {s}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
