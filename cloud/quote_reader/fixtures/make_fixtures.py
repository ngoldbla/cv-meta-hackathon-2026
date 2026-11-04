"""Synthetic, invented dealer documents for the quote-reader test set (task 047).

All data is made up: fake dealers, valid-format VINs with correct check digits.
Writes <out>/<name>.png (flat render) and <name>.truth.json; then
<name>.photo.jpg (rotated, blurred, glare, noise) to mimic a phone shot.
    python make_fixtures.py ~/.cache/low-key/quote-fixtures
"""

import json
import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

W = {**{c: i for i, c in enumerate("0123456789")}}
TRANS = dict(
    zip("ABCDEFGHJKLMNPRSTUVWXYZ", [1, 2, 3, 4, 5, 6, 7, 8, 1, 2, 3, 4, 5, 7, 9, 2, 3, 4, 5, 6, 7, 8, 9])
)
WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2]
ALPHA = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789"


def vin(rng, wmi, vds):
    body = list(
        wmi
        + vds
        + "0"
        + rng.choice("PRSTVW")
        + rng.choice("ABCDEFG")
        + "".join(rng.choice("0123456789") for _ in range(6))
    )
    tot = sum((int(c) if c.isdigit() else TRANS[c]) * w for c, w in zip(body, WEIGHTS))
    body[8] = "X" if tot % 11 == 10 else str(tot % 11)
    return "".join(body)


def font(size, bold=False):
    for p in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans%s.ttf" % ("-Bold" if bold else ""),
        "/usr/share/fonts/truetype/liberation/LiberationSans-%s.ttf" % ("Bold" if bold else "Regular"),
    ):
        if Path(p).exists():
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def money(x):
    return f"${x:,.2f}"


def sheet(lines, title, name, out, truth, rng):
    img = Image.new("RGB", (1100, 1500), (252, 251, 247))
    d = ImageDraw.Draw(img)
    d.rectangle([20, 20, 1080, 1480], outline=(30, 30, 30), width=4)
    d.text((50, 50), title, font=font(38, True), fill=(10, 10, 10))
    y = 130
    for left, right, bold in lines:
        d.text((60, y), left, font=font(26, bold), fill=(20, 20, 20))
        if right:
            d.text((760, y), right, font=font(26, bold), fill=(20, 20, 20))
        y += 46
    img.save(out / f"{name}.png")
    (out / f"{name}.truth.json").write_text(json.dumps(truth, indent=2))
    # phone-photo degradation: tilt, perspective-ish crop, blur, glare, noise
    p = img.rotate(rng.uniform(-4, 4), expand=True, fillcolor=(60, 60, 60)).filter(
        ImageFilter.GaussianBlur(rng.uniform(0.6, 1.4))
    )
    glare = Image.new("L", p.size, 0)
    g = ImageDraw.Draw(glare)
    cx, cy = rng.randint(200, p.size[0] - 200), rng.randint(200, p.size[1] - 200)
    g.ellipse([cx - 220, cy - 140, cx + 220, cy + 140], fill=120)
    p = Image.composite(
        Image.new("RGB", p.size, (255, 255, 255)), p, glare.filter(ImageFilter.GaussianBlur(60))
    )
    p = ImageEnhance.Brightness(p).enhance(rng.uniform(0.85, 1.05))
    p.convert("RGB").save(out / f"{name}.photo.jpg", quality=72)


def main(out):
    out = Path(out).expanduser()
    out.mkdir(parents=True, exist_ok=True)
    rng = random.Random(7)
    cars = [
        ("1HG", "CV2F", 2026, "Brightwater", "Zenith", "Sport", 28450),
        ("2T1", "BU4E", 2025, "Kestrel", "Aero", "LX", 24990),
        ("5YJ", "XC3G", 2026, "Ridgeline Motors", "Tundra-X", "Limited", 51300),
    ]
    n = 0
    for wmi, vds, yr, make, model, trim, price in cars:
        v = vin(rng, wmi, vds)
        fees = [
            ("Documentary fee", rng.choice([299, 599, 799]), "dealer"),
            ("Title and registration", rng.choice([185, 240]), "government"),
            ("Nitrogen tire fill", 199, "addon"),
            ("Paint and fabric protection", 995, "addon"),
        ]
        apr, term, down = rng.choice([5.9, 6.49, 7.25]), rng.choice([60, 72]), rng.choice([2000, 3000, 5000])
        otd = price + sum(f[1] for f in fees)
        name = f"buyers_order_{n}"
        lines = [
            ("INVENTED DEALERSHIP: Lakeside Auto Group", None, True),
            (f"VIN {v}", None, False),
            (f"{yr} {make} {model} {trim}", None, True),
            ("Selling price", money(price), False),
        ]
        lines += [(f[0], money(f[1]), False) for f in fees]
        lines += [
            ("Down payment", money(down), False),
            (f"APR {apr}%   Term {term} months", None, False),
            ("Out the door", money(otd), True),
        ]
        truth = {
            "doc_type": "buyers_order",
            "vin": v,
            "year": yr,
            "make": make,
            "model": model,
            "trim": trim,
            "selling_price": price,
            "down": down,
            "out_the_door": otd,
            "apr": apr,
            "term_months": term,
            "fees": [{"label": a, "amount": b, "kind": c} for a, b, c in fees],
        }
        sheet(lines, "BUYER'S ORDER (SAMPLE)", name, out, truth, rng)
        n += 1
    for wmi, vds, yr, make, model, trim, price in cars[:2]:
        v = vin(rng, wmi, vds)
        mpg = rng.choice([28, 31, 36])
        name = f"window_sticker_{n}"
        lines = [
            (f"{yr} {make} {model} {trim}", None, True),
            (f"VIN {v}", None, False),
            ("Base price", money(price - 1800), False),
            ("Options", money(1200), False),
            ("Destination charge", money(600), False),
            ("Total MSRP", money(price), True),
            (f"EPA combined {mpg} MPG", None, False),
        ]
        truth = {
            "doc_type": "window_sticker",
            "vin": v,
            "year": yr,
            "make": make,
            "model": model,
            "trim": trim,
            "msrp": price,
            "epa_combined_mpg": mpg,
        }
        sheet(lines, "MONRONEY LABEL (SAMPLE)", name, out, truth, rng)
        n += 1
    print(f"wrote {n} fixtures to {out}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "~/.cache/low-key/quote-fixtures")
