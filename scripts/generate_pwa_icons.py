import zlib
import struct
import math
import os

def create_png(width, height, draw_func, filename):
    raw_data = bytearray()
    for y in range(height):
        raw_data.append(0)  # filter type 0 (None)
        for x in range(width):
            r, g, b, a = draw_func(x, y, width, height)
            raw_data.extend([r, g, b, a])
    
    def chunk(tag, data):
        return (
            struct.pack('>I', len(data)) +
            tag +
            data +
            struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)
        )
    
    png = bytearray(b'\x89PNG\r\n\x1a\n')
    # IHDR
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    png.extend(chunk(b'IHDR', ihdr_data))
    # IDAT
    compressed = zlib.compress(bytes(raw_data), 9)
    png.extend(chunk(b'IDAT', compressed))
    # IEND
    png.extend(chunk(b'IEND', b''))
    
    with open(filename, 'wb') as f:
        f.write(png)
    print(f"Generated {filename} ({width}x{height})")

def metal_icon_pixel(x, y, w, h, is_maskable=False):
    # Normalize coordinates to -1.0 .. 1.0
    nx = (x / w) * 2.0 - 1.0
    ny = (y / h) * 2.0 - 1.0
    dist = math.sqrt(nx * nx + ny * ny)

    # Base background gradient (slate-950 to ocean cyan)
    bg_t = (ny + 1.0) * 0.5
    bg_r = int(2 + bg_t * 6)
    bg_g = int(6 + bg_t * 50)
    bg_b = int(23 + bg_t * 90)

    # If standard icon (not maskable), apply rounded corners
    if not is_maskable:
        # Distance from box with corner radius
        cr = 0.35
        dx = max(0.0, abs(nx) - (1.0 - cr))
        dy = max(0.0, abs(ny) - (1.0 - cr))
        corner_dist = math.sqrt(dx * dx + dy * dy)
        if corner_dist > cr:
            return (0, 0, 0, 0)

    # Compass outer ring at radius 0.70..0.76
    if 0.70 <= dist <= 0.76:
        return (2, 132, 199, 255) # #0284c7
    if 0.67 <= dist <= 0.69:
        return (56, 189, 248, 200)

    # Inner radar ring at 0.42..0.45
    if 0.42 <= dist <= 0.45:
        return (234, 179, 8, 220) # gold

    # Needle calculation: angle
    angle = math.atan2(nx, -ny) # 0 is North (up)

    # Center target gold circle
    if dist < 0.12:
        if dist < 0.06:
            return (254, 240, 138, 255) # bright core
        return (234, 179, 8, 255)

    # North needle: pointing up (-ny > 0)
    if -ny > 0 and dist < 0.62:
        needle_width = 0.14 * (1.0 - dist / 0.62)
        if abs(nx) < needle_width:
            if nx >= 0:
                return (56, 189, 248, 255) # cyan
            else:
                return (2, 132, 199, 255) # dark cyan

    # South needle: pointing down (ny > 0)
    if ny > 0 and dist < 0.62:
        needle_width = 0.14 * (1.0 - dist / 0.62)
        if abs(nx) < needle_width:
            if nx >= 0:
                return (100, 116, 139, 255) # slate
            else:
                return (51, 65, 85, 255)

    # Cardinal ticks
    if (abs(nx) < 0.02 and 0.68 <= abs(ny) <= 0.82) or (abs(ny) < 0.02 and 0.68 <= abs(nx) <= 0.82):
        if ny < -0.68:
            return (56, 189, 248, 255) # North tick
        return (148, 163, 184, 255)

    return (bg_r, bg_g, bg_b, 255)

os.makedirs('public', exist_ok=True)
create_png(192, 192, lambda x, y, w, h: metal_icon_pixel(x, y, w, h, False), 'public/pwa-192x192.png')
create_png(512, 512, lambda x, y, w, h: metal_icon_pixel(x, y, w, h, False), 'public/pwa-512x512.png')
create_png(512, 512, lambda x, y, w, h: metal_icon_pixel(x, y, w, h, True), 'public/pwa-maskable-512x512.png')
create_png(180, 180, lambda x, y, w, h: metal_icon_pixel(x, y, w, h, False), 'public/apple-touch-icon.png')
create_png(48, 48, lambda x, y, w, h: metal_icon_pixel(x, y, w, h, False), 'public/favicon.ico')
print("All PWA icons generated successfully!")
