#!/usr/bin/env python3
"""Generate a launcher icon PNG with no third-party libs (stdlib zlib only).
Draws a candy-pink rounded tile with a stack of pancakes + butter and sparkles."""
import zlib, struct, math, pathlib

N = 192
buf = bytearray(N * N * 4)  # RGBA


def put(x, y, r, g, b, a):
    if x < 0 or y < 0 or x >= N or y >= N or a <= 0:
        return
    i = (y * N + x) * 4
    ia = 255 - a
    buf[i] = (r * a + buf[i] * ia) // 255
    buf[i + 1] = (g * a + buf[i + 1] * ia) // 255
    buf[i + 2] = (b * a + buf[i + 2] * ia) // 255
    buf[i + 3] = min(255, buf[i + 3] + a)


def rounded_rect(x0, y0, x1, y1, rad, col):
    r, g, b, a = col
    for y in range(y0, y1):
        for x in range(x0, x1):
            dx = dy = 0
            if x < x0 + rad: dx = x0 + rad - x
            elif x > x1 - 1 - rad: dx = x - (x1 - 1 - rad)
            if y < y0 + rad: dy = y0 + rad - y
            elif y > y1 - 1 - rad: dy = y - (y1 - 1 - rad)
            if dx * dx + dy * dy <= rad * rad:
                put(x, y, r, g, b, a)


def ellipse(cx, cy, rx, ry, col):
    r, g, b, a = col
    for y in range(int(cy - ry), int(cy + ry) + 1):
        for x in range(int(cx - rx), int(cx + rx) + 1):
            nx = (x - cx) / rx
            ny = (y - cy) / ry
            if nx * nx + ny * ny <= 1.0:
                put(x, y, r, g, b, a)


# background: candy pink rounded tile with a soft top-light band
rounded_rect(6, 6, N - 6, N - 6, 40, (255, 120, 185, 255))
rounded_rect(6, 6, N - 6, 96, 40, (255, 160, 210, 90))   # top highlight

# white plate
ellipse(96, 120, 66, 20, (255, 255, 255, 235))

# pancake stack (bottom to top)
stack = [(128, (224, 160, 96)), (112, (239, 190, 120)), (96, (224, 160, 96))]
for yy, (r, g, b) in stack:
    ellipse(96, yy, 46, 15, (r, g, b, 255))
    ellipse(96, yy + 5, 46, 10, (200, 138, 72, 255))  # a touch of shading below

# butter pat
rounded_rect(84, 74, 108, 90, 5, (255, 236, 120, 255))
rounded_rect(84, 74, 108, 84, 4, (255, 224, 90, 255))

# syrup drip highlight
ellipse(84, 96, 10, 3, (255, 255, 255, 90))

# sparkles
for (sx, sy, s) in [(150, 60, 7), (44, 78, 6), (150, 150, 5)]:
    for d in range(-s, s + 1):
        put(sx + d, sy, 255, 255, 255, 220)
        put(sx, sy + d, 255, 255, 255, 220)


def chunk(tag, data):
    return (struct.pack(">I", len(data)) + tag + data +
            struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff))


# build PNG (filter byte 0 per scanline)
raw = bytearray()
for y in range(N):
    raw.append(0)
    raw.extend(buf[y * N * 4:(y + 1) * N * 4])

png = b"\x89PNG\r\n\x1a\n"
png += chunk(b"IHDR", struct.pack(">IIBBBBB", N, N, 8, 6, 0, 0, 0))
png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
png += chunk(b"IEND", b"")

out = pathlib.Path(__file__).resolve().parent.parent / "android" / "res" / "drawable" / "icon.png"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_bytes(png)
print(f"Wrote {out}  ({len(png)} bytes, {N}x{N})")
