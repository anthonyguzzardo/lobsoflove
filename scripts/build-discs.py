"""Renders one CD label per fighter style into assets/discs/<cast>.png (512 px, transparent outside the disc).
Run: python3 scripts/build-discs.py   The fighters are redrawn here from src/components/fighter.tsx."""
import math
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

S = 1024  # drawn at 2x, saved at 512
INK = (11, 15, 26)
EYE = (255, 253, 240)
OUT = Path(__file__).resolve().parent.parent / "assets" / "discs"
CAST = {
    "goblin": ("DROPSHOT GOBLIN", "#2fe08a"), "bot": ("SERVE BOT", "#35d6ff"), "moon": ("MOONBALLER", "#9b6bff"),
    "grunter": ("THE GRUNTER", "#ff5252"), "junk": ("JUNKBALLER", "#ff8a1f"), "comet": ("NET RUSHER", "#ff3d7f"),
    "wall": ("THE WALL", "#d7f205"), "ghost": ("THE NO-SHOW", "#f4f1e6"),
    "lobber": ("GOT YOU, BITCH", "#35d6ff"), "rabbit": ("THE JACKRABBIT", "#ff8a1f"),
}
FACE = {"wall": (100, 92), "moon": (78, 96), "bot": (100, 78), "goblin": (100, 100), "grunter": (100, 86), "junk": (100, 108), "comet": (112, 104), "ghost": (100, 88), "lobber": (100, 64), "rabbit": (100, 120)}


