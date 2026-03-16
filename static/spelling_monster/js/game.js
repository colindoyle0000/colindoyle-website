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
const W = canvas.width;
const H = canvas.height;

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
    const SCALE = 5;
    drawSlash(monsterX - 5, monsterY + Math.round((mH * SCALE) / 2) - 12,
              Math.min(1, Math.max(0, slashAlpha)));

    // Letter floats up from the monster after impact
    if (anim.letter && t >= impactT) {
      const lt = (t - impactT) / after;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - lt);
      ctx.fillStyle = '#ffec27';
      ctx.font = px(16);
      ctx.textAlign = 'center';
      ctx.fillText(
        anim.letter.toUpperCase(),
        monsterX + Math.round((mW * SCALE) / 2),
        Math.round(monsterY - 15 - lt * 38)
      );
      ctx.restore();
    }
  }
}

// Injury: screen shakes + red flash overlay
function drawInjuryFrame(t) {
  const shake = Math.round(Math.sin(t * Math.PI * 7) * 11 * (1 - t));
  ctx.save();
  ctx.translate(shake, Math.round(shake * 0.25));
  renderBattleScene();
  ctx.restore();
  // Red vignette overlay
  ctx.fillStyle = `rgba(220, 0, 0, ${0.45 * (1 - t)})`;
  ctx.fillRect(0, 0, W, H);
}

// Fatality: monster explodes into particles + "DEFEATED!" text
function drawFatalityFrame(t) {
  renderBattleScene({ hideMonster: true });

  // Particles
  const dt = (t * anim.duration) / 1000;
  ctx.save();
  anim.particles.forEach(p => {
    ctx.globalAlpha = Math.max(0, 1 - t * 1.3);
    ctx.fillStyle = p.color;
    ctx.fillRect(
      Math.round(p.x + p.vx * dt),
      Math.round(p.y + p.vy * dt + 80 * dt * dt), // slight gravity
      p.size, p.size
    );
  });
  ctx.globalAlpha = 1;
  ctx.restore();

  // "DEFEATED!" text flies up and fades
  const textAlpha = t < 0.25 ? t / 0.25 : t > 0.65 ? Math.max(0, 1 - (t - 0.65) / 0.25) : 1;
  if (textAlpha > 0) {
    ctx.save();
    ctx.globalAlpha = textAlpha;
    ctx.fillStyle = '#ffec27';
    ctx.font = px(11);
    ctx.textAlign = 'center';
    ctx.fillText('DEFEATED!', anim.cx, Math.round(anim.cy - 15 - t * 55));
    ctx.restore();
  }
}

// Sword slash starburst at a given canvas position
function drawSlash(x, y, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#ffec27';
  ctx.fillRect(x - 22, y - 4, 44, 8);   // horizontal bar
  ctx.fillRect(x - 4, y - 22, 8, 44);   // vertical bar
  ctx.fillStyle = '#fff1e8';
  ctx.fillRect(x - 16, y - 16, 8, 8);   // diagonal TL
  ctx.fillRect(x + 8,  y - 16, 8, 8);   // diagonal TR
  ctx.fillRect(x - 16, y + 8,  8, 8);   // diagonal BL
  ctx.fillRect(x + 8,  y + 8,  8, 8);   // diagonal BR
  ctx.restore();
}

function generateParticles(cx, cy) {
  const colors = ['#ff004d','#ffa300','#ffec27','#00e436','#29adff','#ff77a8','#fff1e8','#7e2553'];
  return Array.from({ length: 28 }, (_, i) => {
    const angle = (i / 28) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
    const speed = 70 + Math.random() * 150;
    return {
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 40,
      color: colors[i % colors.length],
      size: 4 + Math.floor(Math.random() * 9),
    };
  });
}

// ─── Attack Type System ───────────────────────────────────────────────────────

