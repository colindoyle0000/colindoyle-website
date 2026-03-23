// ─── State ───────────────────────────────────────────────────────────────────

const STATE = {
  TITLE:   'title',
  PREVIEW: 'preview',
  BATTLE:  'battle',
  BONUS:   'bonus',
  VICTORY: 'victory',
  DEFEAT:  'defeat',
};

const ITEMS = [
  { id: 'health', label: '+ Health Boost', icon: '♥', desc: 'Restore 2 hearts' },
  { id: 'peek',   label: '+ Extra Peek',   icon: '👁', desc: 'See the word for 3s' },
  { id: 'wild',   label: '+ Wild Letters', icon: '⚡', desc: 'Auto-type 3 letters' },
];

let game = {};
let activeWords = WORDS.slice();

function initGame() {
  game = {
    state: STATE.TITLE,
    words: shuffleWords(activeWords),
    currentIndex: 0,
    knightHP: 5,
    maxKnightHP: 5,
    typedSoFar: '',
    monstersDefeated: 0,
    perfectScore: true,
    settings: { audio: true, peek: true },
    extraPeekActive: false,
    wildActive: false,
    wildRemaining: 0,
    peekVisible: false,
    peekTimeoutId: null,
    wildTimeoutId: null,
    bonusItems: [],
    pendingKeys: [],
    inventory: [],
  };
}

// ─── Canvas Setup ─────────────────────────────────────────────────────────────

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const W = canvas.width;   // 256
const H = canvas.height;  // 240

// Global sprite scale for battle scenes. At SCALE=8, knight (12px tall) = 96px = 40% of 240px height.
const SCALE = 8;
// Y coordinate of the ground line
const GROUND = H - 50;  // 190

function px(size) { return `${size}px "Press Start 2P", monospace`; }

// ─── Animation System ─────────────────────────────────────────────────────────

// anim = null when idle, or { type, startTime, duration, rafId, onComplete, ...extras }
let anim = null;

function startAnim(type, duration, extras, onComplete) {
  if (anim && anim.rafId) cancelAnimationFrame(anim.rafId);
  anim = { type, duration, startTime: performance.now(), onComplete: onComplete || null, ...extras };
  anim.rafId = requestAnimationFrame(animTick);
}

function animTick(ts) {
  if (!anim) return;
  const t = Math.min(1, (ts - anim.startTime) / anim.duration);

  // Fire hit sound at the exact moment of impact
  if (anim.type === 'attack' && !anim.hitSoundPlayed && t >= (anim.impactT || 0.55)) {
    anim.hitSoundPlayed = true;
    SFX.hit();
  }
  if (anim.type === 'fatality' && !anim.hitSoundPlayed && t >= 0.42) {
    anim.hitSoundPlayed = true;
    SFX.defeat();
  }

  ctx.clearRect(0, 0, W, H);
  drawBackground();

  switch (anim.type) {
    case 'attack':   drawAttackFrame(t);   break;
    case 'injury':   drawInjuryFrame(t);   break;
    case 'fatality': drawFatalityFrame(t); break;
  }

  if (t < 1) {
    anim.rafId = requestAnimationFrame(animTick);
  } else {
    const cb = anim.onComplete;
    anim = null;
    if (cb) cb();
    else render();
    drainPendingKeys();
  }
}

// Attack: knight strikes monster with type-specific movement
function drawAttackFrame(t) {
  const impactT = anim.impactT || 0.55;
  const { x: ox, y: oy } = getAttackOffsets(t, anim.attackType || 'lunge', impactT);
  renderBattleScene({ knightOffsetX: ox, knightOffsetY: oy });

  // Slash starburst visible in a window centred on impactT
  const before = 0.20, after = 0.32;
  if (t > impactT - before && t < impactT + after) {
    const slashAlpha = t < impactT
      ? (t - (impactT - before)) / before
      : 1 - (t - impactT) / after;
    const { monsterX, monsterY, mW, mH } = anim;
    drawSlash(monsterX - 2, monsterY + Math.round((mH * SCALE) / 2) - 5,
              Math.min(1, Math.max(0, slashAlpha)));

    // Letter floats up from the monster after impact
    if (anim.letter && t >= impactT) {
      const lt = (t - impactT) / after;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - lt);
      ctx.fillStyle = '#ffec27';
      ctx.font = px(8);
      ctx.textAlign = 'center';
      ctx.fillText(
        anim.letter.toUpperCase(),
        monsterX + Math.round((mW * SCALE) / 2),
        Math.round(monsterY - 6 - lt * 16)
      );
      ctx.restore();
    }
  }
}

