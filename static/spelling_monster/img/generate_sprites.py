"""
Generates the UI sprite sheet plus larger monster sprite PNGs.
Run once: python3 generate_sprites.py
"""

from pathlib import Path
from PIL import Image

UPSCALE = 8
OUT_DIR = Path(__file__).parent

# PICO-8 palette (index -> RGBA)
P = [
    (0,   0,   0,   255),  # 0  black
    (29,  43,  83,  255),  # 1  dark-blue
    (126, 37,  83,  255),  # 2  dark-purple
    (0,   135, 81,  255),  # 3  dark-green
    (171, 82,  54,  255),  # 4  brown
    (95,  87,  79,  255),  # 5  dark-grey
    (194, 195, 199, 255),  # 6  light-grey
    (255, 241, 232, 255),  # 7  white
    (255, 0,   77,  255),  # 8  red
    (255, 163, 0,   255),  # 9  orange
    (255, 236, 39,  255),  # 10 yellow
    (0,   228, 54,  255),  # 11 green
    (41,  173, 255, 255),  # 12 light-blue
    (131, 118, 156, 255),  # 13 lavender
    (255, 119, 168, 255),  # 14 pink
    (255, 204, 170, 255),  # 15 peach
]
TRANSPARENT = (0, 0, 0, 0)

KNIGHT_SPRITE = [
    [-1,-1, 6, 6, 6,-1,-1,-1],
    [-1, 6, 7, 7, 7, 6,-1,-1],
    [-1, 6, 7,12, 7, 6,-1,-1],
    [-1, 6, 6, 6, 6, 6,-1,-1],
    [-1,-1, 1, 6, 1,-1,-1,-1],
    [-1, 6, 1, 6, 1, 6,-1,-1],
    [-1, 6, 1, 6, 1, 6,-1,-1],
    [ 6, 6, 1, 6, 1, 6, 6,-1],
    [ 6, 6, 6, 6, 6, 6, 6,-1],
    [-1, 6, 6,-1, 6, 6,-1,-1],
    [-1, 6, 6,-1, 6, 6,-1,-1],
    [-1, 6,-1,-1,-1, 6,-1,-1],
]

GOBLIN_SPRITE = [
    [-1, 3,-1,-1,-1,-1, 3,-1],
    [-1, 3, 3, 3, 3, 3, 3,-1],
    [ 3, 3,11, 3, 3,11, 3, 3],
    [ 3, 3, 3, 8, 8, 3, 3, 3],
    [-1, 3, 3, 3, 3, 3, 3,-1],
    [-1, 4, 3, 3, 3, 3, 4,-1],
    [-1, 4, 4, 3, 3, 4, 4,-1],
    [-1, 4, 4, 4, 4, 4, 4,-1],
    [-1, 3, 3, 4, 4, 3, 3,-1],
    [-1, 3,-1, 4, 4,-1, 3,-1],
    [ 4, 4,-1, 4, 4,-1, 4, 4],
    [ 4,-1,-1, 4, 4,-1,-1, 4],
]

SKELETON_SPRITE = [
    [-1,-1, 7, 7, 7, 7,-1,-1],
    [-1, 7, 5, 7, 7, 5, 7,-1],
    [-1, 7, 7, 7, 7, 7, 7,-1],
    [-1,-1, 7, 5, 5, 7,-1,-1],
    [-1, 7, 7, 7, 7, 7, 7,-1],
    [ 7,-1, 7,-1,-1, 7,-1, 7],
    [ 7,-1, 7, 7, 7, 7,-1, 7],
    [-1, 7,-1, 7, 7,-1, 7,-1],
    [-1, 7,-1, 7, 7,-1, 7,-1],
    [-1, 6,-1, 7, 7,-1, 6,-1],
    [ 6,-1,-1, 7, 7,-1,-1, 6],
    [ 6,-1,-1, 7, 7,-1,-1, 6],
]

