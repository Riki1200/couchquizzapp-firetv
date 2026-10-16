#!/usr/bin/env python3
"""Draws the Couch Quiz app icon and TV banners (original artwork, no external assets).

    python3 apps/vega/scripts/make-icons.py      # needs Pillow
"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.join(os.path.dirname(__file__), '..', '..', '..')
FONT = '/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf'
NAVY, PURPLE, YELLOW, WHITE = (11, 16, 38), (108, 92, 231), (255, 210, 63), (255, 255, 255)
TEAL, ORANGE, PINK, INDIGO = (20, 184, 166), (249, 115, 22), (236, 72, 153), (99, 102, 241)


def gradient(size, top, bottom):
    w, h = size
    img = Image.new('RGB', size, top)
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(1, h - 1)
        d.line([(0, y), (w, y)], fill=tuple(int(a + (b - a) * t) for a, b in zip(top, bottom)))
    return img


def draw_mark(d, cx, cy, s):
    """Couch with a quiz bubble above it, centered on (cx, cy); s = scale (1.0 ≈ 512px icon)."""
    def box(x0, y0, x1, y1, r, fill):
        d.rounded_rectangle([cx + x0 * s, cy + y0 * s, cx + x1 * s, cy + y1 * s], radius=r * s, fill=fill)

    # Speech bubble with a question mark.
    box(-70, -175, 70, -60, 34, WHITE)
    d.polygon([(cx - 18 * s, cy - 64 * s), (cx + 14 * s, cy - 64 * s), (cx - 14 * s, cy - 34 * s)], fill=WHITE)
    font = ImageFont.truetype(FONT, int(96 * s))
    d.text((cx, cy - 118 * s), '?', font=font, fill=PURPLE, anchor='mm')

    # Couch: backrest, seat cushions in the four answer colors, armrests and legs.
    box(-150, -20, 150, 60, 30, YELLOW)                      # backrest
    box(-140, 40, 140, 96, 10, (224, 170, 30))               # seat behind the cushions
    for i, color in enumerate((TEAL, ORANGE, PINK, INDIGO)):  # cushions
        x0 = -128 + i * 64
        box(x0, 30, x0 + 58, 92, 14, color)
    box(-190, 10, -128, 120, 28, YELLOW)                     # left armrest
    box(128, 10, 190, 120, 28, YELLOW)                       # right armrest
    box(-150, 84, 150, 120, 16, YELLOW)                      # base
    box(-160, 118, -132, 150, 8, WHITE)                      # legs
    box(132, 118, 160, 150, 8, WHITE)


def app_icon(size):
    img = gradient((size, size), PURPLE, NAVY)
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.22), fill=255)
    rounded = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    rounded.paste(img, (0, 0), mask)
    draw_mark(ImageDraw.Draw(rounded), size / 2, size / 2 + size * 0.03, size / 512)
    return rounded


def banner(w, h):
    img = gradient((w, h), PURPLE, NAVY)
    d = ImageDraw.Draw(img)
    s = h / 720
    draw_mark(d, w / 2 - 270 * s, h / 2 + 10 * s, s * 1.15)
    font = ImageFont.truetype(FONT, int(130 * s))
    d.text((w / 2 + 10 * s, h / 2 - 70 * s), 'Couch', font=font, fill=WHITE, anchor='lm')
    d.text((w / 2 + 10 * s, h / 2 + 75 * s), 'Quiz', font=font, fill=YELLOW, anchor='lm')
    return img


def main():
    vega_assets = os.path.join(ROOT, 'apps', 'vega', 'assets', 'image')
    os.makedirs(vega_assets, exist_ok=True)
    app_icon(512).save(os.path.join(vega_assets, 'icon.png'))
    banner(1280, 720).save(os.path.join(ROOT, 'docs', 'store-icon-1280x720.png'))
    tv_icons = os.path.join(ROOT, 'apps', 'expo-multi-tv', 'assets', 'tv_icons')
    for w, h in [(400, 240), (800, 480), (1280, 768), (1920, 720)]:
        banner(w, h).save(os.path.join(tv_icons, f'icon-{w}x{h}.png'))
    print('icons written')


if __name__ == '__main__':
    main()