// Injury: screen shakes + red flash overlay
function drawInjuryFrame(t) {
  const shake = Math.round(Math.sin(t * Math.PI * 7) * 5 * (1 - t));
  ctx.save();
  ctx.translate(shake, Math.round(shake * 0.25));
  renderBattleScene();
  ctx.restore();
  ctx.fillStyle = `rgba(220, 0, 0, ${0.45 * (1 - t)})`;
  ctx.fillRect(0, 0, W, H);
}

// Fatality: knight charges a blue energy beam that obliterates the monster
function drawFatalityFrame(t) {
  const CHARGE_T = 0.18;
  const IMPACT_T = 0.42;
  const FADE_T   = 0.68;

  const hideMonster = t >= IMPACT_T;
  renderBattleScene({ hideMonster });

  const knightX  = 18;
  const knightY  = GROUND - SPRITE_DEFS.knight.h * SCALE;
  const beamX    = knightX + 9 * SCALE;
  const beamY    = knightY + Math.round(SPRITE_DEFS.knight.h * SCALE * 0.50);

  // ── Charge glow (expanding blue squares around sword tip) ──────────────
  if (t < CHARGE_T + 0.05) {
    const p = Math.min(1, t / CHARGE_T);
    ctx.save();
    for (let ring = 0; ring < 5; ring++) {
      const phase = (p * 1.5 + ring * 0.2) % 1;
      ctx.globalAlpha = (1 - phase) * 0.55 * p;
      ctx.fillStyle = '#29adff';
      const half = Math.round(phase * 20);
      ctx.fillRect(beamX - half, beamY - half, half * 2, half * 2);
    }
    ctx.restore();
  }

  // ── Beam ───────────────────────────────────────────────────────────────
  if (t >= CHARGE_T) {
    const extendP = t < IMPACT_T ? (t - CHARGE_T) / (IMPACT_T - CHARGE_T) : 1;
    const fadeP   = t < FADE_T   ? 1 : 1 - (t - FADE_T) / (1 - FADE_T);
    const beamEndX = Math.round(beamX + (W - beamX + 32) * extendP);
    const pulse    = 1 + Math.sin(t * 55) * 0.08;
    const bw       = beamEndX - beamX;

    ctx.save();
    ctx.globalAlpha = 0.28 * fadeP;
    ctx.fillStyle = '#1d2b53';
    ctx.fillRect(beamX, Math.round(beamY - 48 * pulse), bw, Math.round(96 * pulse));

    ctx.globalAlpha = 0.60 * fadeP;
    ctx.fillStyle = '#29adff';
    ctx.fillRect(beamX, Math.round(beamY - 26 * pulse), bw, Math.round(52 * pulse));

    ctx.globalAlpha = 0.85 * fadeP;
    ctx.fillStyle = '#c2c3c7';
    ctx.fillRect(beamX, Math.round(beamY - 13 * pulse), bw, Math.round(26 * pulse));

    ctx.globalAlpha = fadeP;
    ctx.fillStyle = '#fff1e8';
    ctx.fillRect(beamX, beamY - 5, bw, 10);
    ctx.restore();
  }

  // ── Screen flash on impact ─────────────────────────────────────────────
  if (t >= IMPACT_T && t < IMPACT_T + 0.12) {
    const flashP = 1 - (t - IMPACT_T) / 0.12;
    ctx.save();
    ctx.globalAlpha = flashP * 0.80;
    ctx.fillStyle = '#29adff';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // ── Particles ──────────────────────────────────────────────────────────
  if (t >= IMPACT_T) {
    const dt    = ((t - IMPACT_T) * anim.duration) / 1000;
    const fadeP = Math.max(0, 1 - (t - IMPACT_T) / (1 - IMPACT_T) * 1.15);
    ctx.save();
    ctx.globalAlpha = fadeP;
    anim.particles.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.fillRect(
        Math.round(p.x + p.vx * dt),
        Math.round(p.y + p.vy * dt + 60 * dt * dt),
        p.size, p.size
      );
    });
    ctx.restore();
  }
}

// Sword slash starburst at a given canvas position
function drawSlash(x, y, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#ffec27';
  ctx.fillRect(x - 9, y - 2, 18, 4);   // horizontal bar
  ctx.fillRect(x - 2, y - 9, 4, 18);   // vertical bar
  ctx.fillStyle = '#fff1e8';
  ctx.fillRect(x - 6, y - 6, 3, 3);    // diagonal TL
  ctx.fillRect(x + 3, y - 6, 3, 3);    // diagonal TR
  ctx.fillRect(x - 6, y + 3, 3, 3);    // diagonal BL
  ctx.fillRect(x + 3, y + 3, 3, 3);    // diagonal BR
  ctx.restore();
}

