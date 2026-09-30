"""Turns the recorded demo footage into marketing media, all written to release/:

  lolbrawl-short.mp4   YouTube Short, vertical 1080x1920, ~30 s: title, then SOLO / CO-OP / VERSUS / BATTLE ROYALE
                       footage with the game's own sound effects over a chiptune track
  lolbrawl.gif         looping gameplay GIF (640x400) for itch.io / socials
  itch-cover.png       630x500 itch.io cover image
  icon.ico             Windows icon for the desktop .exe (also copied to desktop/)

Record the footage first (from desktop/), slowed to 0.35x so every frame is captured:
  electron record.js ../release/frames/solo 12 30 6 solo 1920 1200 0.35
  electron record.js ../release/frames/coop 12 30 6 coop 1920 1200 0.35
  electron record.js ../release/frames/versus 14 30 4 versus 1920 1200 0.35
  electron record.js ../release/frames/royale 14 30 20 royale 1920 1200 0.35
Needs Pillow, numpy and imageio-ffmpeg; fonts are fetched into release/fonts (Silkscreen, JetBrains Mono, both OFL).
"""
import bisect, glob, json, os, shutil, subprocess
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
def clip_data(name):
    files, _ = clip(name)
    d = os.path.join(FR, name)
    clocks = json.load(open(os.path.join(d, 'clocks.json')))
    sounds = json.load(open(os.path.join(d, 'sounds.json')))
    return files, clocks, sounds


def frame_at(clocks, t):
    """Index of the recorded frame closest to game time t."""
    i = bisect.bisect_left(clocks, t)
    if i <= 0: return 0
    if i >= len(clocks): return len(clocks) - 1
    return i if clocks[i] - t < t - clocks[i - 1] else i - 1


def make_short():
    W, H, PANEL, PY, FPS = 1080, 1920, 1080, 420, 30
    # (clip, game-time window from the clip's first frame, big caption, small caption)
    plan = [
        ('solo', 0.0, 2.5, None, 'every fighter is the word lol'),
        ('solo', 2.5, 8.0, 'SOLO', 'waves of angry lols'),
        ('coop', 2.0, 7.5, 'CO-OP', 'team up with a friend'),
        ('versus', 3.0, 9.0, 'VERSUS', '1v1 · online or vs AI'),
        ('royale', 2.0, 9.0, 'BATTLE ROYALE', '16 lols. one survives.'),
    ]
    data = {n: clip_data(n) for n in {p[0] for p in plan}}
    boxes = {n: tracked_boxes(data[n][0], 760, 760) for n in data if n != 'royale'}
    out = os.path.join(REL, 'short_frames'); shutil.rmtree(out, ignore_errors=True); os.makedirs(out)
    bg = dotted(W, H)
    fmode, fsub, fsmall, flink = font(104), font(42, False), font(34, False), font(46)
    n, events, T = 0, [], 0.0
    for name, a, b, big, sub in plan:
        files, clocks, sounds = data[name]
        c0 = clocks[0] + a
        events += [[round(T + (t - c0), 3), snd] for t, snd in sounds if c0 <= t < clocks[0] + b]
        for k in range(int((b - a) * FPS)):
            i = frame_at(clocks, c0 + k / FPS)
            fr = Image.open(files[i]).convert('RGB')
            if name == 'royale':
                w, h = fr.size; sz = 760
                fr = fr.crop(((w - sz) // 2, (h - sz) // 2, (w + sz) // 2, (h + sz) // 2))
            else:
                fr = fr.crop(boxes[name][i])
            fr = fr.resize((PANEL, PANEL), Image.LANCZOS)
            im = bg.copy(); d = ImageDraw.Draw(im)
            if big is None:                                  # opening title
                logo(d, im, 150, 120, W); d = ImageDraw.Draw(im)
                text_c(d, 318, sub, fsub, INK, W)
            else:
                logo(d, im, 60, 56, W); d = ImageDraw.Draw(im)
                text_c(d, 170, big, fmode if len(big) < 10 else font(84), AMBER, W, glow=AMBER, base=im); d = ImageDraw.Draw(im)
                text_c(d, 320, sub, fsub, INK, W)
            im.paste(fr, (0, PY))
            d.line((0, PY, W, PY), fill=(58, 52, 82), width=3); d.line((0, PY + PANEL, W, PY + PANEL), fill=(58, 52, 82), width=3)
            im.convert('RGB').save(os.path.join(out, f'{n:05d}.png')); n += 1
        T += b - a
    # end card, with the wave-clear jingle
    events.append([round(T + 0.1, 3), 'clear'])
    icon = Image.open(os.path.join(ROOT, 'icons', 'icon-512.png')).convert('RGBA').resize((360, 360), Image.LANCZOS)
    for k in range(int(3.5 * FPS)):
        im = bg.copy(); d = ImageDraw.Draw(im)
        im.alpha_composite(icon, ((W - 360) // 2, 360))
        logo(d, im, 790, 110, W); d = ImageDraw.Draw(im)
        text_c(d, 960, 'play free · online · on your phone', fsmall, INK, W)
        text_c(d, 1030, 'zin34.github.io/LOLBRAWL', font(52), AMBER, W, glow=AMBER, base=im)
        im.convert('RGB').save(os.path.join(out, f'{n:05d}.png')); n += 1
    T += 3.5
    # sound: the game's own effects at the moments they happened, over a chiptune track
    ev = os.path.join(REL, 'short_sounds.json'); json.dump(events, open(ev, 'w'))
    wav = os.path.join(REL, 'short_audio.wav')
    electron = os.path.join(ROOT, 'desktop', 'node_modules', 'electron', 'dist', 'electron.exe')
    subprocess.run([electron, 'record.js', '--render', ev, f'{T:.2f}', wav], cwd=os.path.join(ROOT, 'desktop'), check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    mp4 = os.path.join(REL, 'lolbrawl-short.mp4')
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', os.path.join(out, '%05d.png'),
                    '-i', wav, '-shortest', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
                    '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11',   # YouTube's loudness target
                    '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', mp4], check=True)
    print('short:', mp4, f'{T:.1f}s', len(events), 'sounds', f'{os.path.getsize(mp4) / 1e6:.1f} MB')


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