function getAttackConfig() {
  const r = Math.random();
  if (r < 0.40) {
    // Lunge: brief wind-up then sword thrust forward
    return { type: 'lunge', duration: 300 + Math.floor(Math.random() * 80), impactT: 0.54 + Math.random() * 0.06 };
  } else if (r < 0.75) {
    // Jump: arc up into the air then slam down on the monster
    return { type: 'jump',  duration: 450 + Math.floor(Math.random() * 100), impactT: 0.58 + Math.random() * 0.10 };
  } else {
    // Dash: lightning-fast charge — blink-and-miss-it
    return { type: 'dash',  duration: 200 + Math.floor(Math.random() * 55),  impactT: 0.24 + Math.random() * 0.07 };
  }
}

// Returns { x, y } pixel offsets for the knight sprite given attack type + progress t
function getAttackOffsets(t, type, impactT) {
  switch (type) {
    case 'lunge': {
      // Steps back 14px, then lunges forward 84px, then retreats
      const x = t < 0.18
        ? -14 * (t / 0.18)
        : -14 + 84 * Math.sin(((t - 0.18) / 0.82) * Math.PI);
      return { x: Math.round(x), y: 0 };
    }
    case 'jump': {
      // Arcs upward then slams down at impactT, retreats after
      let x, y;
      if (t <= impactT) {
        const p = t / impactT;
        x = p * 70;
        y = -Math.sin(p * Math.PI) * 92; // up then crash down
      } else {
        const p = (t - impactT) / (1 - impactT);
        x = (1 - p) * 70;
        y = 0;
      }
      return { x: Math.round(x), y: Math.round(y) };
    }
    case 'dash': {
      // Very fast forward, slower return
      const x = t < impactT
        ? (t / impactT) * 94
        : (1 - (t - impactT) / (1 - impactT)) * 94;
      return { x: Math.round(x), y: 0 };
    }
    default:
      return { x: Math.round(Math.sin(t * Math.PI) * 70), y: 0 };
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
  for (let x = 0; x < W; x += 40) {
    for (let y = 0; y < H; y += 20) {
      const offset = (Math.floor(y / 20) % 2) * 20;
      ctx.strokeRect(x + offset, y, 40, 20);
    }
  }
  ctx.fillStyle = '#5f574f';
  ctx.fillRect(0, H - 60, W, 4);
}

// ─── Title Screen ─────────────────────────────────────────────────────────────

function renderTitle() {
  ctx.fillStyle = '#ffec27';
  ctx.font = px(20);
  ctx.textAlign = 'center';
  ctx.fillText('SPELLING', W / 2, 100);
  ctx.fillStyle = '#ff004d';
  ctx.fillText('MONSTER', W / 2, 130);

  drawKnight(ctx, 80, H / 2 - 60, 5);
  drawMonster(ctx, 0, W - 160, H / 2 - 50, 5);

  ctx.fillStyle = '#c2c3c7';
  ctx.font = px(9);
  ctx.textAlign = 'left';
  ctx.fillText('SETTINGS:', 60, 260);
  drawToggle(60, 275, 'Audio Preview', game.settings.audio, 'A');
  drawToggle(60, 300, 'Sneak Peek',    game.settings.peek,  'S');

  drawButton(155, 330, 150, 36, 'PLAY GAME',  '#00e436', '#000000');
  drawButton(335, 330, 150, 36, 'EDIT WORDS', '#29adff', '#000000');

  ctx.fillStyle = '#83769c';
  ctx.font = px(9);
  ctx.textAlign = 'center';
  ctx.fillText('Press ENTER or click PLAY to start', W / 2, H - 20);
}

function drawToggle(x, y, label, active, key) {
  ctx.fillStyle = active ? '#00e436' : '#5f574f';
  ctx.fillRect(x, y, 34, 18);
  ctx.fillStyle = '#000';
  ctx.font = px(9);
  ctx.textAlign = 'left';
  ctx.fillText(active ? 'ON' : 'OFF', x + 2, y + 14);
  ctx.fillStyle = '#c2c3c7';
  ctx.fillText(label, x + 42, y + 14);
  ctx.fillStyle = '#83769c';
  ctx.fillText('[' + key + ']', x + 230, y + 14);
}

function drawButton(x, y, w, h, label, bg, fg) {
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fg;
  ctx.font = px(9);
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + 4);
}

// ─── Preview Screen ───────────────────────────────────────────────────────────

