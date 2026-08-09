#!/usr/bin/env python3
"""
Generate the ChromeBoost extension icons from the same mark the website uses.

The brand mark is an amber square with a hard black brutalist border and a
black lightning bolt — the bolt path is copied verbatim from the site's
`.brand-mark` SVG so the toolbar icon and the landing page can't drift apart.

Everything is rendered at 8x and downsampled with LANCZOS: PIL's polygon fill
has no anti-aliasing, and at 16px a jagged bolt looks broken rather than sharp.

Only needed when the mark changes. Requires Pillow:

    python3 packages/extension/scripts/make-icons.py

Writes icon16/48/128.png into packages/extension/src/icons/, which
`build.mjs` copies to dist/ and on into the plugin payload.
"""
from pathlib import Path

from PIL import Image, ImageDraw

AMBER = (239, 182, 61, 255)   # --naples #efb63d
INK = (20, 17, 13, 255)       # --ink    #14110d

# Bolt polygon in the site's 64x64 viewBox:
#   M36 3 L12 36 h16 L26 61 L52 26 H35 Z
BOLT_64 = [(36, 3), (12, 36), (28, 36), (26, 61), (52, 26), (35, 26)]

SS = 8  # supersample factor
SIZES = (16, 48, 128)
OUT_DIR = Path(__file__).resolve().parent.parent / "src" / "icons"


def border_width(size: int) -> int:
    """Scale the brutalist border with the icon; below ~1px it just muddies."""
    return max(1, round(size * 0.055))


def render(size: int) -> Image.Image:
    n = size * SS
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Rounded-square plate. The radius is small — this is a brutalist mark, not
    # a superellipse app icon — but a hard 90-degree corner reads as a
    # rendering glitch at 16px, so it gets just enough softening to look
    # deliberate.
    radius = max(1, round(n * 0.16))
    d.rounded_rectangle([0, 0, n - 1, n - 1], radius=radius, fill=AMBER)

    bw = border_width(size) * SS
    d.rounded_rectangle([0, 0, n - 1, n - 1], radius=radius, outline=INK, width=bw)

    # Bolt, scaled into the plate with padding so it never touches the border.
    pad = bw + n * 0.13
    span = n - pad * 2
    scale = span / 64.0
    bolt = [(pad + x * scale, pad + y * scale) for (x, y) in BOLT_64]
    d.polygon(bolt, fill=INK)

    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for size in SIZES:
        path = OUT_DIR / f"icon{size}.png"
        render(size).save(path, "PNG", optimize=True)
        print(f"  wrote {path.relative_to(OUT_DIR.parents[3])} ({size}x{size})")


if __name__ == "__main__":
    main()
