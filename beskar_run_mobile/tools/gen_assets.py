#!/usr/bin/env python3
"""Procedural pixel-art + SFX generator for Beskar Run.

Run with the project venv:  .venv/bin/python tools/gen_assets.py
Outputs PNG sprites and WAV sound effects into assets/.
Everything is drawn programmatically so the repo stays self-contained.
"""
import math
import os
import struct
import wave
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPR = os.path.join(ROOT, "assets", "sprites")
BG = os.path.join(ROOT, "assets", "backgrounds")
SFX = os.path.join(ROOT, "assets", "sfx")
for d in (SPR, BG, SFX, os.path.join(ROOT, "assets")):
    os.makedirs(d, exist_ok=True)

# ----------------------------------------------------------------------------
# helpers
# ----------------------------------------------------------------------------

def img(w, h):
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


def save(im, path):
    im.save(path)
    print("wrote", os.path.relpath(path, ROOT))


def outline(im, color=(8, 10, 24, 255)):
    """Add a 1px dark outline around opaque pixels (chunky sprite look)."""
    px = im.load()
    w, h = im.size
    out = im.copy()
    opx = out.load()
    for y in range(h):
        for x in range(w):
            if px[x, y][3] == 0:
                near = False
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] > 0:
                        near = True
                        break
                if near:
                    opx[x, y] = color
    return out


def scale(im, factor):
    return im.resize((im.width * factor, im.height * factor), Image.NEAREST)


# ----------------------------------------------------------------------------
# player ship — green beskar gunship pointing right
# ----------------------------------------------------------------------------

def player_ship():
    im = img(48, 32)
    d = ImageDraw.Draw(im)
    hull = (74, 158, 96, 255)
    hull_l = (120, 206, 140, 255)
    hull_d = (44, 104, 66, 255)
    metal = (170, 190, 200, 255)
    glow = (120, 220, 255, 255)
    # main fuselage
    d.polygon([(4, 12), (4, 20), (34, 24), (46, 16), (34, 8)], fill=hull)
    # top highlight
    d.polygon([(6, 12), (32, 9), (42, 15), (32, 13)], fill=hull_l)
    # bottom shade
    d.polygon([(6, 20), (32, 23), (42, 17), (32, 19)], fill=hull_d)
    # wings
    d.polygon([(10, 6), (20, 12), (12, 12)], fill=hull_d)
    d.polygon([(10, 26), (20, 20), (12, 20)], fill=hull_d)
    # cockpit
    d.ellipse([26, 13, 34, 19], fill=glow)
    d.ellipse([28, 14, 32, 17], fill=(220, 245, 255, 255))
    # nose cannon
    d.rectangle([44, 14, 48, 18], fill=metal)
    # engine
    d.rectangle([2, 13, 5, 19], fill=metal)
    im = outline(im)
    save(scale(im, 2), os.path.join(SPR, "player_ship.png"))


def companion():
    im = img(16, 16)
    d = ImageDraw.Draw(im)
    robe = (150, 170, 120, 255)
    robe_d = (110, 130, 86, 255)
    skin = (140, 200, 130, 255)
    ear = (120, 180, 110, 255)
    # robe
    d.ellipse([3, 7, 13, 15], fill=robe)
    d.ellipse([3, 10, 13, 15], fill=robe_d)
    # head
    d.ellipse([4, 2, 12, 10], fill=skin)
    # ears
    d.ellipse([0, 4, 5, 8], fill=ear)
    d.ellipse([11, 4, 16, 8], fill=ear)
    # eyes
    d.ellipse([5, 4, 7, 7], fill=(20, 20, 30, 255))
    d.ellipse([9, 4, 11, 7], fill=(20, 20, 30, 255))
    im = outline(im)
    save(scale(im, 2), os.path.join(SPR, "companion.png"))


# ----------------------------------------------------------------------------
# enemies
# ----------------------------------------------------------------------------