function renderPreview() {
  const word = game.words[game.currentIndex];
  const monsterType = game.currentIndex % 4;

  ctx.fillStyle = '#ffec27';
  ctx.font = px(10);
  ctx.textAlign = 'center';
  ctx.fillText('A new monster appears!', W / 2, 80);

  drawMonster(ctx, monsterType, W / 2 - 50, 120, 6);

  ctx.fillStyle = '#ff77a8';
  ctx.font = px(10);
  ctx.fillText(MONSTER_NAMES[monsterType % 4] + '!', W / 2, 235);

  if (game.peekVisible) {
    ctx.fillStyle = '#ffec27';
    ctx.font = px(14);
    ctx.fillText(word.toUpperCase(), W / 2, 285);
    ctx.fillStyle = '#c2c3c7';
    ctx.font = px(9);
    ctx.fillText('Remember this word!', W / 2, 310);
  } else {
    ctx.fillStyle = '#c2c3c7';
    ctx.font = px(9);
    ctx.fillText('Get ready...', W / 2, 285);
  }
}

// ─── Battle Screen ────────────────────────────────────────────────────────────

// Shared by normal render, attack anim, injury anim, and fatality anim.
// opts.knightOffsetX — x shift for lunge animation (default 0)
// opts.hideMonster   — true during fatality explosion (default false)
function renderBattleScene({ knightOffsetX = 0, knightOffsetY = 0, hideMonster = false } = {}) {
  const word = game.words[game.currentIndex];
  const monsterType = game.currentIndex % 4;
  const SCALE = 5;

  // Progress counter
  ctx.fillStyle = '#83769c';
  ctx.font = px(9);
  ctx.textAlign = 'left';
  ctx.fillText(`Monster ${game.currentIndex + 1} of ${game.words.length}`, 10, 20);

  // Replay audio button — always visible during battle
  drawReplayButton();

  // Knight HP hearts
  for (let i = 0; i < game.maxKnightHP; i++) {
    drawHeart(ctx, 10 + i * 22, 30, 3, i < game.knightHP);
  }

  // Inventory slots
  drawInventory();

  // Knight (shifted right during lunge)
  const knightX = 30 + knightOffsetX;
  const knightY = H - 60 - KNIGHT_SPRITE.length * SCALE + knightOffsetY;
  drawKnight(ctx, knightX, knightY, SCALE);

  // Monster
  const mW = getMonsterWidth(monsterType);
  const mH = getMonsterHeight(monsterType);
  const monsterX = W - 60 - mW * SCALE;
  const monsterY = H - 60 - mH * SCALE;

  if (!hideMonster) {
    drawMonster(ctx, monsterType, monsterX, monsterY, SCALE);
    ctx.textAlign = 'center';
  }

  // Peek overlay
  if (game.peekVisible) {
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(W / 2 - 150, H / 2 - 32, 300, 54);
    ctx.fillStyle = '#ffec27';
    ctx.font = px(14);
    ctx.textAlign = 'center';
    ctx.fillText(word.toUpperCase(), W / 2, H / 2 + 9);
  }

  // Letter health bar
  drawLetterBar(word, game.typedSoFar);

  // Bottom hint
  ctx.textAlign = 'center';
  if (game.wildActive && game.wildRemaining > 0) {
    ctx.fillStyle = '#ffec27';
    ctx.font = px(9);
    ctx.fillText(`⚡ Wild: ${game.wildRemaining} left`, W / 2, H - 10);
  } else {
    ctx.fillStyle = '#c2c3c7';
    ctx.font = px(9);
    ctx.fillText('Type the next letter!', W / 2, H - 10);
  }
}

function drawReplayButton() {
  const bx = W - 130, by = 5, bw = 125, bh = 28;
  ctx.fillStyle = '#1d2b53';
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = '#29adff';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, bw, bh);
  ctx.fillStyle = '#29adff';
  ctx.font = px(9);
  ctx.textAlign = 'center';
  ctx.fillText('\u266a HEAR WORD', bx + bw / 2, by + bh / 2 + 4);
}