function generateParticles(cx, cy) {
  const colors = ['#29adff','#29adff','#fff1e8','#1d2b53','#83769c','#c2c3c7','#fff1e8'];
  return Array.from({ length: 36 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 55 + Math.random() * 100;
    return {
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 20,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 3 + Math.floor(Math.random() * 6),
    };
  });
}

// ─── Attack Type System ───────────────────────────────────────────────────────

function getAttackConfig() {
  const r = Math.random();
  if (r < 0.40) {
    return { type: 'lunge', duration: 300 + Math.floor(Math.random() * 80), impactT: 0.54 + Math.random() * 0.06 };
  } else if (r < 0.75) {
    return { type: 'jump',  duration: 450 + Math.floor(Math.random() * 100), impactT: 0.58 + Math.random() * 0.10 };
  } else {
    return { type: 'dash',  duration: 200 + Math.floor(Math.random() * 55),  impactT: 0.24 + Math.random() * 0.07 };
  }
}

// Returns { x, y } pixel offsets for the knight sprite given attack type + progress t
function getAttackOffsets(t, type, impactT) {
  switch (type) {
    case 'lunge': {
      const x = t < 0.18
        ? -8 * (t / 0.18)
        : -8 + 80 * Math.sin(((t - 0.18) / 0.82) * Math.PI);
      return { x: Math.round(x), y: 0 };
    }
    case 'jump': {
      let x, y;
      if (t <= impactT) {
        const p = t / impactT;
        x = p * 72;
        y = -Math.sin(p * Math.PI) * 52;
      } else {
        const p = (t - impactT) / (1 - impactT);
        x = (1 - p) * 72;
        y = 0;
      }
      return { x: Math.round(x), y: Math.round(y) };
    }
    case 'dash': {
      const x = t < impactT
        ? (t / impactT) * 88
        : (1 - (t - impactT) / (1 - impactT)) * 88;
      return { x: Math.round(x), y: 0 };
    }
    default:
      return { x: Math.round(Math.sin(t * Math.PI) * 28), y: 0 };
  }
}

// ─── Render ───────────────────────────────────────────────────────────────────

function render() {
  ctx.clearRect(0, 0, W, H);
  drawBackground();

  switch (game.state) {
    case STATE.TITLE:   renderTitle();   break;
    case STATE.PREVIEW: renderPreview(); break;
    case STATE.BATTLE:  renderBattleScene(); break;
    case STATE.BONUS:   renderBonus();   break;
    case STATE.VICTORY: renderVictory(); break;
    case STATE.DEFEAT:  renderDefeat();  break;
  }
}

function drawBackground() {
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#0f3460';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 16) {
    for (let y = 0; y < H; y += 8) {
      const offset = (Math.floor(y / 8) % 2) * 8;
      ctx.strokeRect(x + offset, y, 16, 8);
    }
  }
  ctx.fillStyle = '#5f574f';
  ctx.fillRect(0, GROUND, W, 2);
}

// ─── Title Screen ─────────────────────────────────────────────────────────────

function renderTitle() {
  ctx.fillStyle = '#ffec27';
  ctx.font = px(12);
  ctx.textAlign = 'center';
  ctx.fillText('SPELLING', W / 2, 38);
  ctx.fillStyle = '#ff004d';
  ctx.fillText('MONSTER', W / 2, 56);

  drawKnight(ctx, 16, H / 2 - 24, 5);
  drawMonster(ctx, 0, W - 16 - getMonsterWidth(0) * 5, H / 2 - 20, 5);

  ctx.fillStyle = '#c2c3c7';
  ctx.font = px(6);
  ctx.textAlign = 'left';
  ctx.fillText('SETTINGS:', 22, 148);
  drawToggle(22, 158, 'Audio Preview', game.settings.audio, 'A');
  drawToggle(22, 176, 'Sneak Peek',    game.settings.peek,  'S');

  drawButton(22,  202, 100, 22, 'PLAY GAME',  '#00e436', '#000000');
  drawButton(134, 202, 110, 22, 'EDIT WORDS', '#29adff', '#000000');

  ctx.fillStyle = '#83769c';
  ctx.font = px(5);
  ctx.textAlign = 'center';
  ctx.fillText('ENTER or click PLAY to start', W / 2, H - 8);
}

function drawToggle(x, y, label, active, key) {
  ctx.fillStyle = active ? '#00e436' : '#5f574f';
  ctx.fillRect(x, y, 22, 12);
  ctx.fillStyle = '#000';
  ctx.font = px(5);
  ctx.textAlign = 'left';
  ctx.fillText(active ? 'ON' : 'OFF', x + 2, y + 9);
  ctx.fillStyle = '#c2c3c7';
  ctx.fillText(label, x + 28, y + 9);
  ctx.fillStyle = '#83769c';
  ctx.fillText('[' + key + ']', x + 148, y + 9);
}