def enemy_grunt():
    im = img(28, 24)
    d = ImageDraw.Draw(im)
    body = (200, 90, 80, 255)
    body_d = (150, 56, 50, 255)
    eye = (255, 220, 120, 255)
    # arrow pointing left (toward player)
    d.polygon([(2, 12), (16, 4), (26, 8), (26, 16), (16, 20)], fill=body)
    d.polygon([(2, 12), (16, 14), (26, 16), (16, 20)], fill=body_d)
    d.ellipse([16, 9, 22, 15], fill=eye)
    d.ellipse([18, 10, 20, 13], fill=(40, 20, 20, 255))
    im = outline(im)
    save(scale(im, 2), os.path.join(SPR, "enemy_grunt.png"))


def enemy_shooter():
    im = img(32, 28)
    d = ImageDraw.Draw(im)
    body = (130, 120, 200, 255)
    body_d = (90, 82, 150, 255)
    metal = (180, 185, 200, 255)
    eye = (255, 120, 120, 255)
    d.polygon([(4, 6), (28, 12), (28, 16), (4, 22), (2, 14)], fill=body)
    d.polygon([(4, 14), (28, 16), (4, 22)], fill=body_d)
    # twin guns facing left
    d.rectangle([0, 9, 6, 11], fill=metal)
    d.rectangle([0, 17, 6, 19], fill=metal)
    # eye
    d.ellipse([16, 10, 24, 18], fill=eye)
    d.ellipse([18, 12, 22, 16], fill=(60, 20, 20, 255))
    im = outline(im)
    save(scale(im, 2), os.path.join(SPR, "enemy_shooter.png"))


# ----------------------------------------------------------------------------
# bosses
# ----------------------------------------------------------------------------

def boss_hauler():
    im = img(96, 72)
    d = ImageDraw.Draw(im)
    body = (160, 140, 90, 255)
    body_d = (110, 96, 60, 255)
    metal = (170, 175, 185, 255)
    glow = (255, 170, 80, 255)
    # bulky mining hauler
    d.rounded_rectangle([10, 14, 86, 58], radius=8, fill=body)
    d.rectangle([10, 36, 86, 58], fill=body_d)
    # claw / drill at front (left)
    d.polygon([(10, 24), (0, 36), (10, 48)], fill=metal)
    d.polygon([(4, 30), (0, 36), (4, 42)], fill=(120, 125, 135, 255))
    # cargo lights
    for cx in range(22, 80, 16):
        d.ellipse([cx, 22, cx + 8, 30], fill=glow)
    # turrets
    d.rectangle([30, 6, 38, 16], fill=metal)
    d.rectangle([58, 6, 66, 16], fill=metal)
    im = outline(im)
    save(scale(im, 2), os.path.join(SPR, "boss_hauler.png"))


def boss_cruiser():
    im = img(104, 64)
    d = ImageDraw.Draw(im)
    hull = (150, 155, 170, 255)
    hull_d = (100, 105, 120, 255)
    glow = (120, 220, 255, 255)
    # wedge cruiser pointing left
    d.polygon([(0, 32), (60, 12), (104, 18), (104, 46), (60, 52)], fill=hull)
    d.polygon([(0, 32), (60, 32), (104, 46), (60, 52)], fill=hull_d)
    # tower
    d.rectangle([70, 4, 86, 18], fill=hull_d)
    # window strips
    for wx in range(20, 96, 10):
        d.rectangle([wx, 26, wx + 5, 29], fill=glow)
    # engines (right)
    d.rectangle([100, 22, 104, 28], fill=glow)
    d.rectangle([100, 36, 104, 42], fill=glow)
    im = outline(im)
    save(scale(im, 2), os.path.join(SPR, "boss_cruiser.png"))


