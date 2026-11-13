#!/usr/bin/env python3
"""Bakes LPC Revised (Eliza Wyatt, github.com/ElizaWy/LPC; CC-BY 3.0 / OGA-BY 3.0) into the mobile game's assets.

  LPCR=/path/to/ElizaWy_LPC python3 -I mobile/tools/bake.py [--catalog out.png]

Outputs into mobile/www/assets/: chars/<name>_{walk,idle}.png, world.png + world.json, portraits/*.png
Characters are composited layer by layer (body, shoes, legs, torso, head, hair...). Dogs and chickens are drawn here
because LPC has none. Sheets: rows are up, left, down, right; walk has 8 frames, idle has 3 (children idle has 1).
"""
import json, os, sys
from PIL import Image, ImageDraw

LPC = os.environ.get('LPCR', '/home/claude/dl/ElizaWy_LPC')
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'www', 'assets')
ART = os.path.join(HERE, '..', '..', 'Sprites and art', 'Pixel art sprites')
os.makedirs(OUT + '/chars', exist_ok=True); os.makedirs(OUT + '/portraits', exist_ok=True)

def ci(path):
    """case-insensitive path resolve"""
    parts = path.split('/'); cur = '/' if path.startswith('/') else ''
    for p in parts:
        if not p: continue
        base = cur or '.'
        try: names = os.listdir(base)
        except FileNotFoundError: return None
        hit = next((n for n in names if n.lower() == p.lower()), None)
        if hit is None: return None
        cur = os.path.join(cur, hit) if cur else hit
    return cur

def layer(rel, anim):
    p = ci(f'{LPC}/Characters/{rel}/{anim}.png')
    if not p:
        print('  missing layer', rel, anim); return None
    return Image.open(p).convert('RGBA')

def composite(layers, anim):
    base = None
    for rel in layers:
        im = layer(rel, anim)
        if im is None: continue
        base = im if base is None else Image.alpha_composite(base, im)
    return base

M = 'Clothing/Masculine, Thin'; F = 'Clothing/Feminine, Thin'
CHARS = {
    'dad': ['Body/Body 02 - Masculine, Thin/Peach', f'{M}/Feet/Shoes 01 - Shoes/Brown',
            f'{M}/Legs/Shorts 01 - Shorts/Tan', f'{M}/Torso/Shirt 04 - T-shirt/Navy',
            'Head/Head 02 - Masculine/Peach', 'Hair/Facial Hair 06 - Trimmed Beard/Brown',
            'Hair/Short 02 - Parted/Brown', 'Head Accessories/Eyewear 01 - Glasses/Iron'],
    'wife': ['Body/Body 01 - Feminine, Thin/Ivory', f'{F}/Feet/Shoes 01 - Shoes/Brown',
             f'{F}/Legs/Pants 02 - Leggings/Charcoal', f'{F}/Torso/Shirt 06 - Scoop T-shirt/Teal',
             'Head/Head 01 - Feminine/Ivory', 'Hair/Medium 07 - Bob, Side Part/Chestnut'],
    'jake': ['Body/Body 02 - Masculine, Thin/Tan', f'{M}/Feet/Shoes 02 - Boots/Black',
             f'{M}/Legs/Pants 03 - Pants/Navy', f'{M}/Torso/Shirt 01 - Longsleeve Shirt/Forest',
             'Head/Head 02 - Masculine/Tan', 'Hair/Short 05 - Natural/Black', 'Hair/Facial Hair 07 - Medium Beard/Black'],
    'baby': ['Children/Body/Peach', 'Children/Head/Head 01 - Default/Peach'],
}

def sheet_for(name, anim):
    im = composite(CHARS[name], anim)
    if name == 'baby' and im is not None:
        # LPC children come unclothed; tint everything below the neck line into an orange onesie
        px = im.load()
        for y in range(im.height):
            fy = y % 64
            for x in range(im.width):
                r, g, b, a = px[x, y]
                if a and fy >= 36:
                    px[x, y] = (min(255, int(r * 0.55 + 140)), min(255, int(g * 0.45 + 70)), int(b * 0.3 + 10), a)
    return im