function drawButton(x, y, w, h, label, bg, fg) {
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fg;
  ctx.font = px(6);
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + 3);
}

// ─── Preview Screen ───────────────────────────────────────────────────────────

function renderPreview() {
  const word = game.words[game.currentIndex];
  const monsterType = game.currentIndex % 4;

  ctx.fillStyle = '#ffec27';
  ctx.font = px(7);
  ctx.textAlign = 'center';
  ctx.fillText('A new monster appears!', W / 2, 28);

  drawMonster(ctx, monsterType, W / 2 - Math.round(getMonsterWidth(monsterType) * 9 / 2), 44, 9);

  if (game.peekVisible) {
    ctx.fillStyle = '#ffec27';
    ctx.font = px(10);
    ctx.fillText(word.toUpperCase(), W / 2, 162);
    ctx.fillStyle = '#c2c3c7';
    ctx.font = px(6);
    ctx.fillText('Remember this word!', W / 2, 178);
  } else {
    ctx.fillStyle = '#c2c3c7';
    ctx.font = px(6);
    ctx.fillText('Get ready...', W / 2, 162);
  }
}

// ─── Battle Screen ────────────────────────────────────────────────────────────

// Shared by normal render, attack anim, injury anim, and fatality anim.
// opts.knightOffsetX — x shift for lunge animation (default 0)
// opts.hideMonster   — true during fatality explosion (default false)
function renderBattleScene({ knightOffsetX = 0, knightOffsetY = 0, hideMonster = false } = {}) {
  const word = game.words[game.currentIndex];
  const monsterType = game.currentIndex % 4;

  // Progress counter
  ctx.fillStyle = '#83769c';
  ctx.font = px(6);
  ctx.textAlign = 'left';
  ctx.fillText(`${game.currentIndex + 1}/${game.words.length}`, 10, 10);

  // Replay audio button — always visible during battle
  drawReplayButton();

  // Knight HP hearts
  for (let i = 0; i < game.maxKnightHP; i++) {
    drawHeart(ctx, 10 + i * 16, 14, 2, i < game.knightHP);
  }

  // Inventory slots
  drawInventory();

  // Knight (shifted right during lunge)
  const knightX = 18 + knightOffsetX;
  const knightY = GROUND - SPRITE_DEFS.knight.h * SCALE + knightOffsetY;
  drawKnight(ctx, knightX, knightY, SCALE);

  // Monster
  const mW = getMonsterWidth(monsterType);
  const mH = getMonsterHeight(monsterType);
  const monsterX = W - 18 - mW * SCALE;
  const monsterY = GROUND - mH * SCALE;

  if (!hideMonster) {
    drawMonster(ctx, monsterType, monsterX, monsterY, SCALE);
  }

  // Peek overlay
  if (game.peekVisible) {
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(W / 2 - 70, H / 2 - 16, 140, 26);
    ctx.fillStyle = '#ffec27';
    ctx.font = px(8);
    ctx.textAlign = 'center';
    ctx.fillText(word.toUpperCase(), W / 2, H / 2 + 5);
  }

  // Letter health bar
  drawLetterBar(word, game.typedSoFar);

  // Bottom hint
  ctx.textAlign = 'center';
  if (game.wildActive && game.wildRemaining > 0) {
    ctx.fillStyle = '#ffec27';
    ctx.font = px(6);
    ctx.fillText(`⚡ Wild: ${game.wildRemaining} left`, W / 2, H - 6);
  } else {
    ctx.fillStyle = '#c2c3c7';
    ctx.font = px(6);
    ctx.fillText('Type the next letter!', W / 2, H - 6);
  }
}

function drawReplayButton() {
  const bx = W - 84, by = 3, bw = 81, bh = 18;
  ctx.fillStyle = '#1d2b53';
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = '#29adff';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, bw, bh);
  ctx.fillStyle = '#29adff';
  ctx.font = px(6);
  ctx.textAlign = 'center';
  ctx.fillText('\u266a HEAR WORD', bx + bw / 2, by + bh / 2 + 3);
}

