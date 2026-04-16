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
  { id: 'health', label: 'HEALTH BOOST', icon: 'H', desc: 'Restore 2 hearts' },
  { id: 'peek',   label: 'EXTRA PEEK',   icon: 'P', desc: 'See the word for 3s' },
  { id: 'wild',   label: 'WILD LETTERS', icon: 'W', desc: 'Auto-type 3 letters' },
];

let game = {};
let activeWords = WORDS.slice();
let musicEnabled = false;

function initGame() {
  blurBattleInput();
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
const battleInput = document.getElementById('battleInput');
const ctx = canvas.getContext('2d');
// Logical game resolution
const W = 256;
const H = 240;
const MAX_RENDER_SCALE = 3;
const HUD_PANEL = { x: 8, y: 8, w: 104, h: 42 };
const LETTER_PANEL = { x: 16, y: H - 46, w: W - 32, h: 30 };
const BATTLE_LAYOUT = {
  knightScale: 6,
  monsterScale: 6,
  knightX: 20,
  monsterRight: 26,
  previewMonsterScale: 6,
  titleKnightScale: 6,
  titleMonsterScale: 5,
};
const GROUND = H - 68;

let renderScale = 1;
let ambientTime = 0;
let ambientRafId = null;
const prefersSoftKeyboard = window.matchMedia('(pointer: coarse)').matches;

function px(size) { return `${size}px VT323, monospace`; }

function oscillate(periodMs, amplitude, phase = 0) {
  return Math.round(Math.sin((ambientTime / periodMs) * Math.PI * 2 + phase) * amplitude);
}

function pulse(periodMs, min = 0, max = 1, phase = 0) {
  const t = (Math.sin((ambientTime / periodMs) * Math.PI * 2 + phase) + 1) * 0.5;
  return min + (max - min) * t;
}

function ensureAmbientLoop() {
  if (ambientRafId !== null) return;

  function tick(ts) {
    ambientTime = ts;
    if (!anim && game.state) render();
    ambientRafId = requestAnimationFrame(tick);
  }

  ambientRafId = requestAnimationFrame(tick);
}

function setCanvasScale() {
  const availableWidth = Math.max(W, window.innerWidth - 32);
  const availableHeight = Math.max(H, window.innerHeight - 120);
  const nextScale = Math.max(
    1,
    Math.min(MAX_RENDER_SCALE, Math.floor(Math.min(availableWidth / W, availableHeight / H)))
  );

  renderScale = nextScale;
  canvas.width = W * renderScale;
  canvas.height = H * renderScale;
  canvas.style.width = `${W * renderScale}px`;
  canvas.style.height = `${H * renderScale}px`;
  ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
  ctx.imageSmoothingEnabled = false;
}

function focusBattleInput() {
  if (!prefersSoftKeyboard) return;
  battleInput.value = '';
  battleInput.focus({ preventScroll: true });
}

function blurBattleInput() {
  battleInput.value = '';
  battleInput.blur();
}

function getKnightBounds(offsetX = 0, offsetY = 0) {
  const scale = BATTLE_LAYOUT.knightScale;
  return {
    x: BATTLE_LAYOUT.knightX + offsetX,
    y: GROUND - SPRITE_DEFS.knight.h * scale + offsetY,
    w: SPRITE_DEFS.knight.w * scale,
    h: SPRITE_DEFS.knight.h * scale,
    scale,
  };
}

function getMonsterBounds(monsterType) {
  const scale = BATTLE_LAYOUT.monsterScale;
  const w = getMonsterWidth(monsterType);
  const h = getMonsterHeight(monsterType);
  return {
    x: W - BATTLE_LAYOUT.monsterRight - w * scale,
    y: GROUND - h * scale,
    w: w * scale,
    h: h * scale,
    scale,
  };
}

function drawPanel(x, y, w, h, fill = '#1d2b53', border = '#29adff') {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
}

function queueLetterInput(letter) {
  if (game.state !== STATE.BATTLE) return;
  if (game.wildActive && game.wildRemaining > 0) return;

  if (anim !== null) {
    game.pendingKeys.push(letter);
  } else {
    handleLetterInput(letter);
  }
}

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
  renderBattleScene({
    knightOffsetX: ox,
    knightOffsetY: oy,
    swordAngle: getAttackSwordAngle(t, impactT),
  });

  // Slash starburst visible in a window centred on impactT
  const before = 0.20, after = 0.32;
  const { monsterX, monsterY, mW, mH, monsterScale } = anim;
  if (t > impactT - before && t < impactT + after) {
    const slashAlpha = t < impactT
      ? (t - (impactT - before)) / before
      : 1 - (t - impactT) / after;
    drawSlash(monsterX - 2, monsterY + Math.round((mH * monsterScale) / 2) - 5,
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
        monsterX + Math.round((mW * monsterScale) / 2),
        Math.round(monsterY - 6 - lt * 16)
      );
      ctx.restore();
    }
  }
}