function drawLetterBar(word, typed) {
  const tileSize = 36;
  const gap = 6;
  const totalW = word.length * (tileSize + gap) - gap;
  const startX = Math.round((W - totalW) / 2);
  const y = H - 132;

  word.split('').forEach((letter, i) => {
    const x = startX + i * (tileSize + gap);
    const isTyped   = i < typed.length;
    const isCurrent = i === typed.length;

    if (isTyped) {
      ctx.fillStyle = '#008751';
      ctx.fillRect(x, y, tileSize, tileSize);
      ctx.fillStyle = '#00e436';
      ctx.fillRect(x + 2, y + 2, tileSize - 4, tileSize - 4);
      ctx.fillStyle = '#fff1e8';
      ctx.font = px(14);
      ctx.textAlign = 'center';
      ctx.fillText(letter.toUpperCase(), x + tileSize / 2, y + tileSize / 2 + 6);
    } else if (isCurrent) {
      ctx.fillStyle = '#ffa300';
      ctx.fillRect(x - 2, y - 2, tileSize + 4, tileSize + 4);
      ctx.fillStyle = '#1d2b53';
      ctx.fillRect(x, y, tileSize, tileSize);
      ctx.fillStyle = '#ffec27';
      ctx.font = px(14);
      ctx.textAlign = 'center';
      ctx.fillText('?', x + tileSize / 2, y + tileSize / 2 + 6);
    } else {
      ctx.fillStyle = '#5f574f';
      ctx.fillRect(x, y, tileSize, tileSize);
      ctx.fillStyle = '#3a3535';
      ctx.fillRect(x + 2, y + 2, tileSize - 4, tileSize - 4);
      ctx.fillStyle = '#83769c';
      ctx.font = px(14);
      ctx.textAlign = 'center';
      ctx.fillText('?', x + tileSize / 2, y + tileSize / 2 + 6);
    }
  });
}

function drawInventory() {
  const slotSize = 28;
  const gap = 4;
  const startX = 10;
  const startY = 54;

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
      ctx.font = px(14);
      ctx.textAlign = 'center';
      ctx.fillText(item.icon, x + slotSize / 2, startY + slotSize / 2 + 5);
    }

    ctx.fillStyle = itemId ? '#ffa300' : '#5f574f';
    ctx.font = px(6);
    ctx.textAlign = 'center';
    ctx.fillText(`[${i + 1}]`, x + slotSize / 2, startY + slotSize + 8);
  }
}

// ─── Bonus Screen ─────────────────────────────────────────────────────────────

function renderBonus() {
  ctx.fillStyle = '#ffec27';
  ctx.font = px(10);
  ctx.textAlign = 'center';
  ctx.fillText('BONUS ITEM!', W / 2, 60);

  const inventoryFull = game.inventory.length >= 3;
  ctx.fillStyle = inventoryFull ? '#ff77a8' : '#c2c3c7';
  ctx.font = px(9);
  ctx.fillText(
    inventoryFull ? 'Inventory full - activates now!' : `Choose a reward (${game.inventory.length}/3 slots used):`,
    W / 2, 90
  );

  game.bonusItems.forEach((item, i) => drawItemCard(60 + i * 190, 120, 170, 160, item, i + 1));

  ctx.fillStyle = '#83769c';
  ctx.font = px(9);
  ctx.textAlign = 'center';
  ctx.fillText('Press 1, 2, or 3 to choose', W / 2, H - 20);
}

function drawItemCard(x, y, w, h, item, num) {
  ctx.fillStyle = '#1d2b53';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#29adff';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);

  ctx.fillStyle = '#ffec27';
  ctx.font = px(28);
  ctx.textAlign = 'center';
  ctx.fillText(item.icon, x + w / 2, y + 60);

  ctx.fillStyle = '#fff1e8';
  ctx.font = px(8);
  ctx.fillText(item.label, x + w / 2, y + 90);

  ctx.fillStyle = '#83769c';
  ctx.font = px(8);
  ctx.fillText(item.desc, x + w / 2, y + 112);

  ctx.fillStyle = '#ffa300';
  ctx.font = px(10);
  ctx.fillText(`[${num}]`, x + w / 2, y + 140);
}

// ─── Victory / Defeat Screens ────────────────────────────────────────────────