def boss_walker():
    im = img(88, 80)
    d = ImageDraw.Draw(im)
    body = (120, 130, 120, 255)
    body_d = (84, 92, 84, 255)
    metal = (160, 165, 160, 255)
    eye = (255, 120, 80, 255)
    # head
    d.rounded_rectangle([20, 6, 70, 34], radius=6, fill=body)
    d.rectangle([20, 22, 70, 34], fill=body_d)
    # eyes / guns (left)
    d.rectangle([10, 14, 22, 18], fill=metal)
    d.rectangle([10, 22, 22, 26], fill=metal)
    d.ellipse([28, 12, 40, 24], fill=eye)
    d.ellipse([31, 15, 37, 21], fill=(60, 20, 10, 255))
    # neck + body
    d.rectangle([38, 32, 52, 44], fill=body_d)
    d.rounded_rectangle([26, 42, 64, 60], radius=4, fill=body)
    # legs
    for lx in (28, 56):
        d.line([(lx, 58), (lx - 6, 78)], fill=body_d, width=5)
        d.line([(lx + 8, 58), (lx + 14, 78)], fill=body_d, width=5)
    im = outline(im)
    save(scale(im, 2), os.path.join(SPR, "boss_walker.png"))


# ----------------------------------------------------------------------------
# projectiles & pickups
# ----------------------------------------------------------------------------

def player_bullet():
    im = img(12, 6)
    d = ImageDraw.Draw(im)
    d.ellipse([0, 1, 11, 4], fill=(120, 230, 160, 255))
    d.ellipse([2, 1, 9, 4], fill=(220, 255, 220, 255))
    save(scale(im, 2), os.path.join(SPR, "player_bullet.png"))


def enemy_bullet():
    im = img(10, 10)
    d = ImageDraw.Draw(im)
    d.ellipse([0, 0, 9, 9], fill=(255, 140, 90, 255))
    d.ellipse([2, 2, 7, 7], fill=(255, 230, 160, 255))
    save(scale(im, 2), os.path.join(SPR, "enemy_bullet.png"))


def missile():
    im = img(16, 8)
    d = ImageDraw.Draw(im)
    d.rectangle([0, 2, 12, 5], fill=(210, 215, 225, 255))
    d.polygon([(12, 1), (16, 4), (12, 6)], fill=(255, 90, 70, 255))
    d.polygon([(0, 1), (3, 2), (3, 5), (0, 6)], fill=(255, 180, 80, 255))
    im = outline(im)
    save(scale(im, 2), os.path.join(SPR, "missile.png"))


def laser():
    # a horizontal white beam segment, tinted/stretched in engine
    im = img(8, 8)
    d = ImageDraw.Draw(im)
    d.rectangle([0, 1, 7, 6], fill=(230, 160, 255, 255))
    d.rectangle([0, 3, 7, 4], fill=(255, 255, 255, 255))
    save(scale(im, 2), os.path.join(SPR, "laser.png"))


def beskar(sparkle=False):
    im = img(16, 12)
    d = ImageDraw.Draw(im)
    gold = (255, 200, 60, 255) if not sparkle else (180, 240, 255, 255)
    gold_l = (255, 235, 150, 255) if not sparkle else (230, 250, 255, 255)
    gold_d = (200, 150, 30, 255) if not sparkle else (120, 190, 230, 255)
    d.polygon([(2, 8), (5, 3), (11, 3), (14, 8), (8, 11)], fill=gold)
    d.polygon([(5, 3), (11, 3), (9, 6), (6, 6)], fill=gold_l)
    d.polygon([(2, 8), (8, 11), (6, 6)], fill=gold_d)
    im = outline(im)
    name = "beskar_sparkle.png" if sparkle else "beskar.png"
    save(scale(im, 2), os.path.join(SPR, name))


def heart():
    im = img(14, 13)
    d = ImageDraw.Draw(im)
    r = (230, 70, 90, 255)
    rl = (255, 140, 150, 255)
    d.ellipse([1, 1, 7, 7], fill=r)
    d.ellipse([6, 1, 12, 7], fill=r)
    d.polygon([(1, 5), (12, 5), (7, 12)], fill=r)
    d.ellipse([2, 2, 5, 5], fill=rl)
    im = outline(im)
    save(scale(im, 2), os.path.join(SPR, "heart.png"))