function getAttackSwordAngle(t, impactT) {
  if (t <= impactT) {
    const p = t / impactT;
    return Math.sin(p * Math.PI * 0.5) * Math.PI * 0.5;
  }

  const p = (t - impactT) / (1 - impactT);
  return (1 - p) * Math.PI * 0.5;
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

  const knight = getKnightBounds();
  const beamX  = knight.x + 9 * knight.scale;
  const beamY  = knight.y + Math.round(knight.h * 0.50);

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
  if (r < 0.25) {
    return { type: 'lunge',     duration: 300 + Math.floor(Math.random() * 80),  impactT: 0.54 + Math.random() * 0.06 };
  } else if (r < 0.45) {
    return { type: 'jump',      duration: 450 + Math.floor(Math.random() * 100), impactT: 0.58 + Math.random() * 0.10 };
  } else if (r < 0.60) {
    return { type: 'dash',      duration: 200 + Math.floor(Math.random() * 55),  impactT: 0.24 + Math.random() * 0.07 };
  } else if (r < 0.78) {
    return { type: 'high_jump', duration: 650 + Math.floor(Math.random() * 100), impactT: 0.60 + Math.random() * 0.08 };
  } else {
    return { type: 'spin',      duration: 380 + Math.floor(Math.random() * 80),  impactT: 0.50 + Math.random() * 0.10 };
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
    case 'high_jump': {
      // Soaring leap — much higher arc, overshoots slightly then lands on monster
      let x, y;
      if (t <= impactT) {
        const p = t / impactT;
        x = p * 80;
        y = -Math.sin(p * Math.PI) * 90;
      } else {
        const p = (t - impactT) / (1 - impactT);
        x = (1 - p) * 80;
        // Bounce: small hop on landing
        y = p < 0.3 ? Math.sin((p / 0.3) * Math.PI) * 10 : 0;
      }
      return { x: Math.round(x), y: Math.round(y) };
    }
    case 'spin': {
      // Rush forward with a spin: knight moves toward monster in a tight spiral
      const progress = Math.sin(t * Math.PI);
      const x = progress * 76;
      const y = t < 0.5
        ? -Math.sin((t / 0.5) * Math.PI * 2) * 14
        : 0;
      return { x: Math.round(x), y: Math.round(y) };
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
  ctx.fillStyle = '#14142b';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#1d2b53';
  ctx.fillRect(0, 0, W, 64);
  ctx.fillStyle = '#23386b';
  ctx.fillRect(0, 64, W, 44);
  ctx.fillStyle = '#16213f';
  ctx.fillRect(0, 108, W, GROUND - 108);

  drawCloud(26 + oscillate(12000, 3, 0.4), 20 + oscillate(2600, 1, 0.2));
  drawCloud(170 + oscillate(15000, 4, 1.2), 30 + oscillate(3000, 1, 0.8));
  drawCloud(102 + oscillate(10000, 2, 2.1), 52 + oscillate(2400, 1, 1.4));

  ctx.fillStyle = '#0f1731';
  drawMountainRange([
    [0, 136, 48, 32],
    [30, 124, 60, 44],
    [82, 132, 56, 36],
    [128, 120, 66, 48],
    [182, 132, 52, 36],
    [214, 126, 42, 42],
  ]);

  ctx.fillStyle = '#1d2b53';
  drawMountainRange([
    [0, 148, 32, 20],
    [24, 140, 46, 28],
    [66, 152, 40, 16],
    [100, 142, 48, 26],
    [142, 150, 42, 18],
    [176, 140, 46, 28],
    [214, 148, 42, 20],
  ]);

  ctx.fillStyle = '#5f574f';
  ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.fillStyle = '#7a7068';
  ctx.fillRect(0, GROUND, W, 6);
  ctx.fillStyle = '#4b443d';
  ctx.fillRect(0, GROUND + 6, W, H - GROUND - 6);

  ctx.fillStyle = '#00e436';
  for (let x = 0; x < W; x += 16) {
    ctx.fillRect(x, GROUND - 2, 8, 2);
  }

  ctx.fillStyle = '#83769c';
  for (let x = 10; x < W; x += 34) {
    ctx.fillRect(x, GROUND + 14, 6, 4);
    ctx.fillRect(x + 2, GROUND + 10, 2, 4);
  }
}

function drawCloud(x, y) {
  ctx.fillStyle = '#c2c3c7';
  ctx.fillRect(x + 8, y, 24, 8);
  ctx.fillRect(x, y + 8, 40, 8);
  ctx.fillRect(x + 8, y + 16, 24, 8);
  ctx.fillStyle = '#fff1e8';
  ctx.fillRect(x + 8, y + 8, 24, 8);
}

function drawMountainRange(mountains) {
  mountains.forEach(([x, y, w, h]) => {
    for (let row = 0; row < h; row += 8) {
      const inset = Math.floor((row / 8) * 0.5) * 8;
      const width = Math.max(8, w - inset * 2);
      ctx.fillRect(x + inset, y + row, width, 8);
    }
  });
}

// ─── Title Screen ─────────────────────────────────────────────────────────────

function renderTitle() {
  const knightBob = oscillate(1800, 2, 0.4);
  const monsterBob = oscillate(1500, 2, 1.6);
  const swordTilt = oscillate(1200, 1, 2.2);

  ctx.fillStyle = '#ffec27';
  ctx.font = px(24);
  ctx.textAlign = 'center';
  ctx.fillText('SPELLING', W / 2, 24 + oscillate(2200, 1, 0.2));
  ctx.fillStyle = '#ff004d';
  ctx.fillText('MONSTER', W / 2, 42 + oscillate(2000, 1, 1.1));

  drawTitleRidge();

  drawKnight(ctx, 42, 68 + knightBob, BATTLE_LAYOUT.titleKnightScale);
  ctx.fillStyle = '#fff1e8';
  ctx.fillRect(121, 92 + swordTilt, 2, 6);
  drawMonster(
    ctx,
    0,
    W - 56 - getMonsterWidth(0) * BATTLE_LAYOUT.titleMonsterScale,
    78 + monsterBob,
    BATTLE_LAYOUT.titleMonsterScale
  );

  ctx.fillStyle = '#c2c3c7';
  ctx.font = px(11);
  ctx.textAlign = 'left';
  ctx.fillText('SETTINGS', 22, 150);
  drawToggle(22, 158, 'Audio Preview', game.settings.audio, 'A');
  drawToggle(22, 176, 'Sneak Peek',    game.settings.peek,  'S');
  drawToggle(22, 194, 'Music',         musicEnabled,        'M');

  drawButton(22,  214, 100, 16, 'PLAY GAME',  '#00e436', '#000000');
  drawButton(134, 214, 100, 16, 'EDIT WORDS', '#29adff', '#000000');
}

function drawTitleRidge() {
  ctx.fillStyle = '#00e436';
  ctx.fillRect(20, 136, 216, 3);

  const ridgeRows = [
    [28, 132, 28],
    [20, 136, 216],
    [28, 140, 200],
    [38, 144, 180],
    [50, 148, 156],
  ];

  ctx.fillStyle = '#7a7068';
  ridgeRows.forEach(([x, y, w]) => ctx.fillRect(x, y, w, 4));

  ctx.fillStyle = '#5f574f';
  [
    [28, 152, 200],
    [40, 156, 176],
    [56, 160, 144],
  ].forEach(([x, y, w]) => ctx.fillRect(x, y, w, 4));

  ctx.fillStyle = '#83769c';
  [48, 76, 170, 198].forEach(x => {
    ctx.fillRect(x, 148, 4, 4);
    ctx.fillRect(x + 2, 144, 2, 4);
  });
}

function drawToggle(x, y, label, active, key) {
  drawPanel(x, y, 24, 14, active ? '#00e436' : '#5f574f', active ? '#00e436' : '#83769c');
  ctx.fillStyle = '#000';
  ctx.font = px(10);
  ctx.textAlign = 'left';
  ctx.fillText(active ? 'ON' : 'OFF', x + 3, y + 10);
  ctx.fillStyle = '#c2c3c7';
  ctx.fillText(label, x + 32, y + 10);
  ctx.fillStyle = '#83769c';
  ctx.fillText('[' + key + ']', x + 134, y + 10);
}

function drawButton(x, y, w, h, label, bg, fg) {
  drawPanel(x, y, w, h, bg, '#fff1e8');
  ctx.fillStyle = fg;
  ctx.font = px(11);
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + 4);
}

// ─── Preview Screen ───────────────────────────────────────────────────────────

function renderPreview() {
  const word = game.words[game.currentIndex];
  const monsterType = game.currentIndex % 4;
  const monsterScale = BATTLE_LAYOUT.previewMonsterScale + (pulse(1200, 0, 0.7, 1.3) > 0.4 ? 1 : 0);
  const monsterY = 60 + oscillate(900, 2, 0.9);

  ctx.fillStyle = '#2b0f54';
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.globalAlpha = pulse(1100, 0.18, 0.34, 0.5);
  ctx.fillStyle = '#ff004d';
  ctx.fillRect(56, 54, W - 112, 6);
  ctx.fillRect(48, 62, W - 96, 6);
  ctx.fillRect(40, 70, W - 80, 6);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = pulse(1400, 0.20, 0.40, 1.2);
  ctx.fillStyle = '#ffa300';
  ctx.fillRect(68, 108, W - 136, 6);
  ctx.fillRect(58, 116, W - 116, 6);
  ctx.restore();

  ctx.fillStyle = '#ffec27';
  ctx.font = px(14);
  ctx.textAlign = 'center';
  ctx.fillText('A NEW MONSTER APPEARS!', W / 2, 28 + oscillate(1800, 1, 0.6));

  drawMonster(
    ctx,
    monsterType,
    W / 2 - Math.round(getMonsterWidth(monsterType) * monsterScale / 2),
    monsterY,
    monsterScale
  );

  if (game.peekVisible) {
    drawPanel(36, 148, W - 72, 38, '#111111', '#ffec27');
    ctx.fillStyle = '#ffec27';
    ctx.font = px(20);
    ctx.fillText(word.toUpperCase(), W / 2, 166);
    ctx.fillStyle = '#c2c3c7';
    ctx.font = px(10);
    ctx.fillText('Remember this word!', W / 2, 182);
  } else {
    ctx.fillStyle = '#c2c3c7';
    ctx.font = px(12);
    ctx.fillText('Get ready...', W / 2, 170);
  }
}

// ─── Battle Screen ────────────────────────────────────────────────────────────

// Shared by normal render, attack anim, injury anim, and fatality anim.
// opts.knightOffsetX — x shift for lunge animation (default 0)
// opts.hideMonster   — true during fatality explosion (default false)
function renderBattleScene({ knightOffsetX = 0, knightOffsetY = 0, hideMonster = false, swordAngle = 0 } = {}) {
  const word = game.words[game.currentIndex];
  const monsterType = game.currentIndex % 4;
  const idlePhase = (game.currentIndex % 4) * 0.7;
  const knight = getKnightBounds(
    knightOffsetX,
    knightOffsetY + (anim ? 0 : oscillate(1600, 1, 0.2))
  );
  const monster = getMonsterBounds(monsterType);
  const monsterIdleY = anim ? 0 : oscillate(1300, 2, idlePhase);
  const monsterIdleX = anim ? 0 : oscillate(2200, 1, idlePhase + 1.1);

  drawPanel(HUD_PANEL.x, HUD_PANEL.y, HUD_PANEL.w, HUD_PANEL.h, '#141f3d', '#0f3460');

  ctx.fillStyle = '#83769c';
  ctx.font = px(10);
  ctx.textAlign = 'left';
  ctx.fillText(`ROUND ${game.currentIndex + 1}/${game.words.length}`, 16, 18);

  // Replay audio button and music toggle — always visible during battle
  drawReplayButton();
  drawBattleMusicButton();

  // Knight HP hearts
  for (let i = 0; i < game.maxKnightHP; i++) {
    drawHeart(ctx, 16 + i * 14, 30, 2, i < game.knightHP);
  }

  // Inventory slots
  drawInventory();

  drawKnight(ctx, knight.x, knight.y, knight.scale, { swordAngle });

  if (!hideMonster) {
    drawMonster(ctx, monsterType, monster.x + monsterIdleX, monster.y + monsterIdleY, monster.scale);
  }

  // Peek overlay
  if (game.peekVisible) {
    drawPanel(W / 2 - 72, H / 2 - 18, 144, 30, '#111111', '#ffec27');
    ctx.fillStyle = '#ffec27';
    ctx.font = px(16);
    ctx.textAlign = 'center';
    ctx.fillText(word.toUpperCase(), W / 2, H / 2 + 4);
  }

  // Letter health bar
  drawLetterBar(word, game.typedSoFar);

  // Bottom hint
  ctx.fillStyle = '#83769c';
  ctx.font = px(10);
  ctx.textAlign = 'center';
  if (game.wildActive && game.wildRemaining > 0) {
    ctx.fillStyle = '#ffec27';
    ctx.fillText(`WILD LETTERS: ${game.wildRemaining} LEFT`, W / 2, H - 12);
  } else {
    ctx.fillStyle = '#c2c3c7';
    ctx.fillText('TYPE THE NEXT LETTER', W / 2, H - 12);
  }
}

function drawReplayButton() {
  const bx = W - 76, by = 8, bw = 68, bh = 16;
  drawPanel(bx, by, bw, bh);
  ctx.fillStyle = '#29adff';
  ctx.font = px(10);
  ctx.textAlign = 'center';
  ctx.fillText('HEAR WORD', bx + bw / 2, by + bh / 2 + 4);
}

function drawBattleMusicButton() {
  const bx = W - 76, by = 28, bw = 68, bh = 14;
  drawPanel(bx, by, bw, bh, '#1d2b53', musicEnabled ? '#00e436' : '#5f574f');
  ctx.fillStyle = musicEnabled ? '#00e436' : '#5f574f';
  ctx.font = px(10);
  ctx.textAlign = 'center';
  ctx.fillText('MUSIC ' + (musicEnabled ? 'ON' : 'OFF'), bx + bw / 2, by + bh / 2 + 4);
}

function drawLetterBar(word, typed) {
  const tileSize = word.length > 8 ? 16 : 18;
  const gap = 4;
  const totalW = word.length * (tileSize + gap) - gap;
  const startX = Math.round((W - totalW) / 2);
  const y = LETTER_PANEL.y + 6;

  drawPanel(LETTER_PANEL.x, LETTER_PANEL.y, LETTER_PANEL.w, LETTER_PANEL.h, '#141f3d', '#0f3460');

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
      ctx.font = px(tileSize === 16 ? 13 : 14);
      ctx.textAlign = 'center';
      ctx.fillText(letter.toUpperCase(), x + tileSize / 2, y + tileSize / 2 + 5);
    } else if (isCurrent) {
      const pulseGrow = Math.round(pulse(850, 0, 2, 0.3));
      ctx.fillStyle = '#ffa300';
      ctx.fillRect(x - 1 - pulseGrow, y - 1 - pulseGrow, tileSize + 2 + pulseGrow * 2, tileSize + 2 + pulseGrow * 2);
      ctx.fillStyle = '#1d2b53';
      ctx.fillRect(x, y, tileSize, tileSize);
      ctx.fillStyle = '#ffec27';
      ctx.font = px(tileSize === 16 ? 13 : 14);
      ctx.textAlign = 'center';
      ctx.fillText('?', x + tileSize / 2, y + tileSize / 2 + 5 + oscillate(900, 1, 0.8));
    } else {
      ctx.fillStyle = '#5f574f';
      ctx.fillRect(x, y, tileSize, tileSize);
      ctx.fillStyle = '#3a3535';
      ctx.fillRect(x + 1, y + 1, tileSize - 2, tileSize - 2);
      ctx.fillStyle = '#83769c';
      ctx.font = px(tileSize === 16 ? 13 : 14);
      ctx.textAlign = 'center';
      ctx.fillText('?', x + tileSize / 2, y + tileSize / 2 + 5);
    }
  });
}