function renderVictory() {
  ctx.fillStyle = '#ffec27';
  ctx.font = px(16);
  ctx.textAlign = 'center';
  ctx.fillText('YOU WIN!', W / 2, 100);

  ctx.fillStyle = '#00e436';
  ctx.font = px(11);
  ctx.fillText('All monsters defeated!', W / 2, 140);

  if (game.perfectScore) {
    ctx.fillStyle = '#ffa300';
    ctx.font = px(11);
    ctx.fillText('PERFECT SCORE!', W / 2, 185);
    ctx.fillStyle = '#ff77a8';
    ctx.font = px(9);
    ctx.fillText('No hearts lost - Amazing!', W / 2, 210);
  }

  drawKnight(ctx, W / 2 - 40, 230, 5);
  drawButton(W / 2 - 80, 340, 160, 36, 'PLAY AGAIN', '#00e436', '#000');
}

function renderDefeat() {
  ctx.fillStyle = '#ff004d';
  ctx.font = px(16);
  ctx.textAlign = 'center';
  ctx.fillText('GAME OVER', W / 2, 120);

  ctx.fillStyle = '#c2c3c7';
  ctx.font = px(9);
  ctx.fillText('The knight has fallen!', W / 2, 160);

  ctx.fillStyle = '#83769c';
  ctx.font = px(9);
  ctx.fillText(`${game.monstersDefeated} of ${game.words.length} monsters defeated`, W / 2, 190);

  drawButton(W / 2 - 80, 310, 160, 36, 'TRY AGAIN', '#ff004d', '#fff');
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

    // Compute monster position for the animation
    const SCALE = 5;
    const monsterType = game.currentIndex % 4;
    const mW = getMonsterWidth(monsterType);
    const mH = getMonsterHeight(monsterType);
    const monsterX = W - 60 - mW * SCALE;
    const monsterY = H - 60 - mH * SCALE;

    if (game.typedSoFar === word) {
      // FATALITY — explode the monster
      const cx = monsterX + Math.round((mW * SCALE) / 2);
      const cy = monsterY + Math.round((mH * SCALE) / 2);
      SFX.defeat();
      startAnim('fatality', 950, {
        particles: generateParticles(cx, cy),
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
    showBonusScreen();
    return;
  }

  game.currentIndex++;
  if (game.currentIndex >= game.words.length) {
    game.state = STATE.VICTORY;
    SFX.victory();
    render();
  } else {
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

  const SCALE = 5;
  const monsterType = game.currentIndex % 4;
  const mW = getMonsterWidth(monsterType);
  const mH = getMonsterHeight(monsterType);
  const monsterX = W - 60 - mW * SCALE;
  const monsterY = H - 60 - mH * SCALE;

  if (game.typedSoFar === word) {
    const cx = monsterX + Math.round((mW * SCALE) / 2);
    const cy = monsterY + Math.round((mH * SCALE) / 2);
    SFX.defeat();
    startAnim('fatality', 950, {
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
    if (x >= 155 && x <= 305 && y >= 330 && y <= 366) { startGame(); return; }
    if (x >= 335 && x <= 485 && y >= 330 && y <= 366) { openWordEditor(); return; }
    if (x >= 60 && x <= 94 && y >= 275 && y <= 293) { game.settings.audio = !game.settings.audio; render(); return; }
    if (x >= 60 && x <= 94 && y >= 300 && y <= 318) { game.settings.peek  = !game.settings.peek;  render(); return; }
  }

  if (game.state === STATE.BATTLE) {
    // Replay button: top right
    if (x >= W - 130 && x <= W - 5 && y >= 5 && y <= 33) {
      Audio.speakWord(game.words[game.currentIndex]);
      return;
    }
    // Inventory slots: top left below hearts
    const slotSize = 28, gap = 4, startX = 10, startY = 54;
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
      const cx = 60 + i * 190;
      if (x >= cx && x <= cx + 170 && y >= 120 && y <= 280) applyBonus(i);
    });
  }

  if (game.state === STATE.VICTORY || game.state === STATE.DEFEAT) {
    if (x >= W/2-80 && x <= W/2+80 && y >= 340 && y <= 376) { initGame(); render(); }
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

initGame();
render();