def rgb(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
def mix(a, b, t): return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def radial(size, cx, cy, r, stops):
    """Radial gradient image from (offset, color) stops."""
    img = Image.new("RGB", (size, size))
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = min(1.0, math.hypot(x - cx, y - cy) / r)
            for (o0, c0), (o1, c1) in zip(stops, stops[1:]):
                if t <= o1:
                    px[x, y] = mix(c0, c1, (t - o0) / (o1 - o0) if o1 > o0 else 0)
                    break
    return img


def body_mask(cast, k):
    """The fighter silhouette in a 200-unit box scaled by k."""
    m = Image.new("L", (int(200 * k), int(200 * k)), 0)
    d = ImageDraw.Draw(m)
    P = lambda pts: [(x * k, y * k) for x, y in pts]
    B = lambda x0, y0, x1, y1: [x0 * k, y0 * k, x1 * k, y1 * k]
    if cast == "wall":
        d.rounded_rectangle(B(38, 36, 162, 166), radius=10 * k, fill=255)
    elif cast == "moon":
        d.ellipse(B(22, 22, 178, 178), fill=255)
        d.ellipse(B(72, 40, 192, 160), fill=0)
    elif cast == "bot":
        d.line(P([(100, 14), (100, 38)]), fill=255, width=int(6 * k))
        d.ellipse(B(92, 6, 108, 22), fill=255)
        d.rounded_rectangle(B(46, 38, 154, 120), radius=16 * k, fill=255)
        d.rounded_rectangle(B(62, 126, 138, 172), radius=10 * k, fill=255)
        d.rounded_rectangle(B(30, 66, 42, 94), radius=5 * k, fill=255)
        d.rounded_rectangle(B(158, 66, 170, 94), radius=5 * k, fill=255)
    elif cast == "goblin":
        d.polygon(P([(48, 96), (8, 62), (52, 74)]), fill=255)
        d.polygon(P([(152, 96), (192, 62), (148, 74)]), fill=255)
        d.ellipse(B(42, 44, 158, 168), fill=255)
    elif cast == "grunter":
        d.ellipse(B(28, 28, 172, 172), fill=255)
    elif cast == "junk":
        d.rounded_rectangle(B(40, 46, 160, 62), radius=8 * k, fill=255)
        d.rounded_rectangle(B(86, 32, 114, 48), radius=6 * k, fill=255)
        d.polygon(P([(48, 68), (152, 68), (142, 174), (58, 174)]), fill=255)
    elif cast == "comet":
        d.polygon(P([(18, 34), (96, 70), (60, 84), (26, 60), (74, 110), (22, 96), (70, 140)]), fill=150)
        d.ellipse(B(52, 50, 172, 170), fill=255)
    elif cast == "ghost":
        d.pieslice(B(42, 30, 158, 146), 180, 360, fill=255)
        d.polygon(P([(42, 88), (158, 88), (158, 176), (135, 162), (117, 178), (100, 162), (83, 178), (65, 162), (42, 176)]), fill=255)
    elif cast == "lobber":
        d.ellipse(B(24, 44, 176, 196), fill=255)
        d.rectangle(B(0, 120, 200, 200), fill=0)
        d.rectangle(B(24, 120, 66, 176), fill=255)
        d.rectangle(B(134, 120, 176, 176), fill=255)
        d.ellipse(B(66, 86, 134, 154), fill=0)
        d.rectangle(B(66, 120, 134, 200), fill=0)
    elif cast == "rabbit":
        d.ellipse(B(59, 12, 89, 92), fill=255)
        d.ellipse(B(111, 12, 141, 92), fill=255)
        d.ellipse(B(38, 70, 162, 178), fill=255)
    return m


def fighter(cast, color, px):
    k = px / 200
    mask = body_mask(cast, k)
    c = rgb(color)
    lit = radial(px, px * 0.34, px * 0.26, px * 0.85, [(0, mix(c, (255, 255, 255), 0.45)), (0.45, c), (1, mix(c, INK, 0.42))])
    img = Image.new("RGBA", (px, px), (0, 0, 0, 0))
    img.paste(lit, (0, 0), mask)
    d = ImageDraw.Draw(img)
    B = lambda x0, y0, x1, y1: [x0 * k, y0 * k, x1 * k, y1 * k]
    seam = mix(c, INK, 0.3)
    if cast == "wall":
        for y in (68, 100, 132): d.line([(38 * k, y * k), (162 * k, y * k)], fill=seam, width=int(4 * k))
        for x, a, b in ((80, 36, 68), (124, 36, 68), (60, 132, 166), (104, 132, 166), (146, 132, 166)): d.line([(x * k, a * k), (x * k, b * k)], fill=seam, width=int(4 * k))
    if cast == "junk":
        for x in (78, 100, 122): d.line([(x * k, 132 * k), (x * k, 166 * k)], fill=seam, width=int(4 * k))
    fx, fy = FACE[cast]
    for dx in (-20, 20):
        d.ellipse(B(fx + dx - 9, fy - 12, fx + dx + 9, fy + 12), fill=EYE)
        d.ellipse(B(fx + dx - 2.5, fy - 4.5, fx + dx + 6.5, fy + 8.5), fill=INK)
    if cast == "bot":
        d.rounded_rectangle(B(fx - 20, fy + 22, fx + 20, fy + 29), radius=3 * k, fill=INK)
    elif cast == "grunter":
        d.ellipse(B(fx - 22, fy + 16, fx + 22, fy + 56), fill=INK)
    else:
        d.arc(B(fx - 13, fy + 12, fx + 13, fy + 34), 20, 160, fill=INK, width=int(5 * k))
    if cast == "goblin":
        d.line([((fx - 32) * k, (fy - 20) * k), ((fx - 10) * k, (fy - 12) * k)], fill=INK, width=int(5 * k))
        d.line([((fx + 32) * k, (fy - 20) * k), ((fx + 10) * k, (fy - 12) * k)], fill=INK, width=int(5 * k))
    return img


def label(cast):
    name, color = CAST[cast]
    c = rgb(color)
    R = S / 2
    base = radial(S, R, R, R, [(0, mix(c, (255, 255, 255), 0.25)), (0.5, c), (0.86, mix(c, INK, 0.55)), (1, INK)]).convert("RGBA")
    d = ImageDraw.Draw(base, "RGBA")
    for r in range(150, int(R), 22):  # data-track rings
        d.ellipse([R - r, R - r, R + r, R + r], outline=(255, 255, 255, 26), width=2)
    # Holographic streaks: thin bright wedges, as on the reference disc.
    holo = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    hd = ImageDraw.Draw(holo)
    for ang, col in ((205, (120, 255, 240)), (218, (255, 120, 220)), (28, (255, 240, 140)), (40, (140, 170, 255))):
        hd.pieslice([0, 0, S, S], ang, ang + 9, fill=col + (70,))
    base = Image.alpha_composite(base, holo.filter(ImageFilter.GaussianBlur(14)))
    f = fighter(cast, color, 380)
    shadow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    shadow.paste((0, 0, 0, 110), (int(R - 190) + 10, 58 + 14), f.split()[3])
    base = Image.alpha_composite(base, shadow.filter(ImageFilter.GaussianBlur(12)))
    base.alpha_composite(f, (int(R - 190), 58))
    d = ImageDraw.Draw(base)
    size = 92
    font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Impact.ttf", size)
    while d.textlength(name, font=font) > S * 0.66:
        size -= 4
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Impact.ttf", size)
    w = d.textlength(name, font=font)
    d.text((R - w / 2 + 4, 668 + 4), name, font=font, fill=INK + (160,))
    d.text((R - w / 2, 668), name, font=font, fill=(255, 253, 240))
    small = ImageFont.truetype("/System/Library/Fonts/Supplemental/DIN Condensed Bold.ttf", 44)
    tag = "LOBSOFLOVE  ·  SEASON 1"
    d.text((R - d.textlength(tag, font=small) / 2, 800), tag, font=small, fill=(255, 253, 240, 200))
    # Hub: clear ring, mirror band, spindle hole.
    d.ellipse([R - 150, R - 150, R + 150, R + 150], fill=(226, 230, 238))
    d.ellipse([R - 150, R - 150, R + 150, R + 150], outline=(150, 160, 178), width=5)
    d.ellipse([R - 104, R - 104, R + 104, R + 104], fill=(244, 245, 248), outline=(170, 178, 192), width=4)
    disc = Image.new("L", (S, S), 0)
    dd = ImageDraw.Draw(disc)
    dd.ellipse([2, 2, S - 2, S - 2], fill=255)
    dd.ellipse([R - 60, R - 60, R + 60, R + 60], fill=0)
    base.putalpha(ImageChops.multiply(base.split()[3], disc))
    return base.resize((512, 512), Image.LANCZOS)


OUT.mkdir(parents=True, exist_ok=True)
for cast in CAST:
    img = label(cast)
    img.save(OUT / f"{cast}.png", optimize=True)
    # Opaque copy for the 3D disc, whose geometry supplies the round edge: no alpha needed, so JPEG keeps the web bundle small.
    flat = Image.new("RGB", img.size, (236, 238, 243))
    flat.paste(img, (0, 0), img)
    flat.save(OUT / f"{cast}.jpg", quality=86)
print("wrote", ", ".join(sorted(CAST)))