for n in CHARS:
    for anim in ('Walk', 'Idle'):
        s = sheet_for(n, anim)
        if s is None and n == 'baby': s = sheet_for(n, 'idle')
        if s is not None: s.save(f'{OUT}/chars/{n}_{anim.lower()}.png')

# ---------- procedural animals (LPC has none) ----------
def dog(body, shade, muzzle, ear):
    W, H = 32, 24; frames = []
    for f in range(3):  # 0,1 walk, 2 idle
        im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
        out = (28, 20, 24, 255)
        d.rectangle((6, 8, 22, 16), fill=body, outline=out)           # torso
        d.rectangle((7, 14, 21, 16), fill=shade)
        d.rectangle((20, 4, 28, 12), fill=body, outline=out)          # head
        d.rectangle((26, 8, 30, 12), fill=muzzle, outline=out)        # snout
        d.rectangle((20, 2, 22, 6), fill=ear, outline=out)            # ear
        d.point((26, 7), fill=out)
        sw = [(0, 2), (2, 0), (1, 1)][f]
        for lx, off in ((8, sw[0]), (11, sw[1]), (17, sw[0]), (20, sw[1])):
            d.rectangle((lx, 16, lx + 2, 21 + (off - 1)), fill=body, outline=out)
        tail = [(3, 4, 6, 9), (3, 6, 6, 9), (4, 5, 6, 9)][f]
        d.line((6, 9, 2, [5, 7, 6][f]), fill=out, width=2)
        frames.append(im)
    sheet = Image.new('RGBA', (W * 3, H), (0, 0, 0, 0))
    for i, fr in enumerate(frames): sheet.alpha_composite(fr, (i * W, 0))
    return sheet

dog((196, 134, 66, 255), (150, 98, 44, 255), (240, 214, 170, 255), (120, 78, 36, 255)).save(f'{OUT}/chars/momo.png')
dog((40, 40, 52, 255), (26, 26, 34, 255), (70, 66, 80, 255), (22, 22, 30, 255)).save(f'{OUT}/chars/piper.png')

def chicken():
    W, H = 16, 16; sheet = Image.new('RGBA', (W * 3, H), (0, 0, 0, 0))
    for f in range(3):
        im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im); o = (40, 28, 24, 255)
        peck = f == 2
        d.ellipse((3, 5, 12, 13), fill=(246, 242, 232, 255), outline=o)
        hx, hy = (11, 6 if peck else 3)
        d.rectangle((hx - 1, hy, hx + 2, hy + 3), fill=(246, 242, 232, 255), outline=o)
        d.point((hx - 1, hy - 1), fill=(210, 50, 50, 255)); d.point((hx, hy - 1), fill=(210, 50, 50, 255))
        d.point((hx + 3, hy + 1), fill=(240, 170, 40, 255)); d.point((hx + 1, hy + 1), fill=o)
        d.line((6, 13, 6, 15 - (f == 1)), fill=(240, 170, 40, 255)); d.line((9, 13, 9, 15 - (f == 0)), fill=(240, 170, 40, 255))
        sheet.alpha_composite(im, (f * W, 0))
    return sheet
chicken().save(f'{OUT}/chars/chicken.png')

# ---------- world atlas ----------
def crop(path, rect):
    p = ci(f'{LPC}/{path}')
    if not p: print('  missing', path); return None
    x, y, w, h = rect; im = Image.open(p).convert('RGBA').crop((x, y, x + w, y + h)); bb = im.getbbox(); return im.crop(bb) if bb else im

def toilet():
    im = Image.new('RGBA', (22, 30), (0, 0, 0, 0)); d = ImageDraw.Draw(im); o = (50, 60, 70, 255)
    d.rectangle((3, 1, 18, 10), fill=(232, 236, 240, 255), outline=o)       # cistern
    d.ellipse((2, 9, 19, 28), fill=(246, 248, 250, 255), outline=o)         # bowl
    d.ellipse((6, 13, 15, 24), fill=(150, 190, 210, 255), outline=o)
    return im

