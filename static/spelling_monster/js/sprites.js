const SPRITE_DEFS = {
  knight:      { w: 8,  h: 12, src: 'img/knight.png' },
  goblin:      { w: 8,  h: 12, src: 'img/goblin.png' },
  skeleton:    { w: 8,  h: 12, src: 'img/skeleton.png' },
  bat:         { w: 12, h: 9,  src: 'img/bat.png' },
  slime:       { w: 10, h: 8,  src: 'img/slime.png' },
  heart:       { x: 80,  y: 0, w: 7, h: 6 },
  heart_empty: { x: 96,  y: 0, w: 7, h: 6 },
  sword:       { w: 5,  h: 7,  src: 'img/sword.png', cropX: 28, cropY: 28, cropW: 17, cropH: 22 },
};

const MONSTER_SPRITE_KEYS = ['goblin', 'skeleton', 'bat', 'slime'];
const MONSTER_NAMES = ['Goblin', 'Skeleton', 'Bat', 'Slime'];

let spriteSheet = null;
const spriteImages = {};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function loadSprites(callback) {
  const imageSprites = Object.entries(SPRITE_DEFS)
    .filter(([, sprite]) => sprite.src)
    .map(([key, sprite]) =>
      loadImage(sprite.src).then(img => {
        spriteImages[key] = img;
      })
    );

  Promise.all([loadImage('img/sprites.png'), ...imageSprites])
    .then(([sheet]) => {
      spriteSheet = sheet;
      callback();
    })
    .catch(err => {
      console.error('Failed to load sprite assets', err);
    });
}

function drawSprite(ctx, key, x, y, scale) {
  const sprite = SPRITE_DEFS[key];
  if (!sprite) return;

  ctx.imageSmoothingEnabled = false;

  if (sprite.src && spriteImages[key]) {
    const sx = sprite.cropX ?? 0;
    const sy = sprite.cropY ?? 0;
    const sw = sprite.cropW ?? spriteImages[key].width;
    const sh = sprite.cropH ?? spriteImages[key].height;
    ctx.drawImage(
      spriteImages[key],
      sx,
      sy,
      sw,
      sh,
      Math.round(x),
      Math.round(y),
      sprite.w * scale,
      sprite.h * scale
    );
    return;
  }

  if (!spriteSheet) return;

  ctx.drawImage(
    spriteSheet,
    sprite.x, sprite.y, sprite.w, sprite.h,
    Math.round(x), Math.round(y), sprite.w * scale, sprite.h * scale
  );
}

function drawKnight(ctx, x, y, scale, opts = {}) {
  const swordAngle = opts.swordAngle || 0;
  const swordX = x + (opts.swordOffsetX ?? 6) * scale;
  const swordY = y + (opts.swordOffsetY ?? 1) * scale;
  const swordPivotX = scale;
  const swordPivotY = 6 * scale;

  drawSprite(ctx, 'knight', x, y, scale);

  ctx.save();
  ctx.translate(Math.round(swordX + swordPivotX), Math.round(swordY + swordPivotY));
  ctx.rotate(swordAngle);
  drawSprite(ctx, 'sword', -swordPivotX, -swordPivotY, scale);
  ctx.restore();
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