def heart_empty():
    im = img(14, 13)
    d = ImageDraw.Draw(im)
    c = (70, 60, 80, 255)
    d.ellipse([1, 1, 7, 7], fill=c)
    d.ellipse([6, 1, 12, 7], fill=c)
    d.polygon([(1, 5), (12, 5), (7, 12)], fill=c)
    im = outline(im, (40, 35, 50, 255))
    save(scale(im, 2), os.path.join(SPR, "heart_empty.png"))


def asteroid():
    im = img(32, 32)
    d = ImageDraw.Draw(im)
    rock = (120, 110, 120, 255)
    rock_d = (84, 76, 88, 255)
    rock_l = (160, 150, 160, 255)
    d.polygon([(4, 14), (10, 4), (22, 3), (29, 12), (28, 24), (16, 30), (5, 24)], fill=rock)
    d.polygon([(16, 30), (28, 24), (28, 14), (16, 18)], fill=rock_d)
    d.ellipse([9, 8, 15, 14], fill=rock_l)
    d.ellipse([18, 16, 23, 21], fill=rock_d)
    im = outline(im)
    save(scale(im, 2), os.path.join(SPR, "asteroid.png"))


def explosion_sheet():
    # 5 frames horizontal, 24x24 each
    f = 24
    frames = 5
    im = img(f * frames, f)
    d = ImageDraw.Draw(im)
    cols = [(255, 240, 180, 255), (255, 180, 70, 255), (255, 110, 50, 255),
            (200, 70, 40, 200), (120, 50, 40, 120)]
    radii = [4, 8, 11, 10, 7]
    for i in range(frames):
        cx = i * f + f // 2
        cy = f // 2
        r = radii[i]
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=cols[i])
        if i >= 1:
            for a in range(0, 360, 45):
                ex = cx + int((r + 3) * math.cos(math.radians(a)))
                ey = cy + int((r + 3) * math.sin(math.radians(a)))
                d.ellipse([ex - 2, ey - 2, ex + 2, ey + 2], fill=cols[min(i + 1, 4)])
    save(scale(im, 2), os.path.join(SPR, "explosion.png"))


def particle():
    im = img(6, 6)
    d = ImageDraw.Draw(im)
    d.ellipse([0, 0, 5, 5], fill=(255, 255, 255, 255))
    save(scale(im, 2), os.path.join(SPR, "particle.png"))


def force_ring():
    im = img(64, 64)
    d = ImageDraw.Draw(im)
    d.ellipse([2, 2, 61, 61], outline=(140, 220, 255, 255), width=4)
    d.ellipse([8, 8, 55, 55], outline=(200, 245, 255, 200), width=2)
    save(im, os.path.join(SPR, "force_ring.png"))


# ----------------------------------------------------------------------------
# backgrounds (tileable wide strips per level)
# ----------------------------------------------------------------------------

def _grad(w, h, top, bottom):
    im = img(w, h)
    px = im.load()
    for y in range(h):
        t = y / max(1, h - 1)
        c = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)) + (255,)
        for x in range(w):
            px[x, y] = c
    return im


def _stars(im, n, sizes, colors, seed):
    d = ImageDraw.Draw(im)
    w, h = im.size
    st = seed
    def rnd():
        nonlocal st
        st = (1103515245 * st + 12345) & 0x7fffffff
        return st / 0x7fffffff
    for _ in range(n):
        x = int(rnd() * w)
        y = int(rnd() * h)
        s = sizes[int(rnd() * len(sizes))]
        c = colors[int(rnd() * len(colors))]
        d.ellipse([x, y, x + s, y + s], fill=c)
    return im


W, H = 1280, 720