function drawLetterBar(word, typed) {
  const tileSize = 20;
  const gap = 3;
  const totalW = word.length * (tileSize + gap) - gap;
  const startX = Math.round((W - totalW) / 2);
  const y = H - 44;

  word.split('').forEach((letter, i) => {
    const x = startX + i * (tileSize + gap);
    const isTyped   = i < typed.length;
    const isCurrent = i === typed.length;

    if (isTyped) {
      ctx.fillStyle = '#008751';
      ctx.fillRect(x, y, tileSize, tileSize);
      ctx.fillStyle = '#00e436';
      ctx.fillRect(x + 1, y + 1, tileSize - 2, tileSize - 2);
      ctx.fillStyle = '#fff1e8';
      ctx.font = px(8);
      ctx.textAlign = 'center';
      ctx.fillText(letter.toUpperCase(), x + tileSize / 2, y + tileSize / 2 + 4);
    } else if (isCurrent) {
      ctx.fillStyle = '#ffa300';
      ctx.fillRect(x - 1, y - 1, tileSize + 2, tileSize + 2);
      ctx.fillStyle = '#1d2b53';
      ctx.fillRect(x, y, tileSize, tileSize);
      ctx.fillStyle = '#ffec27';
      ctx.font = px(8);
      ctx.textAlign = 'center';
      ctx.fillText('?', x + tileSize / 2, y + tileSize / 2 + 4);
    } else {
      ctx.fillStyle = '#5f574f';
      ctx.fillRect(x, y, tileSize, tileSize);
      ctx.fillStyle = '#3a3535';
      ctx.fillRect(x + 1, y + 1, tileSize - 2, tileSize - 2);
      ctx.fillStyle = '#83769c';
      ctx.font = px(8);
      ctx.textAlign = 'center';
      ctx.fillText('?', x + tileSize / 2, y + tileSize / 2 + 4);
    }
  });
}

function drawInventory() {
  const slotSize = 18;
  const gap = 3;
  const startX = 10;
  const startY = 26;

  for (let i = 0; i < 3; i++) {
    const x = startX + i * (slotSize + gap);
    const itemId = game.inventory[i];

    ctx.fillStyle = '#1d2b53';
    ctx.fillRect(x, startY, slotSize, slotSize);
    ctx.strokeStyle = itemId ? '#ffa300' : '#3a3535';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, startY, slotSize, slotSize);

    if (itemId) {
      const item = ITEMS.find(it => it.id === itemId);
      ctx.font = px(8);
      ctx.textAlign = 'center';
      ctx.fillText(item.icon, x + slotSize / 2, startY + slotSize / 2 + 4);
    }

    ctx.fillStyle = itemId ? '#ffa300' : '#5f574f';
    ctx.font = px(5);
    ctx.textAlign = 'center';
    ctx.fillText(`[${i + 1}]`, x + slotSize / 2, startY + slotSize + 6);
  }
}

// ─── Bonus Screen ─────────────────────────────────────────────────────────────

function renderBonus() {
  ctx.fillStyle = '#ffec27';
  ctx.font = px(8);
  ctx.textAlign = 'center';
  ctx.fillText('BONUS ITEM!', W / 2, 28);

  const inventoryFull = game.inventory.length >= 3;
  ctx.fillStyle = inventoryFull ? '#ff77a8' : '#c2c3c7';
  ctx.font = px(5);
  ctx.fillText(
    inventoryFull ? 'Inventory full - activates now!' : `Choose a reward (${game.inventory.length}/3 slots used):`,
    W / 2, 42
  );

  game.bonusItems.forEach((item, i) => drawItemCard(17 + i * 76, 54, 70, 104, item, i + 1));

  ctx.fillStyle = '#83769c';
  ctx.font = px(5);
  ctx.textAlign = 'center';
  ctx.fillText('Press 1, 2, or 3 to choose', W / 2, H - 8);
}

function drawItemCard(x, y, w, h, item, num) {
  ctx.fillStyle = '#1d2b53';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#29adff';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);

  ctx.fillStyle = '#ffec27';
  ctx.font = px(16);
  ctx.textAlign = 'center';
  ctx.fillText(item.icon, x + w / 2, y + 34);

  ctx.fillStyle = '#fff1e8';
  ctx.font = px(5);
  ctx.fillText(item.label, x + w / 2, y + 56);

  ctx.fillStyle = '#83769c';
  ctx.font = px(5);
  ctx.fillText(item.desc, x + w / 2, y + 70);

  ctx.fillStyle = '#ffa300';
  ctx.font = px(7);
  ctx.fillText(`[${num}]`, x + w / 2, y + 90);
}

// ─── Victory / Defeat Screens ────────────────────────────────────────────────

function renderVictory() {
  ctx.fillStyle = '#ffec27';
  ctx.font = px(14);
  ctx.textAlign = 'center';
  ctx.fillText('YOU WIN!', W / 2, 50);

  ctx.fillStyle = '#00e436';
  ctx.font = px(7);
  ctx.fillText('All monsters defeated!', W / 2, 72);

  if (game.perfectScore) {
    ctx.fillStyle = '#ffa300';
    ctx.font = px(8);
    ctx.fillText('PERFECT SCORE!', W / 2, 100);
    ctx.fillStyle = '#ff77a8';
    ctx.font = px(6);
    ctx.fillText('No hearts lost - Amazing!', W / 2, 116);
  }

  drawKnight(ctx, W / 2 - 20, 130, 4);
  drawButton(W / 2 - 55, 192, 110, 22, 'PLAY AGAIN', '#00e436', '#000');
}