function drawInventory() {
  const slotSize = 16;
  const gap = 4;
  const startX = 14;
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
      ctx.fillStyle = '#ffec27';
      ctx.font = px(13);
      ctx.textAlign = 'center';
      ctx.fillText(item.icon, x + slotSize / 2, startY + slotSize / 2 + 4 + oscillate(1800, 1, i * 0.9));
    }

    ctx.fillStyle = itemId ? '#ffa300' : '#5f574f';
    ctx.font = px(8);
    ctx.textAlign = 'center';
    ctx.fillText(`[${i + 1}]`, x + slotSize / 2, startY + slotSize + 8);
  }
}

// ─── Bonus Screen ─────────────────────────────────────────────────────────────

function renderBonus() {
  ctx.fillStyle = '#ffec27';
  ctx.font = px(18);
  ctx.textAlign = 'center';
  ctx.fillText('BONUS ITEM!', W / 2, 28);

  const inventoryFull = game.inventory.length >= 3;
  ctx.fillStyle = inventoryFull ? '#ff77a8' : '#c2c3c7';
  ctx.font = px(10);
  ctx.fillText(
    inventoryFull ? 'Inventory full - activates now!' : `Choose a reward (${game.inventory.length}/3 slots used)`,
    W / 2, 42
  );

  game.bonusItems.forEach((item, i) => drawItemCard(17 + i * 76, 56 + oscillate(1800, 2, i * 0.9), 70, 98, item, i + 1));

  ctx.fillStyle = '#83769c';
  ctx.font = px(10);
  ctx.textAlign = 'center';
  ctx.fillText('Press 1, 2, or 3 to choose', W / 2, 200);
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawItemCard(x, y, w, h, item, num) {
  drawPanel(x, y, w, h, '#1d2b53', '#29adff');

  ctx.fillStyle = '#ffec27';
  ctx.font = px(16);
  ctx.textAlign = 'center';
  ctx.fillText(item.icon, x + w / 2, y + 24);

  ctx.fillStyle = '#fff1e8';
  ctx.font = px(9);
  const labelLines = wrapText(ctx, item.label, w - 10);
  labelLines.forEach((ln, i) => ctx.fillText(ln, x + w / 2, y + 38 + i * 10));

  ctx.fillStyle = '#83769c';
  ctx.font = px(8);
  const descLines = wrapText(ctx, item.desc, w - 10);
  const descY = y + 42 + labelLines.length * 10 + 6;
  descLines.forEach((ln, i) => ctx.fillText(ln, x + w / 2, descY + i * 10));

  ctx.fillStyle = '#ffa300';
  ctx.font = px(14);
  ctx.fillText(`[${num}]`, x + w / 2, y + h - 10);
}

// ─── Victory / Defeat Screens ────────────────────────────────────────────────

function renderVictory() {
  ctx.fillStyle = '#ffec27';
  ctx.font = px(28);
  ctx.textAlign = 'center';
  ctx.fillText('YOU WIN!', W / 2, 40);

  ctx.fillStyle = '#00e436';
  ctx.font = px(14);
  ctx.fillText('All monsters defeated!', W / 2, 64);

  if (game.perfectScore) {
    ctx.fillStyle = '#ffa300';
    ctx.font = px(16);
    ctx.fillText('PERFECT SCORE!', W / 2, 90);
    ctx.fillStyle = '#ff77a8';
    ctx.font = px(11);
    ctx.fillText('No hearts lost - amazing!', W / 2, 108);
  }

  drawKnight(ctx, W / 2 - 18, 128 + oscillate(1400, 2, 0.4), 4);
  drawButton(W / 2 - 55, 194, 110, 18, 'PLAY AGAIN', '#00e436', '#000');
}

function renderDefeat() {
  ctx.fillStyle = '#ff004d';
  ctx.font = px(28);
  ctx.textAlign = 'center';
  ctx.fillText('GAME OVER', W / 2, 54);

  ctx.fillStyle = '#c2c3c7';
  ctx.font = px(12);
  ctx.fillText('The knight has fallen!', W / 2, 82);

  ctx.fillStyle = '#83769c';
  ctx.font = px(12);
  ctx.fillText(`${game.monstersDefeated}/${game.words.length} monsters defeated`, W / 2, 100);

  drawMonster(ctx, game.currentIndex % 4, W / 2 - 24, 122 + oscillate(1700, 2, 1.1), 6);
  drawButton(W / 2 - 55, 184, 110, 18, 'TRY AGAIN', '#ff004d', '#fff');
}

// ─── Input Handling ───────────────────────────────────────────────────────────

document.addEventListener('keydown', handleKey);

function handleKey(e) {
  const key = e.key;

  if (game.state === STATE.TITLE) {
    if (key === 'Enter' || key === ' ') { startGame(); return; }
    if (key === 'a' || key === 'A') { game.settings.audio = !game.settings.audio; render(); return; }
    if (key === 's' || key === 'S') { game.settings.peek  = !game.settings.peek;  render(); return; }
    if (key === 'm' || key === 'M') { toggleMusic(); return; }
    return;
  }

  if (game.state === STATE.PREVIEW) return;

  if (game.state === STATE.BATTLE) {
    if (key === '1') { useInventoryItem(0); return; }
    if (key === '2') { useInventoryItem(1); return; }
    if (key === '3') { useInventoryItem(2); return; }
    if (/^[a-zA-Z]$/.test(key)) {
      queueLetterInput(key.toLowerCase());
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
    const monster = getMonsterBounds(monsterType);
    const mW = getMonsterWidth(monsterType);
    const mH = getMonsterHeight(monsterType);

    if (game.typedSoFar === word) {
      // FATALITY — explode the monster
      const cx = monster.x + Math.round(monster.w / 2);
      const cy = monster.y + Math.round(monster.h / 2);
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
        monsterX: monster.x,
        monsterY: monster.y,
        mW,
        mH,
        monsterScale: monster.scale,
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

function toggleMusic() {
  musicEnabled = !musicEnabled;
  if (!musicEnabled) {
    Music.stop();
  } else if (game.state === STATE.BATTLE) {
    Music.playBattle();
  }
  render();
}

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
      if (musicEnabled) Music.playBattle();
      game.peekVisible = false;
      if (game.extraPeekActive) {
        game.extraPeekActive = false;
        showPeek(3000);
      }
      render();
      focusBattleInput();
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
    if (musicEnabled) Music.playVictory();
    showBonusScreen();
    return;
  }

  game.currentIndex++;
  if (game.currentIndex >= game.words.length) {
    game.state = STATE.VICTORY;
    blurBattleInput();
    Music.stop();
    SFX.victory();
    render();
  } else {
    if (musicEnabled) Music.playVictory();
    game.state = STATE.PREVIEW;
    startPreview();
  }
}

function showBonusScreen() {
  game.bonusItems = [...ITEMS].sort(() => Math.random() - 0.5).slice(0, 3);
  game.state = STATE.BONUS;
  blurBattleInput();
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
    blurBattleInput();
    Music.stop();
    render();
  } else {
    focusBattleInput();
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
  const monster = getMonsterBounds(monsterType);
  const mW = getMonsterWidth(monsterType);
  const mH = getMonsterHeight(monsterType);

  if (game.typedSoFar === word) {
    const cx = monster.x + Math.round(monster.w / 2);
    const cy = monster.y + Math.round(monster.h / 2);
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
    monsterX: monster.x,
    monsterY: monster.y,
    mW,
    mH,
    monsterScale: monster.scale,
    letter,
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
battleInput.addEventListener('input', () => {
  const letters = battleInput.value.toLowerCase().replace(/[^a-z]/g, '');
  battleInput.value = '';

  for (const letter of letters) {
    queueLetterInput(letter);
  }

  if (game.state === STATE.BATTLE) {
    focusBattleInput();
  }
});
battleInput.addEventListener('keydown', e => e.stopPropagation());

function handleClick(e) {
  const rect  = canvas.getBoundingClientRect();
  const scaleX = W / rect.width;
  const scaleY = H / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top)  * scaleY;

  if (game.state === STATE.TITLE) {
    if (x >= 22  && x <= 122 && y >= 214 && y <= 230) { startGame(); focusBattleInput(); return; }
    if (x >= 134 && x <= 234 && y >= 214 && y <= 230) { openWordEditor(); return; }
    if (x >= 22  && x <= 46  && y >= 158 && y <= 172) { game.settings.audio = !game.settings.audio; render(); return; }
    if (x >= 22  && x <= 46  && y >= 176 && y <= 190) { game.settings.peek  = !game.settings.peek;  render(); return; }
    if (x >= 22  && x <= 46  && y >= 194 && y <= 208) { toggleMusic(); return; }
  }

  if (game.state === STATE.BATTLE) {
    focusBattleInput();
    // Replay button: top right
    if (x >= W - 76 && x <= W - 8 && y >= 8 && y <= 24) {
      Audio.speakWord(game.words[game.currentIndex]);
      return;
    }
    // Music toggle button: below replay button
    if (x >= W - 76 && x <= W - 8 && y >= 28 && y <= 42) {
      toggleMusic();
      return;
    }
    // Inventory slots: top left below hearts
    const slotSize = 16, gap = 4, startX = 14, startY = 54;
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
      if (x >= cx && x <= cx + 70 && y >= 56 && y <= 154) applyBonus(i);
    });
  }

  if (game.state === STATE.VICTORY) {
    if (x >= W/2-55 && x <= W/2+55 && y >= 194 && y <= 212) { initGame(); render(); }
  }

  if (game.state === STATE.DEFEAT) {
    if (x >= W/2-55 && x <= W/2+55 && y >= 184 && y <= 202) { initGame(); render(); }
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
  blurBattleInput();
  buildWordRows();
  document.getElementById('wordEditorNewInput').value = '';
  document.getElementById('wordEditor').classList.add('open');
  document.getElementById('wordEditorNewInput').focus();
}

const SAVED_WORDS_KEY = 'spellingMonster_savedWords';

document.getElementById('wordEditorSave').addEventListener('click', () => {
  const words = getCurrentEditorWords();
  if (words.length > 0) {
    activeWords = words;
    localStorage.setItem(SAVED_WORDS_KEY, JSON.stringify(words));
  }
  document.getElementById('wordEditor').classList.remove('open');
  render();
});

document.getElementById('wordEditorReset').addEventListener('click', () => {
  localStorage.removeItem(SAVED_WORDS_KEY);
  fetchDefaultWords().then(words => {
    activeWords = words;
    buildWordRows();
  });
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

function parseWordsMd(text) {
  return text.split('\n')
    .map(line => line.trim().toLowerCase())
    .filter(line => line.length > 0 && !line.startsWith('#'));
}

function fetchDefaultWords() {
  return fetch('data/words.md')
    .then(r => r.text())
    .then(parseWordsMd)
    .catch(() => WORDS.slice());
}

function loadActiveWords() {
  const saved = localStorage.getItem(SAVED_WORDS_KEY);
  if (saved) {
    try {
      const words = JSON.parse(saved);
      if (Array.isArray(words) && words.length > 0) {
        return Promise.resolve(words);
      }
    } catch (e) { /* fall through */ }
  }
  return fetchDefaultWords();
}

window.addEventListener('resize', () => {
  setCanvasScale();
  if (game.state) render();
});

loadSprites(() => {
  loadActiveWords().then(words => {
    activeWords = words;
    initGame();
    setCanvasScale();
    ensureAmbientLoop();
    render();
  });
});