# Level 1 — Asteroid Field (deep space)
def bg_l1():
    far = _grad(W, H, (10, 12, 34), (24, 16, 48))
    far = _stars(far, 220, [1, 1, 2], [(180, 190, 230, 255), (150, 160, 210, 220)], 7)
    save(far, os.path.join(BG, "l1_far.png"))
    mid = img(W, H)
    # nebula blobs
    d = ImageDraw.Draw(mid, "RGBA")
    for (cx, cy, r, col) in [(300, 200, 180, (90, 60, 160, 40)), (900, 480, 240, (40, 90, 160, 36)),
                             (640, 120, 160, (120, 50, 120, 32))]:
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col)
    mid = _stars(mid, 80, [2, 3], [(220, 230, 255, 255)], 13)
    save(mid, os.path.join(BG, "l1_mid.png"))


# Level 2 — Imperial Fleet (nebula + capital ship hulls)
def bg_l2():
    far = _grad(W, H, (24, 14, 40), (40, 20, 54))
    d = ImageDraw.Draw(far, "RGBA")
    for (cx, cy, r, col) in [(400, 300, 280, (120, 40, 120, 50)), (950, 250, 240, (60, 40, 150, 46))]:
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col)
    far = _stars(far, 160, [1, 2], [(210, 200, 240, 230)], 21)
    save(far, os.path.join(BG, "l2_far.png"))
    mid = img(W, H)
    d = ImageDraw.Draw(mid, "RGBA")
    hull = (70, 78, 96, 220)
    hull_d = (48, 54, 70, 220)
    glow = (150, 210, 255, 255)
    # big capital-ship wedges
    for (ox, oy, s) in [(120, 420, 1.0), (760, 120, 1.3), (1020, 520, 0.8)]:
        d.polygon([(ox, oy), (ox + int(360 * s), oy - int(70 * s)),
                   (ox + int(360 * s), oy + int(40 * s)), (ox, oy + int(90 * s))], fill=hull)
        d.polygon([(ox, oy + int(40 * s)), (ox + int(360 * s), oy + int(40 * s)),
                   (ox, oy + int(90 * s))], fill=hull_d)
        for wx in range(int(ox) + 20, int(ox) + int(340 * s), 26):
            d.rectangle([wx, oy + int(10 * s), wx + 6, oy + int(16 * s)], fill=glow)
    save(mid, os.path.join(BG, "l2_mid.png"))


# Level 3 — Planet Surface (warm sky, mountains, ground)
def bg_l3():
    far = _grad(W, H, (90, 130, 200, 255)[:3], (250, 200, 150))
    far = _stars(far, 26, [2, 3], [(255, 255, 230, 200)], 33)  # faint stars high up
    save(far, os.path.join(BG, "l3_far.png"))
    mid = img(W, H)
    d = ImageDraw.Draw(mid, "RGBA")
    # distant mountains
    m1 = (110, 96, 140, 220)
    pts = [(0, 520)]
    xs = [0, 160, 320, 480, 640, 800, 960, 1120, 1280]
    ys = [520, 380, 460, 320, 440, 360, 480, 360, 500]
    for x, y in zip(xs, ys):
        pts.append((x, y))
    pts += [(1280, 720), (0, 720)]
    d.polygon(pts, fill=m1)
    save(mid, os.path.join(BG, "l3_mid.png"))
    ground = img(W, 160)
    dg = ImageDraw.Draw(ground)
    dg.rectangle([0, 0, W, 160], fill=(120, 90, 70, 255))
    dg.rectangle([0, 0, W, 18], fill=(150, 116, 86, 255))
    for x in range(0, W, 40):
        dg.rectangle([x + 6, 30, x + 30, 50], fill=(98, 72, 56, 255))
        dg.rectangle([x + 18, 70, x + 40, 90], fill=(98, 72, 56, 255))
    save(ground, os.path.join(BG, "l3_ground.png"))


# ----------------------------------------------------------------------------
# app icon
# ----------------------------------------------------------------------------