function renderDefeat() {
  ctx.fillStyle = '#ff004d';
  ctx.font = px(14);
  ctx.textAlign = 'center';
  ctx.fillText('GAME OVER', W / 2, 65);

  ctx.fillStyle = '#c2c3c7';
  ctx.font = px(6);
  ctx.fillText('The knight has fallen!', W / 2, 88);

  ctx.fillStyle = '#83769c';
  ctx.font = px(6);
  ctx.fillText(`${game.monstersDefeated}/${game.words.length} monsters defeated`, W / 2, 104);

  drawButton(W / 2 - 55, 160, 110, 22, 'TRY AGAIN', '#ff004d', '#fff');
}

// ─── Input Handling ───────────────────────────────────────────────────────────

document.addEventListener('keydown', handleKey);

function handleKey(e) {
  const key = e.key;

  if (game.state === STATE.TITLE) {
    if (key === 'Enter' || key === ' ') { startGame(); return; }
    if (key === 'a' || key === 'A') { game.settings.audio = !game.settings.audio; render(); return; }
    if (key === 's' || key === 'S') { game.settings.peek  = !game.settings.peek;  render(); return; }
    return;
  }

  if (game.state === STATE.PREVIEW) return;

  if (game.state === STATE.BATTLE) {
    if (key === '1') { useInventoryItem(0); return; }
    if (key === '2') { useInventoryItem(1); return; }
    if (key === '3') { useInventoryItem(2); return; }
    if (game.wildActive && game.wildRemaining > 0) return;  // auto-typing
    if (/^[a-zA-Z]$/.test(key)) {
      if (anim !== null) {
        game.pendingKeys.push(key.toLowerCase());           // buffer for after anim
      } else {
        handleLetterInput(key.toLowerCase());
      }
    }
    return;
  }

  if (game.state === STATE.BONUS) {
    if (key === '1') applyBonus(0);
    if (key === '2') applyBonus(1);
    if (key === '3') applyBonus(2);
    return;
  }

  if (game.state === STATE.VICTORY || game.state === STATE.DEFEAT) {
    if (key === 'Enter' || key === ' ') { initGame(); render(); }
  }
}

function handleLetterInput(letter) {
  const word     = game.words[game.currentIndex];
  const expected = word[game.typedSoFar.length];

  if (letter === expected) {
    game.typedSoFar += letter;

    const monsterType = game.currentIndex % 4;
    const mW = getMonsterWidth(monsterType);
    const mH = getMonsterHeight(monsterType);
    const monsterX = W - 18 - mW * SCALE;
    const monsterY = GROUND - mH * SCALE;

    if (game.typedSoFar === word) {
      // FATALITY — explode the monster
      const cx = monsterX + Math.round((mW * SCALE) / 2);
      const cy = monsterY + Math.round((mH * SCALE) / 2);
      startAnim('fatality', 1400, {
        particles: generateParticles(cx, cy),
        hitSoundPlayed: false,
        cx, cy,
      }, () => wordComplete());
    } else {
      // ATTACK — random attack type
      const cfg = getAttackConfig();
      startAnim('attack', cfg.duration, {
        attackType: cfg.type,
        impactT: cfg.impactT,
        hitSoundPlayed: false,
        monsterX, monsterY, mW, mH,
        letter,
      });
    }
  } else {
    // INJURY — screen shake + red overlay
    game.knightHP--;
    game.perfectScore = false;
    SFX.miss();
    startAnim('injury', 500, {}, () => {
      if (game.knightHP <= 0) {
        game.state = STATE.DEFEAT;
        Music.stop();
        SFX.gameOver();
      }
      render();
    });
  }
}

function drainPendingKeys() {
  if (game.state !== STATE.BATTLE || anim !== null) return;
  if (game.wildActive && game.wildRemaining > 0) { game.pendingKeys = []; return; }
  if (game.pendingKeys.length > 0) {
    handleLetterInput(game.pendingKeys.shift());
  }
}

// ─── Game Flow ────────────────────────────────────────────────────────────────

function startGame() {
  game.state = STATE.PREVIEW;
  startPreview();
}