BAT_SPRITE = [
    [ 2,-1,-1,-1,-1, 2, 2,-1,-1,-1,-1, 2],
    [ 2, 2,-1,-1, 2, 2, 2, 2,-1,-1, 2, 2],
    [ 2, 2, 2, 2, 2,14,14, 2, 2, 2, 2, 2],
    [-1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,-1],
    [-1,-1, 2,14, 2, 7, 7, 2,14, 2,-1,-1],
    [-1,-1,-1, 2, 2, 2, 2, 2, 2,-1,-1,-1],
    [-1, 2, 2,-1, 2, 2, 2, 2,-1, 2, 2,-1],
    [ 2, 2,-1,-1,-1, 2, 2,-1,-1,-1, 2, 2],
    [-1,-1,-1,-1, 2,-1,-1, 2,-1,-1,-1,-1],
]

SLIME_SPRITE = [
    [-1,-1,12,12,12,12,12,12,-1,-1],
    [-1,12,12,12,12,12,12,12,12,-1],
    [12,12, 7,12,12,12,12, 7,12,12],
    [12,12,12,12,12,12,12,12,12,12],
    [12,12,12, 8,12,12, 8,12,12,12],
    [12,12,12,12,12,12,12,12,12,12],
    [-1,12,12,12,12,12,12,12,12,-1],
    [-1,-1,12,12,-1,-1,12,12,-1,-1],
]

HEART_SPRITE = [
    [-1, 8, 8,-1, 8, 8,-1],
    [ 8, 8, 8, 8, 8, 8, 8],
    [ 8, 8, 8, 8, 8, 8, 8],
    [-1, 8, 8, 8, 8, 8,-1],
    [-1,-1, 8, 8, 8,-1,-1],
    [-1,-1,-1, 8,-1,-1,-1],
]

HEART_EMPTY_SPRITE = [
    [-1, 5, 5,-1, 5, 5,-1],
    [ 5,-1,-1, 5,-1,-1, 5],
    [ 5,-1,-1,-1,-1,-1, 5],
    [-1, 5,-1,-1,-1, 5,-1],
    [-1,-1, 5,-1, 5,-1,-1],
    [-1,-1,-1, 5,-1,-1,-1],
]

SWORD_SPRITE = [
    [-1,-1, 6],
    [-1, 6,-1],
    [ 6,-1,-1],
    [ 7,-1,-1],
    [ 9,-1,-1],
]

# Must match SPRITE_DEFS in sprites.js
SPRITES = [
    (KNIGHT_SPRITE,      0),
    (GOBLIN_SPRITE,      16),
    (SKELETON_SPRITE,    32),
    (BAT_SPRITE,         48),
    (SLIME_SPRITE,       64),
    (HEART_SPRITE,       80),
    (HEART_EMPTY_SPRITE, 96),
    (SWORD_SPRITE,       112),
]

LARGE_SPRITES = {
    'goblin': GOBLIN_SPRITE,
    'skeleton': SKELETON_SPRITE,
    'bat': BAT_SPRITE,
    'slime': SLIME_SPRITE,
}


def put_sprite(img, sprite, offset_x=0):
    for row_i, row in enumerate(sprite):
        for col_i, idx in enumerate(row):
            if idx == -1:
                continue
            img.putpixel((offset_x + col_i, row_i), P[idx])


def write_scaled_sprite(filename, sprite):
    width = len(sprite[0])
    height = len(sprite)
    base = Image.new('RGBA', (width, height), TRANSPARENT)
    put_sprite(base, sprite)
    scaled = base.resize((width * UPSCALE, height * UPSCALE), Image.Resampling.NEAREST)
    scaled.save(OUT_DIR / filename)


img = Image.new('RGBA', (128, 16), TRANSPARENT)

for sprite, cell_x in SPRITES:
    put_sprite(img, sprite, offset_x=cell_x)

img.save(OUT_DIR / 'sprites.png')
print('sprites.png written (128x16)')

for name, sprite in LARGE_SPRITES.items():
    write_scaled_sprite(f'{name}.png', sprite)
    print(f'{name}.png written ({len(sprite[0]) * UPSCALE}x{len(sprite) * UPSCALE})')
