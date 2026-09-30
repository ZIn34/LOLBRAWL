"""Turns the recorded demo footage into marketing media, all written to release/:

  lolbrawl-short.mp4   YouTube Short, vertical 1080x1920, ~40 s, captions + the fight zoomed in
  lolbrawl.gif         looping gameplay GIF (640x400) for itch.io / socials
  itch-cover.png       630x500 itch.io cover image
  icon.ico             Windows icon for the desktop .exe (also copied to desktop/)

Record the footage first (from desktop/):
  electron record.js ../release/frames/versus 24 30 4 versus 1920 1200
  electron record.js ../release/frames/royale 24 30 20 royale 1920 1200
Needs Pillow, numpy and imageio-ffmpeg; fonts are fetched into release/fonts (Silkscreen, JetBrains Mono, both OFL).
"""
import glob, os, shutil, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import imageio_ffmpeg

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REL = os.path.join(ROOT, 'release')
FR = os.path.join(REL, 'frames')
GROUND, AMBER, PINK, INK, DIM = (17, 15, 28), (255, 181, 71), (255, 111, 174), (239, 233, 255), (139, 132, 168)


def font(size, pixel=True, weight='ExtraBold'):
    if pixel:
        return ImageFont.truetype(os.path.join(REL, 'fonts', 'Silkscreen-Bold.ttf'), size)
    f = ImageFont.truetype(os.path.join(REL, 'fonts', 'JetBrainsMono.ttf'), size)
    try: f.set_variation_by_name(weight)
    except Exception: pass
    return f


def clip(name):
    files = sorted(glob.glob(os.path.join(FR, name, '*.png')))
    fps = float(open(os.path.join(FR, name, 'fps.txt')).read()) if os.path.exists(os.path.join(FR, name, 'fps.txt')) else 27.0
    return files, fps


# ---------- follow the two fighters in the versus footage ----------
def fighter_centre(img):
    a = np.asarray(img.convert('RGB').resize((480, 300)), dtype=np.int16)
    a[:56] = 0                                          # skip the HUD (health bars, timer, combo text)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    amber = (r > 200) & (g > 140) & (g < 215) & (b < 130)
    blue = (r < 150) & (g > 140) & (b > 220)
    ys, xs = np.nonzero(amber | blue)
    if len(xs) < 3: return None
    return xs.mean() * 4, ys.mean() * 4


def tracked_boxes(files, box_w, box_h):
    """One crop box per frame, following the fighters smoothly."""
    first = Image.open(files[0]); W, H = first.size
    cx, cy, out = W / 2, H / 2, []
    for f in files:
        c = fighter_centre(Image.open(f))
        if c: cx += (c[0] - cx) * 0.18; cy += (c[1] - cy) * 0.18
        x0 = int(min(max(cx - box_w / 2, 0), W - box_w)); y0 = int(min(max(cy - box_h / 2, 0), H - box_h))
        out.append((x0, y0, x0 + box_w, y0 + box_h))
    return out


def text_c(d, y, s, f, fill, W, glow=None, base=None):
    w = d.textlength(s, font=f)
    if glow and base is not None:
        layer = Image.new('RGBA', base.size, (0, 0, 0, 0))
        ImageDraw.Draw(layer).text(((W - w) / 2, y), s, font=f, fill=glow + (200,))
        base.alpha_composite(layer.filter(ImageFilter.GaussianBlur(14)))
    d.text(((W - w) / 2, y), s, font=f, fill=fill)