def mower():
    im = Image.new('RGBA', (28, 22), (0, 0, 0, 0)); d = ImageDraw.Draw(im); o = (30, 30, 30, 255)
    d.rectangle((2, 6, 20, 16), fill=(200, 50, 40, 255), outline=o); d.rectangle((18, 0, 21, 8), fill=(90, 90, 90, 255), outline=o)
    d.rectangle((16, 0, 26, 2), fill=(60, 60, 60, 255)); d.ellipse((2, 15, 8, 21), fill=(40, 40, 40, 255)); d.ellipse((14, 15, 20, 21), fill=(40, 40, 40, 255))
    return im

def bowl(c):
    im = Image.new('RGBA', (16, 10), (0, 0, 0, 0)); d = ImageDraw.Draw(im); o = (40, 40, 50, 255)
    d.ellipse((0, 2, 15, 9), fill=c, outline=o); d.ellipse((3, 3, 12, 6), fill=(90, 60, 40, 255)); return im

def toy(c):
    im = Image.new('RGBA', (14, 14), (0, 0, 0, 0)); d = ImageDraw.Draw(im); o = (40, 30, 30, 255)
    d.rectangle((2, 4, 11, 12), fill=c, outline=o); d.rectangle((4, 1, 9, 4), fill=(250, 240, 200, 255), outline=o); return im

def poop():
    im = Image.new('RGBA', (12, 10), (0, 0, 0, 0)); d = ImageDraw.Draw(im); o = (40, 24, 10, 255)
    d.ellipse((1, 5, 10, 9), fill=(110, 70, 30, 255), outline=o); d.ellipse((3, 2, 8, 6), fill=(130, 84, 36, 255), outline=o); return im

def dishes():
    im = Image.new('RGBA', (20, 14), (0, 0, 0, 0)); d = ImageDraw.Draw(im); o = (50, 60, 70, 255)
    for i in range(3): d.ellipse((1 + i, 6 - i * 2, 17 - i, 12 - i * 2), fill=(240, 244, 248, 255), outline=o)
    return im

PICKS = {
    # name: (file or PIL image, rect)
    'fridge': ('Objects/Furniture/Fridge.png', (0, 0, 32, 64)),
    'sink': ('Objects/Furniture/Sink, Countertop.png', (0, 0, 32, 32)),
    'oven': ('Objects/Furniture/Oven, Modern.png', (0, 7, 32, 45)),
    'tv': ('Objects/Furniture/TV, Widescreen.png', (12, 0, 104, 64)),
    'sofa': ('Objects/Furniture/Seating/Sofa, Casual A.png', (0, 0, 94, 64)),
    'sofa_back': ('Objects/Furniture/Seating/Sofa, Casual A.png', (0, 64, 94, 34)),
    'armchair': ('Objects/Furniture/Seating/Chair, Sofa A.png', (0, 128, 32, 32)),
    'ottoman': ('Objects/Furniture/Seating/Ottoman, Medium A.png', (0, 0, 32, 32)),
    'coffee_table': ('Objects/Furniture/Table, Ornate Wood.png', (0, 0, 40, 34)),
    'bed_blue': ('Objects/Furniture/Beds/Beds, Single  A.png', (327, 16, 50, 59)),
    'bed_green': ('Objects/Furniture/Beds/Beds, Single  A.png', (711, 16, 50, 59)),
    'bed_brown': ('Objects/Furniture/Beds/Beds, Single  A.png', (455, 16, 50, 59)),
    'desk': ('Objects/Furniture/Desk, Office.png', (1, 78, 62, 39)),
    'office_chair': ('Objects/Furniture/Seating/Chair, Office.png', (2, 1, 28, 33)),
    'dresser': ('Objects/Furniture/Dresser.png', (31, 4, 66, 44)),
    'chest': ('Objects/Furniture/Chest.png', (0, 0, 32, 33)),
    'lamp': ('Objects/Furniture/Lighting, Floor.png', (2, 0, 28, 53)),
    'rug': ('Objects/Furniture/Rugs/Rainbow Rug.png', (0, 0, 96, 65)),
    'vanity': ('Objects/Furniture/Sink, Pedestal.png', (0, 0, 32, 48)),
    # tiles 32x32
    't_wood1': ('Structure/Floor/Wood Floor A.png', (32, 32, 32, 32)),
    't_wood2': ('Structure/Floor/Wood Floor A.png', (96, 32, 32, 32)),
    't_wood3': ('Structure/Floor/Wood Floor A.png', (64, 128, 32, 32)),
    't_tile1': ('Structure/Floor/Tile A.png', (32, 32, 32, 32)),
    't_tile2': ('Structure/Floor/Tile A.png', (32, 64, 32, 32)),
    't_grass': ('Terrain/terrain_summer.png', (128, 64, 32, 32)),
    't_path': ('Terrain/terrain_summer.png', (128, 112, 32, 32)),
    't_wall': ('Structure/Walls/Painted Walls.png', (8, 24, 32, 32)),
    't_wall2': ('Structure/Walls/Painted Walls.png', (104, 24, 32, 32)),
    't_wall3': ('Structure/Walls/Painted Walls.png', (200, 24, 32, 32)),
}
GEN = {'toilet': toilet(), 'mower': mower(), 'bowl_a': bowl((120, 170, 220, 255)), 'bowl_b': bowl((220, 120, 120, 255)),
       'toy_a': toy((230, 80, 80, 255)), 'toy_b': toy((80, 150, 230, 255)), 'toy_c': toy((240, 200, 60, 255)), 'poop': poop(), 'dishes': dishes()}

