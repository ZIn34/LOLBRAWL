"""Draws the LOLbrawl app icon: the word lol as the game draws it (an o head, two straight l arms)
in amber on the game's dark ground. Writes the PNG sizes phones and browsers ask for, plus an SVG favicon."""
from PIL import Image, ImageDraw, ImageFilter
import os

GROUND = (17, 15, 28, 255)       # --ground #110f1c
AMBER = (255, 181, 71, 255)      # --p1 #ffb547
DOT = (139, 132, 168, 22)        # the arena floor dots, kept faint
S = 1024                         # master size, scaled down for each output

def master():
    img = Image.new('RGBA', (S, S), GROUND)
    d = ImageDraw.Draw(img)
    for y in range(40, S, 64):             # dotted floor, like the arena
        for x in range(40, S, 64):
            d.ellipse((x - 4, y - 4, x + 4, y + 4), fill=DOT)
    # the lol, kept inside the centre ~70% so round/squircle masks never cut it
    art = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    a = ImageDraw.Draw(art)
    cx, cy = S // 2, S // 2 + 30
    ro, stroke = 150, 72
    a.ellipse((cx - ro, cy - ro, cx + ro, cy + ro), outline=AMBER, width=stroke)
    bw, top, bot = 74, cy - 250, cy + ro
    for x in (cx - 290, cx + 290):
        a.rounded_rectangle((x - bw // 2, top, x + bw // 2, bot), radius=bw // 2, fill=AMBER)
    glow = art.filter(ImageFilter.GaussianBlur(38))
    glow.putalpha(glow.getchannel('A').point(lambda v: int(v * 0.75)))
    img.alpha_composite(glow)
    img.alpha_composite(art)
    return img

m = master()
os.makedirs('icons', exist_ok=True)
for name, size in [('icon-512.png', 512), ('icon-192.png', 192), ('apple-touch-icon.png', 180), ('favicon-32.png', 32)]:
    m.resize((size, size), Image.LANCZOS).convert('RGB').save(os.path.join('icons', name), optimize=True)

# a crisp vector favicon for browser tabs
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" rx="12" fill="#110f1c"/>
<circle cx="32" cy="34" r="7.3" fill="none" stroke="#ffb547" stroke-width="4.5"/>
<rect x="11.5" y="15" width="5" height="26.5" rx="2.5" fill="#ffb547"/>
<rect x="47.5" y="15" width="5" height="26.5" rx="2.5" fill="#ffb547"/>
</svg>
'''
open(os.path.join('icons', 'favicon.svg'), 'w').write(svg)
print('icons written:', sorted(os.listdir('icons')))