def dotted(W, H, step=48):
    im = Image.new('RGBA', (W, H), GROUND + (255,))
    d = ImageDraw.Draw(im)
    for y in range(step // 2, H, step):
        for x in range(step // 2, W, step):
            d.ellipse((x - 2, y - 2, x + 2, y + 2), fill=(40, 37, 56, 255))   # faint floor dot, drawn opaque
    return im


def logo(d, base, y, size, W):
    f = font(size); a = d.textlength('LOL', font=f); b = d.textlength('brawl', font=f)
    x = (W - a - b) / 2
    layer = Image.new('RGBA', base.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).text((x, y), 'LOL', font=f, fill=AMBER + (220,))
    base.alpha_composite(layer.filter(ImageFilter.GaussianBlur(size / 5)))
    d.text((x, y), 'LOL', font=f, fill=AMBER); d.text((x + a, y), 'brawl', font=f, fill=PINK)


# ---------- YouTube Short ----------
def make_short():
    W, H, PANEL, PY = 1080, 1920, 1080, 420
    vs, vfps = clip('versus'); ro, rfps = clip('royale')
    fps = round((vfps + rfps) / 2)
    vboxes = tracked_boxes(vs, 660, 660)
    # (clip, start s, end s, caption lines)
    plan = [
        ('versus', 0, 5, ['every fighter', 'is the word lol']),
        ('versus', 5, 11, ['grab a gun', 'bullets are *']),
        ('versus', 11, 18, ['best of 3', 'K.O. them']),
        ('versus', 20, 26, ['block right before', 'a hit = PARRY']),
        ('royale', 1, 7, ['16-lol', 'battle royale']),
        ('royale', 7, 13, ['last lol', 'standing wins']),
    ]
    out = os.path.join(REL, 'short_frames'); shutil.rmtree(out, ignore_errors=True); os.makedirs(out)
    bg = dotted(W, H)
    fcap, fsmall, flink = font(84), font(34, False), font(46)
    n = 0
    for name, t0, t1, lines in plan:
        files = vs if name == 'versus' else ro
        cfps = vfps if name == 'versus' else rfps
        i0, i1 = int(t0 * cfps), min(int(t1 * cfps), len(files))
        for k in range(i0, i1):
            fr = Image.open(files[k]).convert('RGB')
            if name == 'versus': fr = fr.crop(vboxes[k]).resize((PANEL, PANEL), Image.LANCZOS)
            else:
                w, h = fr.size; s = 760
                fr = fr.crop(((w - s) // 2, (h - s) // 2, (w + s) // 2, (h + s) // 2)).resize((PANEL, PANEL), Image.LANCZOS)
            im = bg.copy(); d = ImageDraw.Draw(im)
            logo(d, im, 70, 64, W)
            text_c(d, 200, lines[0], fcap, INK, W)
            text_c(d, 300, lines[1], fcap, AMBER, W, glow=AMBER, base=im)
            d = ImageDraw.Draw(im)
            im.paste(fr, (0, PY))
            d.line((0, PY, W, PY), fill=(58, 52, 82), width=3); d.line((0, PY + PANEL, W, PY + PANEL), fill=(58, 52, 82), width=3)
            text_c(d, PY + PANEL + 40, 'play free in your browser', fsmall, DIM, W)
            text_c(d, PY + PANEL + 92, 'zin34.github.io/LOLBRAWL', flink, AMBER, W)
            im.convert('RGB').save(os.path.join(out, f'{n:05d}.png')); n += 1
    # end card
    icon = Image.open(os.path.join(ROOT, 'icons', 'icon-512.png')).convert('RGBA').resize((360, 360), Image.LANCZOS)
    for k in range(int(3.5 * fps)):
        im = bg.copy(); d = ImageDraw.Draw(im)
        im.alpha_composite(icon, ((W - 360) // 2, 330))
        logo(d, im, 760, 110, W); d = ImageDraw.Draw(im)
        text_c(d, 930, 'solo · co-op · versus', font(48), INK, W)
        text_c(d, 1000, 'battle royale · online', font(48), INK, W)
        text_c(d, 1140, 'play free · no download', fsmall, DIM, W)
        text_c(d, 1200, 'zin34.github.io/LOLBRAWL', font(52), AMBER, W, glow=AMBER, base=im)
        im.convert('RGB').save(os.path.join(out, f'{n:05d}.png')); n += 1
    mp4 = os.path.join(REL, 'lolbrawl-short.mp4')
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-y', '-loglevel', 'error', '-framerate', str(fps), '-i', os.path.join(out, '%05d.png'),
                    '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000', '-shortest',
                    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '30',
                    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', mp4], check=True)
    print('short:', mp4, f'{n / fps:.1f}s', f'{os.path.getsize(mp4) / 1e6:.1f} MB')
    return out


# ---------- GIF ----------
def make_gif():
    vs, fps = clip('versus')
    boxes = tracked_boxes(vs, 1120, 700)
    frames = []
    for k in range(int(4 * fps), int(11 * fps), 2):
        fr = Image.open(vs[k]).convert('RGB').crop(boxes[k]).resize((640, 400), Image.LANCZOS)
        frames.append(fr.quantize(colors=48, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE))
    gif = os.path.join(REL, 'lolbrawl.gif')
    frames[0].save(gif, save_all=True, append_images=frames[1:], duration=int(2000 / fps), loop=0, optimize=True, disposal=1)
    print('gif:', gif, len(frames), 'frames', f'{os.path.getsize(gif) / 1e6:.1f} MB')


# ---------- itch.io cover ----------
def draw_lol(size, col, rot, punch=0.0):
    """A lol like the game draws it: an o head between two straight l arms. Faces right before rotation.
    punch pulls the front arm out toward what it faces."""
    S = size * 4
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    c, ro, st = S / 2, size * 0.34, size * 0.16
    d.ellipse((c - ro, c - ro, c + ro, c + ro), outline=col, width=int(st))
    bw, bl = size * 0.16, size * 0.72
    back = (c - size * 0.2, c - size * 0.62)                               # rear arm, above
    front = (c - size * 0.2 + punch * size * 1.3, c + size * 0.62 - punch * size * 0.62)   # front arm swings out
    for (x, y), horiz in ((back, False), (front, punch > 0.5)):
        if horiz: d.rounded_rectangle((x - bl / 2, y - bw / 2, x + bl / 2, y + bw / 2), radius=bw / 2, fill=col)
        else: d.rounded_rectangle((x - bl / 2, y - bw / 2, x + bl / 2, y + bw / 2), radius=bw / 2, fill=col)
    return im.rotate(rot, resample=Image.BICUBIC)


def make_cover():
    W, H = 630, 500
    im = dotted(W, H, 36)
    art = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    blue = (111, 168, 255, 255)
    a = draw_lol(120, AMBER + (255,), 0, punch=1.0); b = draw_lol(120, blue, 180)
    art.alpha_composite(a, (int(190 - a.width / 2), int(285 - a.height / 2)))
    art.alpha_composite(b, (int(455 - b.width / 2), int(285 - b.height / 2)))
    glow = art.filter(ImageFilter.GaussianBlur(16)); im.alpha_composite(glow); im.alpha_composite(art)
    d = ImageDraw.Draw(im)
    # the hit: a white * and a POW
    hit = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(hit).text((343, 225), '*', font=font(90, False), fill=(255, 255, 255, 255))
    im.alpha_composite(hit.filter(ImageFilter.GaussianBlur(10))); im.alpha_composite(hit)
    d = ImageDraw.Draw(im)
    d.text((300, 150), 'POW', font=font(44), fill=(255, 233, 168))
    for dx, dy, ch in ((-60, -30, '+'), (40, 60, "'"), (-30, 70, '*'), (70, -40, '`')):
        d.text((360 + dx, 270 + dy), ch, font=font(26, False), fill=(255, 233, 168))
    logo(d, im, 30, 70, W); d = ImageDraw.Draw(im)
    text_c(d, 408, 'every fighter is the word lol', font(22, False), INK, W)
    text_c(d, 444, 'solo · co-op · versus · battle royale · online', font(18, False, 'Bold'), DIM, W)
    cover = os.path.join(REL, 'itch-cover.png'); im.convert('RGB').save(cover)
    print('cover:', cover)


# ---------- Windows icon ----------
def make_ico():
    src = Image.open(os.path.join(ROOT, 'icons', 'icon-512.png')).convert('RGBA')
    ico = os.path.join(REL, 'icon.ico')
    src.save(ico, sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    shutil.copy(ico, os.path.join(ROOT, 'desktop', 'icon.ico'))
    print('ico:', ico)


if __name__ == '__main__':
    make_ico(); make_cover(); make_gif(); make_short()