sprites = {}
for k, (f, r) in PICKS.items():
    im = crop(f, r)
    if im is not None: sprites[k] = im
sprites.update(GEN)

# shelf-pack
W = 512; x = y = 1; rowh = 0; atlas = {}; items = sorted(sprites.items(), key=lambda kv: -kv[1].height)
sheet = Image.new('RGBA', (W, 640), (0, 0, 0, 0))
for k, im in items:
    if x + im.width + 1 > W: x = 1; y += rowh + 1; rowh = 0
    sheet.alpha_composite(im, (x, y)); atlas[k] = [x, y, im.width, im.height]
    x += im.width + 1; rowh = max(rowh, im.height)
sheet = sheet.crop((0, 0, W, y + rowh + 1)); sheet.save(f'{OUT}/world.png')
json.dump(atlas, open(f'{OUT}/world.json', 'w'), separators=(',', ':'))

# portraits (the user's own pixel-art cards), reduced for the APK
for src, dst in (('DAD', 'dad'), ('wife', 'wife'), ('jake2', 'jake'), ('baby', 'baby'), ('momo', 'momo'), ('Piper', 'piper')):
    p = f'{ART}/{src}.png'
    if os.path.exists(p): Image.open(p).convert('RGBA').resize((128, 128), Image.LANCZOS).save(f'{OUT}/portraits/{dst}.png')

if '--catalog' in sys.argv:
    out = sys.argv[sys.argv.index('--catalog') + 1]
    cat = Image.new('RGBA', (1100, 900), (70, 70, 70, 255)); d = ImageDraw.Draw(cat); cx = cy = 6; rh = 0
    for k, im in sprites.items():
        s = 2; t = im.resize((im.width * s, im.height * s), Image.NEAREST)
        if cx + t.width + 6 > 1100: cx = 6; cy += rh + 16; rh = 0
        cat.alpha_composite(t, (cx, cy + 10)); d.text((cx, cy), k, fill=(255, 255, 0, 255)); cx += max(t.width, 60) + 8; rh = max(rh, t.height + 10)
    for i, n in enumerate(CHARS):
        w = Image.open(f'{OUT}/chars/{n}_walk.png'); cat.alpha_composite(w.crop((0, 128, 128, 192)).resize((128, 128), Image.NEAREST), (6 + i * 140, cy + rh + 30))
        d.text((6 + i * 140, cy + rh + 20), n, fill=(0, 255, 255, 255))
    cat.crop((0, 0, 1100, cy + rh + 170)).save(out)
print('baked', len(sprites), 'sprites')
