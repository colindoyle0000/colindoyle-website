// PICO-8 palette
const P = [
  '#000000', // 0  black
  '#1d2b53', // 1  dark-blue
  '#7e2553', // 2  dark-purple
  '#008751', // 3  dark-green
  '#ab5236', // 4  brown
  '#5f574f', // 5  dark-grey
  '#c2c3c7', // 6  light-grey
  '#fff1e8', // 7  white
  '#ff004d', // 8  red
  '#ffa300', // 9  orange
  '#ffec27', // 10 yellow
  '#00e436', // 11 green
  '#29adff', // 12 light-blue
  '#83769c', // 13 lavender
  '#ff77a8', // 14 pink
  '#ffccaa', // 15 peach
];

// Each sprite: 2D array of palette indices, 0 = transparent (skip)
// Use -1 for transparent

const KNIGHT_SPRITE = [
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
];

// Knight sword (drawn separately, to the right)
const SWORD_SPRITE = [
  [-1,-1, 6],
  [-1, 6,-1],
  [ 6,-1,-1],
  [ 7,-1,-1],
  [ 9,-1,-1],
];

// Goblin (green monster)
const GOBLIN_SPRITE = [
  [-1,-1, 3, 3, 3,-1,-1],
  [-1, 3,11, 3,11, 3,-1],
  [-1, 3, 3, 3, 3, 3,-1],
  [ 3, 3, 8,-1, 8, 3, 3],
  [ 3, 3, 3, 7, 3, 3, 3],
  [-1, 3, 3, 3, 3, 3,-1],
  [-1, 3,-1,-1,-1, 3,-1],
  [-1, 4, 4,-1, 4, 4,-1],
];

// Skeleton (bone white)
const SKELETON_SPRITE = [
  [-1, 7, 7, 7, 7, 7,-1],
  [-1, 7, 5, 7, 5, 7,-1],
  [-1, 7, 7, 7, 7, 7,-1],
  [-1,-1, 7, 7, 7,-1,-1],
  [-1, 7, 7, 7, 7, 7,-1],
  [ 7,-1, 7,-1, 7,-1, 7],
  [ 7,-1, 7,-1, 7,-1, 7],
  [ 6,-1, 6,-1, 6,-1, 6],
];

// Bat (dark purple/blue)
const BAT_SPRITE = [
  [ 2,-1,-1, 2,-1,-1, 2],
  [ 2, 2,-1, 2,-1, 2, 2],
  [ 2, 2, 2, 2, 2, 2, 2],
  [-1, 2,14, 2,14, 2,-1],
  [-1,-1, 2, 2, 2,-1,-1],
  [-1,-1,-1, 2,-1,-1,-1],
  [-1,-1, 2,-1, 2,-1,-1],
];

// Slime (blue-green)
const SLIME_SPRITE = [
  [-1,-1,12,12,12,-1,-1],
  [-1,12,12,12,12,12,-1],
  [12,12, 7,12, 7,12,12],
  [12,12,12,12,12,12,12],
  [12,12, 8,12, 8,12,12],
  [-1,12,12,12,12,12,-1],
  [-1,-1,12,12,12,-1,-1],
];

// Heart sprite (7x6)
const HEART_SPRITE = [
  [-1, 8, 8,-1, 8, 8,-1],
  [ 8, 8, 8, 8, 8, 8, 8],
  [ 8, 8, 8, 8, 8, 8, 8],
  [-1, 8, 8, 8, 8, 8,-1],
  [-1,-1, 8, 8, 8,-1,-1],
  [-1,-1,-1, 8,-1,-1,-1],
];

// Empty heart
const HEART_EMPTY_SPRITE = [
  [-1, 5, 5,-1, 5, 5,-1],
  [ 5,-1,-1, 5,-1,-1, 5],
  [ 5,-1,-1,-1,-1,-1, 5],
  [-1, 5,-1,-1,-1, 5,-1],
  [-1,-1, 5,-1, 5,-1,-1],
  [-1,-1,-1, 5,-1,-1,-1],
];

const MONSTER_SPRITES = [GOBLIN_SPRITE, SKELETON_SPRITE, BAT_SPRITE, SLIME_SPRITE];
const MONSTER_NAMES = ['Goblin', 'Skeleton', 'Bat', 'Slime'];

function drawPixelSprite(ctx, sprite, x, y, scale) {
  for (let row = 0; row < sprite.length; row++) {
    for (let col = 0; col < sprite[row].length; col++) {
      const idx = sprite[row][col];
      if (idx === -1) continue;
      ctx.fillStyle = P[idx];
      ctx.fillRect(
        Math.round(x + col * scale),
        Math.round(y + row * scale),
        scale, scale
      );
    }
  }
}

function drawKnight(ctx, x, y, scale) {
  drawPixelSprite(ctx, KNIGHT_SPRITE, x, y, scale);
  drawPixelSprite(ctx, SWORD_SPRITE, x + 8 * scale, y + 2 * scale, scale);
}

function drawMonster(ctx, type, x, y, scale) {
  drawPixelSprite(ctx, MONSTER_SPRITES[type % 4], x, y, scale);
}

function drawHeart(ctx, x, y, scale, filled) {
  drawPixelSprite(ctx, filled ? HEART_SPRITE : HEART_EMPTY_SPRITE, x, y, scale);
}

function getMonsterHeight(type) {
  return MONSTER_SPRITES[type % 4].length;
}

function getMonsterWidth(type) {
  return MONSTER_SPRITES[type % 4][0].length;
}