function startPreview() {
  game.peekVisible = false;
  game.typedSoFar  = '';
  game.pendingKeys = [];
  const word = game.words[game.currentIndex];
  SFX.appear();
  render();

  const doTransition = () => {
    setTimeout(() => {
      game.state = STATE.BATTLE;
      Music.playBattle();
      game.peekVisible = false;
      if (game.extraPeekActive) {
        game.extraPeekActive = false;
        showPeek(3000);
      }
      render();
      if (game.wildActive && game.wildRemaining > 0) {
        setTimeout(maybeAutoWild, 600);
      }
    }, 300);
  };

  if (game.settings.audio && game.settings.peek) {
    Audio.speakWord(word, () => {
      game.peekVisible = true;
      render();
      if (game.peekTimeoutId) clearTimeout(game.peekTimeoutId);
      game.peekTimeoutId = setTimeout(() => {
        game.peekVisible = false;
        doTransition();
      }, 2500);
    });
  } else if (game.settings.audio) {
    Audio.speakWord(word, doTransition);
  } else if (game.settings.peek) {
    game.peekVisible = true;
    render();
    if (game.peekTimeoutId) clearTimeout(game.peekTimeoutId);
    game.peekTimeoutId = setTimeout(() => {
      game.peekVisible = false;
      doTransition();
    }, 2500);
  } else {
    doTransition();
  }
}

function showPeek(duration) {
  game.peekVisible = true;
  render();
  if (game.peekTimeoutId) clearTimeout(game.peekTimeoutId);
  game.peekTimeoutId = setTimeout(() => { game.peekVisible = false; render(); }, duration);
}

function wordComplete() {
  game.monstersDefeated++;

  if (game.monstersDefeated % 3 === 0 && game.currentIndex + 1 < game.words.length) {
    game.currentIndex++;
    Music.playVictory();
    showBonusScreen();
    return;
  }

  game.currentIndex++;
  if (game.currentIndex >= game.words.length) {
    game.state = STATE.VICTORY;
    Music.stop();
    SFX.victory();
    render();
  } else {
    Music.playVictory();
    game.state = STATE.PREVIEW;
    startPreview();
  }
}

function showBonusScreen() {
  game.bonusItems = [...ITEMS].sort(() => Math.random() - 0.5).slice(0, 3);
  game.state = STATE.BONUS;
  SFX.bonus();
  render();
}

function applyBonus(idx) {
  const item = game.bonusItems[idx];
  if (!item) return;

  if (game.inventory.length < 3) {
    game.inventory.push(item.id);
  } else {
    activateItemNow(item.id);
  }

  if (game.currentIndex >= game.words.length) {
    game.state = STATE.VICTORY;
    Music.stop();
    render();
  } else {
    game.state = STATE.PREVIEW;
    startPreview();
  }
}

function activateItemNow(itemId) {
  if (itemId === 'health') {
    game.knightHP = Math.min(game.maxKnightHP, game.knightHP + 2);
  } else if (itemId === 'peek') {
    game.extraPeekActive = true;
  } else if (itemId === 'wild') {
    game.wildActive = true;
    game.wildRemaining = 3;
  }
}

function useInventoryItem(index) {
  if (game.state !== STATE.BATTLE) return;
  if (index >= game.inventory.length) return;
  if (game.wildActive && game.wildRemaining > 0) return;

  const itemId = game.inventory.splice(index, 1)[0];
  SFX.bonus();

  if (itemId === 'health') {
    game.knightHP = Math.min(game.maxKnightHP, game.knightHP + 2);
    render();
  } else if (itemId === 'peek') {
    showPeek(3000);
  } else if (itemId === 'wild') {
    game.wildActive = true;
    game.wildRemaining = 3;
    render();
    setTimeout(maybeAutoWild, 200);
  }
}

// Auto-type wild letters with attack animations between each
function maybeAutoWild() {
  if (!game.wildActive || game.wildRemaining <= 0) return;
  if (game.state !== STATE.BATTLE) return;

  const word = game.words[game.currentIndex];
  if (game.typedSoFar.length >= word.length) return;

  const letter = word[game.typedSoFar.length];
  game.typedSoFar += letter;
  game.wildRemaining--;

  const monsterType = game.currentIndex % 4;
  const mW = getMonsterWidth(monsterType);
  const mH = getMonsterHeight(monsterType);
  const monsterX = W - 18 - mW * SCALE;
  const monsterY = GROUND - mH * SCALE;

  if (game.typedSoFar === word) {
    const cx = monsterX + Math.round((mW * SCALE) / 2);
    const cy = monsterY + Math.round((mH * SCALE) / 2);
    startAnim('fatality', 1400, {
      particles: generateParticles(cx, cy),
      cx, cy,
    }, () => wordComplete());
    game.wildActive = false;
    return;
  }

  const cfg = getAttackConfig();
  startAnim('attack', cfg.duration, {
    attackType: cfg.type, impactT: cfg.impactT, hitSoundPlayed: false,
    monsterX, monsterY, mW, mH, letter,
  }, () => {
    render();
    if (game.wildRemaining > 0) {
      game.wildTimeoutId = setTimeout(maybeAutoWild, 200);
    } else {
      game.wildActive = false;
    }
  });
}

