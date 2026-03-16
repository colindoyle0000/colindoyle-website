// Sprite sheet: img/sprites.png
//
// Layout: 7 sprites in a horizontal strip, each occupying a 16px-wide cell.
// Sprites are drawn top-left within their cell.
// Sheet dimensions: 112 × 16 px
//
//  Cell x=0   knight      8 × 12 px
//  Cell x=16  goblin      7 × 8  px
//  Cell x=32  skeleton    7 × 8  px
//  Cell x=48  bat         7 × 7  px
//  Cell x=64  slime       7 × 7  px
//  Cell x=80  heart       7 × 6  px
//  Cell x=96  heart_empty 7 × 6  px

const SPRITE_DEFS = {
  knight:      { x:  0, y: 0, w: 8, h: 12 },
  goblin:      { x: 16, y: 0, w: 7, h: 8  },
  skeleton:    { x: 32, y: 0, w: 7, h: 8  },
  bat:         { x: 48, y: 0, w: 7, h: 7  },
  slime:       { x: 64, y: 0, w: 7, h: 7  },
  heart:       { x: 80, y: 0, w: 7, h: 6  },
  heart_empty: { x: 96, y: 0, w: 7, h: 6  },
};

const MONSTER_SPRITE_KEYS = ['goblin', 'skeleton', 'bat', 'slime'];
const MONSTER_NAMES = ['Goblin', 'Skeleton', 'Bat', 'Slime'];

let spriteSheet = null;

function loadSpriteSheet(src, callback) {
  const img = new Image();
  img.onload = () => { spriteSheet = img; callback(); };
  img.src = src;
}

function drawSprite(ctx, key, x, y, scale) {
  if (!spriteSheet) return;
  const s = SPRITE_DEFS[key];
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(spriteSheet, s.x, s.y, s.w, s.h,
    Math.round(x), Math.round(y), s.w * scale, s.h * scale);
}

function drawKnight(ctx, x, y, scale) {
  drawSprite(ctx, 'knight', x, y, scale);
}

function drawMonster(ctx, type, x, y, scale) {
  drawSprite(ctx, MONSTER_SPRITE_KEYS[type % 4], x, y, scale);
}

function drawHeart(ctx, x, y, scale, filled) {
  drawSprite(ctx, filled ? 'heart' : 'heart_empty', x, y, scale);
}

function getMonsterHeight(type) {
  return SPRITE_DEFS[MONSTER_SPRITE_KEYS[type % 4]].h;
}

function getMonsterWidth(type) {
  return SPRITE_DEFS[MONSTER_SPRITE_KEYS[type % 4]].w;
}