def app_icon():
    im = img(128, 128)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([4, 4, 123, 123], radius=22, fill=(16, 22, 48, 255))
    d.rounded_rectangle([4, 4, 123, 123], radius=22, outline=(120, 220, 255, 255), width=3)
    # stylized green ship
    hull = (90, 200, 120, 255)
    d.polygon([(28, 56), (28, 80), (92, 92), (112, 68), (92, 44)], fill=hull)
    d.polygon([(34, 56), (88, 50), (104, 68), (88, 60)], fill=(150, 240, 170, 255))
    d.ellipse([74, 58, 92, 76], fill=(150, 230, 255, 255))
    d.rectangle([108, 62, 120, 74], fill=(200, 210, 220, 255))
    # gold sparkle
    d.polygon([(40, 24), (44, 34), (54, 38), (44, 42), (40, 52), (36, 42), (26, 38), (36, 34)],
              fill=(255, 210, 70, 255))
    save(im.resize((256, 256), Image.NEAREST), os.path.join(ROOT, "assets", "icon.png"))


# ----------------------------------------------------------------------------
# SFX (tiny procedural WAV blips, no external deps)
# ----------------------------------------------------------------------------
RATE = 22050

def _write_wav(name, samples):
    path = os.path.join(SFX, name)
    with wave.open(path, "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        frames = b"".join(struct.pack("<h", int(max(-1, min(1, s)) * 30000)) for s in samples)
        w.writeframes(frames)
    print("wrote", os.path.relpath(path, ROOT))


def _tone(freq, dur, vol=1.0, decay=True, wave_type="square", sweep=0.0):
    n = int(RATE * dur)
    out = []
    for i in range(n):
        t = i / RATE
        f = freq + sweep * t
        ph = f * t
        if wave_type == "square":
            v = 1.0 if (ph % 1.0) < 0.5 else -1.0
        elif wave_type == "saw":
            v = 2.0 * (ph % 1.0) - 1.0
        elif wave_type == "noise":
            v = ((i * 1103515245 + 12345) & 0xffff) / 32768.0 - 1.0
        else:
            v = math.sin(2 * math.pi * ph)
        env = (1.0 - i / n) if decay else 1.0
        out.append(v * env * vol)
    return out


def gen_sfx():
    _write_wav("shoot.wav", _tone(880, 0.10, 0.5, sweep=-3000, wave_type="square"))
    _write_wav("enemy_shoot.wav", _tone(330, 0.12, 0.45, sweep=-1200, wave_type="saw"))
    _write_wav("hit.wav", _tone(160, 0.14, 0.6, wave_type="noise"))
    _write_wav("explode.wav", _tone(120, 0.35, 0.7, wave_type="noise", sweep=-200))
    _write_wav("pickup.wav", _tone(1200, 0.09, 0.4, sweep=1800, wave_type="sine"))
    _write_wav("force.wav", _tone(200, 0.5, 0.6, sweep=600, wave_type="sine"))
    _write_wav("button.wav", _tone(600, 0.06, 0.4, wave_type="square"))
    win = _tone(523, 0.12, 0.5, decay=False, wave_type="square")
    win += _tone(659, 0.12, 0.5, decay=False, wave_type="square")
    win += _tone(784, 0.22, 0.5, wave_type="square")
    _write_wav("win.wav", win)
    lose = _tone(392, 0.16, 0.5, decay=False, wave_type="saw")
    lose += _tone(294, 0.16, 0.5, decay=False, wave_type="saw")
    lose += _tone(196, 0.3, 0.5, wave_type="saw")
    _write_wav("lose.wav", lose)
    _write_wav("boss.wav", _tone(90, 0.6, 0.7, wave_type="saw", sweep=120))


# ----------------------------------------------------------------------------

def main():
    player_ship()
    companion()
    enemy_grunt()
    enemy_shooter()
    boss_hauler()
    boss_cruiser()
    boss_walker()
    player_bullet()
    enemy_bullet()
    missile()
    laser()
    beskar(False)
    beskar(True)
    heart()
    heart_empty()
    asteroid()
    explosion_sheet()
    particle()
    force_ring()
    bg_l1()
    bg_l2()
    bg_l3()
    app_icon()
    gen_sfx()
    print("done")


if __name__ == "__main__":
    main()