// ─── Click Handling ───────────────────────────────────────────────────────────

canvas.addEventListener('click', handleClick);

function handleClick(e) {
  const rect  = canvas.getBoundingClientRect();
  const scaleX = W / rect.width;
  const scaleY = H / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top)  * scaleY;

  if (game.state === STATE.TITLE) {
    if (x >= 22  && x <= 122 && y >= 202 && y <= 224) { startGame();      return; }
    if (x >= 134 && x <= 244 && y >= 202 && y <= 224) { openWordEditor(); return; }
    if (x >= 22  && x <= 44  && y >= 158 && y <= 170) { game.settings.audio = !game.settings.audio; render(); return; }
    if (x >= 22  && x <= 44  && y >= 176 && y <= 188) { game.settings.peek  = !game.settings.peek;  render(); return; }
  }

  if (game.state === STATE.BATTLE) {
    // Replay button: top right
    if (x >= W - 84 && x <= W - 3 && y >= 3 && y <= 21) {
      Audio.speakWord(game.words[game.currentIndex]);
      return;
    }
    // Inventory slots: top left below hearts
    const slotSize = 18, gap = 3, startX = 10, startY = 26;
    for (let i = 0; i < 3; i++) {
      const sx = startX + i * (slotSize + gap);
      if (x >= sx && x <= sx + slotSize && y >= startY && y <= startY + slotSize) {
        useInventoryItem(i);
        return;
      }
    }
  }

  if (game.state === STATE.BONUS) {
    [0, 1, 2].forEach(i => {
      const cx = 17 + i * 76;
      if (x >= cx && x <= cx + 70 && y >= 54 && y <= 158) applyBonus(i);
    });
  }

  if (game.state === STATE.VICTORY) {
    if (x >= W/2-55 && x <= W/2+55 && y >= 192 && y <= 214) { initGame(); render(); }
  }

  if (game.state === STATE.DEFEAT) {
    if (x >= W/2-55 && x <= W/2+55 && y >= 160 && y <= 182) { initGame(); render(); }
  }
}

// ─── Word Editor ──────────────────────────────────────────────────────────────

function getCurrentEditorWords() {
  return Array.from(document.querySelectorAll('#wordRows input'))
    .map(inp => inp.value.trim().toLowerCase())
    .filter(w => w.length > 0);
}

function buildWordRows() {
  const container = document.getElementById('wordRows');
  container.innerHTML = '';
  activeWords.forEach((word, i) => {
    const row = document.createElement('div');
    row.className = 'word-row';

    const num = document.createElement('span');
    num.textContent = `${i + 1}.`;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = word;
    input.maxLength = 20;

    const del = document.createElement('button');
    del.textContent = '×';
    del.addEventListener('click', () => {
      activeWords = getCurrentEditorWords();
      activeWords.splice(i, 1);
      buildWordRows();
    });

    row.appendChild(num);
    row.appendChild(input);
    row.appendChild(del);
    container.appendChild(row);
  });
}

function openWordEditor() {
  buildWordRows();
  document.getElementById('wordEditorNewInput').value = '';
  document.getElementById('wordEditor').classList.add('open');
  document.getElementById('wordEditorNewInput').focus();
}

document.getElementById('wordEditorSave').addEventListener('click', () => {
  const words = getCurrentEditorWords();
  if (words.length > 0) activeWords = words;
  document.getElementById('wordEditor').classList.remove('open');
  render();
});

document.getElementById('wordEditorCancel').addEventListener('click', () => {
  document.getElementById('wordEditor').classList.remove('open');
  render();
});

document.getElementById('wordEditorAddBtn').addEventListener('click', () => {
  const input = document.getElementById('wordEditorNewInput');
  const word = input.value.trim().toLowerCase();
  if (!word) return;
  activeWords = getCurrentEditorWords();
  activeWords.push(word);
  buildWordRows();
  input.value = '';
  // scroll to bottom so new word is visible
  const rows = document.getElementById('wordRows');
  rows.scrollTop = rows.scrollHeight;
});

// Enter key in new-word input triggers Add
document.getElementById('wordEditorNewInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('wordEditorAddBtn').click();
});

// Stop all keystrokes inside the overlay from reaching the game
document.getElementById('wordEditor').addEventListener('keydown', e => e.stopPropagation());

// ─── Boot ─────────────────────────────────────────────────────────────────────

loadSpriteSheet('img/sprites.png', () => {
  loadKnightImage('img/knight.png', () => {
    initGame();
    render();
  });
});
