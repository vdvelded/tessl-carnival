import { canvasFont, recordScore, theme, type CarnivalGame } from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;

export const TILE = 32;
export const ROWS = 15;
export const COLS = 212;
export const FLAG_COL = 198;
export const LIVES = 3;
export const TIME_LIMIT = 300;
/** The clock loses one unit every 0.4 seconds, so a level lasts two minutes. */
export const SECONDS_PER_TICK = 0.4;
export const GRAVITY = 1800;
export const JUMP_SPEED = 700;
export const RUN_SPEED = 220;
export const WALKER_SPEED = 60;
export const COIN_POINTS = 200;
export const STOMP_POINTS = 100;
export const TIME_POINTS = 50;
const MAX_FALL = 900;
const FLAG_TOP_ROW = 3;
const GROUND_ROW = 13;

/**
 * One tile of the level: '.' is open sky, '#' ground, 'B' brick, '?' a block
 * with a coin in it, 'U' a used block, 'X' a stair block and 'p' a pipe.
 */
export type Tile = '.' | '#' | 'B' | '?' | 'U' | 'X' | 'p';

export interface Body {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  onGround: boolean;
}

export interface Walker extends Body {
  /** Seconds since it was stomped, or undefined while it walks. */
  squashed?: number;
  alive: boolean;
}

export interface Input {
  left: boolean;
  right: boolean;
  jump: boolean;
}

export interface SuperPlumberState {
  tiles: Tile[][];
  player: Body;
  walkers: Walker[];
  input: Input;
  camera: number;
  score: number;
  coins: number;
  lives: number;
  time: number;
  /** Seconds left before the player comes back after losing a life. */
  respawnIn: number;
  phase: 'playing' | 'won' | 'over';
}

const GAPS: [number, number][] = [
  [69, 70],
  [86, 88],
  [153, 154],
];
const PIPES: [number, number][] = [
  [28, 2],
  [38, 3],
  [46, 4],
  [57, 4],
  [163, 2],
  [179, 2],
];
const WALKER_COLS = [22, 40, 51, 53, 80, 82, 97, 99, 114, 116, 124, 126, 128, 130, 174, 176];

/** Builds the first level, loosely after the classic one: pipes, pits, blocks and stairs. */
export function buildLevel(): Tile[][] {
  const tiles: Tile[][] = Array.from({ length: ROWS }, () => Array<Tile>(COLS).fill('.'));
  const set = (col: number, row: number, tile: Tile) => (tiles[row][col] = tile);

  for (let col = 0; col < COLS; col++) {
    if (GAPS.some(([from, to]) => col >= from && col <= to)) continue;
    set(col, GROUND_ROW, '#');
    set(col, GROUND_ROW + 1, '#');
  }

  set(16, 9, '?');
  for (const col of [20, 22, 24]) set(col, 9, 'B');
  for (const col of [21, 23]) set(col, 9, '?');
  set(22, 5, '?');

  for (const [col, height] of PIPES) {
    for (let row = GROUND_ROW - height; row < GROUND_ROW; row++) {
      set(col, row, 'p');
      set(col + 1, row, 'p');
    }
  }

  for (const col of [77, 79]) set(col, 9, 'B');
  set(78, 9, '?');
  for (let col = 80; col <= 87; col++) set(col, 5, 'B');
  for (let col = 91; col <= 93; col++) set(col, 5, 'B');
  set(94, 5, '?');
  set(94, 9, 'B');
  for (const col of [100, 101]) set(col, 9, 'B');
  for (const col of [106, 109, 112]) set(col, 9, '?');
  set(109, 5, '?');
  set(118, 9, 'B');
  for (let col = 121; col <= 123; col++) set(col, 5, 'B');
  for (const col of [128, 131]) set(col, 5, 'B');
  for (const col of [129, 130]) set(col, 5, '?');
  for (const col of [129, 130]) set(col, 9, 'B');
  for (const col of [168, 169, 171]) set(col, 9, 'B');
  set(170, 9, '?');

  const stairs = (from: number, steps: number, up: boolean) => {
    for (let i = 0; i < steps; i++) {
      const height = up ? i + 1 : steps - i;
      for (let row = GROUND_ROW - height; row < GROUND_ROW; row++) set(from + i, row, 'X');
    }
  };
  stairs(134, 4, true);
  stairs(140, 4, false);
  stairs(148, 5, true);
  stairs(155, 4, false);
  stairs(181, 8, true);
  for (let row = GROUND_ROW - 8; row < GROUND_ROW; row++) set(189, row, 'X');
  set(FLAG_COL, GROUND_ROW - 1, 'X');

  return tiles;
}

function spawnPlayer(): Body {
  return { x: 3 * TILE, y: (GROUND_ROW - 1) * TILE, w: 24, h: 30, vx: 0, vy: 0, onGround: false };
}

function spawnWalkers(): Walker[] {
  return WALKER_COLS.map((col) => ({
    x: col * TILE + 2,
    y: (GROUND_ROW - 1) * TILE + 4,
    w: 28,
    h: 28,
    vx: -WALKER_SPEED,
    vy: 0,
    onGround: false,
    alive: true,
  }));
}

export function createState(): SuperPlumberState {
  return {
    tiles: buildLevel(),
    player: spawnPlayer(),
    walkers: spawnWalkers(),
    input: { left: false, right: false, jump: false },
    camera: 0,
    score: 0,
    coins: 0,
    lives: LIVES,
    time: TIME_LIMIT,
    respawnIn: 0,
    phase: 'playing',
  };
}

export function isSolid(tiles: Tile[][], col: number, row: number): boolean {
  if (col < 0 || col >= COLS) return true;
  if (row < 0 || row >= ROWS) return false;
  return tiles[row][col] !== '.';
}

/** Points for grabbing the flagpole: the higher up, the more it's worth. */
export function flagBonus(y: number): number {
  const top = FLAG_TOP_ROW * TILE;
  const bottom = (GROUND_ROW - 1) * TILE;
  const height = 1 - Math.min(Math.max((y - top) / (bottom - top), 0), 1);
  if (height >= 0.9) return 5000;
  if (height >= 0.6) return 2000;
  if (height >= 0.4) return 800;
  if (height >= 0.2) return 400;
  return 100;
}

/** Hitting a block from below: a '?' block pays out its coin and turns used. */
export function bump(state: SuperPlumberState, col: number, row: number): void {
  if (state.tiles[row]?.[col] !== '?') return;
  state.tiles[row][col] = 'U';
  state.coins += 1;
  state.score += COIN_POINTS;
}

/** Moves a body by its speed, stopping it at solid tiles. Returns the tiles it hit. */
function move(state: SuperPlumberState, body: Body, dt: number) {
  const { tiles } = state;
  let hitWall = false;
  let hitHead: { col: number; row: number } | undefined;

  body.x += body.vx * dt;
  const top = Math.floor(body.y / TILE);
  const bottom = Math.floor((body.y + body.h - 1) / TILE);
  if (body.vx > 0) {
    const col = Math.floor((body.x + body.w) / TILE);
    for (let row = top; row <= bottom; row++) {
      if (isSolid(tiles, col, row)) {
        body.x = col * TILE - body.w;
        hitWall = true;
      }
    }
  } else if (body.vx < 0) {
    const col = Math.floor(body.x / TILE);
    for (let row = top; row <= bottom; row++) {
      if (isSolid(tiles, col, row)) {
        body.x = (col + 1) * TILE;
        hitWall = true;
      }
    }
  }

  body.vy = Math.min(body.vy + GRAVITY * dt, MAX_FALL);
  body.y += body.vy * dt;
  body.onGround = false;
  const left = Math.floor(body.x / TILE);
  const right = Math.floor((body.x + body.w - 1) / TILE);
  if (body.vy > 0) {
    const row = Math.floor((body.y + body.h) / TILE);
    for (let col = left; col <= right; col++) {
      if (isSolid(tiles, col, row)) {
        body.y = row * TILE - body.h;
        body.vy = 0;
        body.onGround = true;
      }
    }
  } else if (body.vy < 0) {
    const row = Math.floor(body.y / TILE);
    // Bump the block nearest the middle of the head.
    const middle = Math.floor((body.x + body.w / 2) / TILE);
    for (const col of [middle, left, right]) {
      if (isSolid(tiles, col, row)) {
        body.y = (row + 1) * TILE;
        body.vy = 0;
        hitHead ??= { col, row };
      }
    }
  }
  return { hitWall, hitHead };
}

function overlaps(a: Body, b: Body): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function loseLife(state: SuperPlumberState): void {
  state.lives -= 1;
  if (state.lives <= 0) state.phase = 'over';
  else state.respawnIn = 1;
}

function respawn(state: SuperPlumberState): void {
  state.tiles = buildLevel();
  state.player = spawnPlayer();
  state.walkers = spawnWalkers();
  state.camera = 0;
  state.time = TIME_LIMIT;
}

/** Advances the game by `dt` seconds. */
export function step(state: SuperPlumberState, dt: number): void {
  if (state.phase !== 'playing') return;
  if (state.respawnIn > 0) {
    state.respawnIn -= dt;
    if (state.respawnIn <= 0) {
      state.respawnIn = 0;
      respawn(state);
    }
    return;
  }

  state.time -= dt / SECONDS_PER_TICK;
  if (state.time <= 0) {
    state.time = 0;
    loseLife(state);
    return;
  }

  const { player, input } = state;
  player.vx = (input.right ? RUN_SPEED : 0) - (input.left ? RUN_SPEED : 0);
  if (input.jump && player.onGround) player.vy = -JUMP_SPEED;
  // Letting go of jump early makes a short hop.
  if (!input.jump && player.vy < -JUMP_SPEED / 3) player.vy = -JUMP_SPEED / 3;

  const wasAbove = player.y + player.h;
  const { hitHead } = move(state, player, dt);
  if (hitHead) bump(state, hitHead.col, hitHead.row);
  if (player.x < state.camera) player.x = state.camera;

  if (player.y > ROWS * TILE) {
    loseLife(state);
    return;
  }

  const awake = state.camera + WIDTH + 2 * TILE;
  for (const walker of state.walkers) {
    if (!walker.alive) continue;
    if (walker.squashed !== undefined) {
      walker.squashed += dt;
      if (walker.squashed > 0.5) walker.alive = false;
      continue;
    }
    if (walker.x > awake) continue;
    if (move(state, walker, dt).hitWall) walker.vx = -walker.vx;
    if (walker.y > ROWS * TILE) walker.alive = false;
  }

  for (const walker of state.walkers) {
    if (!walker.alive || walker.squashed !== undefined || !overlaps(player, walker)) continue;
    if (player.vy > 0 && wasAbove <= walker.y + walker.h / 2) {
      walker.squashed = 0;
      player.vy = -JUMP_SPEED / 2;
      state.score += STOMP_POINTS;
    } else {
      loseLife(state);
      return;
    }
  }

  if (player.x + player.w >= FLAG_COL * TILE) {
    state.score += flagBonus(player.y) + Math.ceil(state.time) * TIME_POINTS;
    state.phase = 'won';
    return;
  }

  const target = player.x - WIDTH / 3;
  state.camera = Math.min(Math.max(state.camera, target), COLS * TILE - WIDTH);
}

function drawTile(ctx: CanvasRenderingContext2D, tile: Tile, x: number, y: number) {
  const { colors } = theme;
  if (tile === '#' || tile === 'X') {
    ctx.fillStyle = colors.wood;
    ctx.fillRect(x, y, TILE, TILE);
    ctx.strokeStyle = colors.background;
    ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
  } else if (tile === 'B') {
    ctx.fillStyle = colors.stripeA;
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = colors.background;
    ctx.fillRect(x, y + TILE / 2 - 1, TILE, 2);
    ctx.fillRect(x + TILE / 2 - 1, y, 2, TILE / 2);
  } else if (tile === '?' || tile === 'U') {
    ctx.fillStyle = tile === '?' ? colors.accent : colors.muted;
    ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
    if (tile === '?') {
      ctx.fillStyle = colors.wood;
      ctx.font = canvasFont('body', 'bold');
      ctx.textAlign = 'center';
      ctx.fillText('?', x + TILE / 2, y + TILE / 2 + 6);
    }
  } else if (tile === 'p') {
    ctx.fillStyle = colors.water;
    ctx.fillRect(x, y, TILE, TILE);
  }
}

function draw(ctx: CanvasRenderingContext2D, state: SuperPlumberState) {
  const { colors } = theme;
  const offsetY = HEIGHT - ROWS * TILE;

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.save();
  ctx.translate(-Math.round(state.camera), offsetY);

  const first = Math.floor(state.camera / TILE);
  const last = Math.min(COLS - 1, first + Math.ceil(WIDTH / TILE) + 1);
  for (let row = 0; row < ROWS; row++) {
    for (let col = first; col <= last; col++) {
      drawTile(ctx, state.tiles[row][col], col * TILE, row * TILE);
    }
  }

  // Flagpole and flag.
  const poleX = FLAG_COL * TILE + TILE / 2;
  ctx.fillStyle = colors.stripeB;
  ctx.fillRect(poleX - 2, FLAG_TOP_ROW * TILE, 4, (GROUND_ROW - 1 - FLAG_TOP_ROW) * TILE);
  ctx.fillStyle = colors.accent;
  ctx.beginPath();
  ctx.arc(poleX, FLAG_TOP_ROW * TILE, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.stripeA;
  ctx.beginPath();
  ctx.moveTo(poleX - 2, FLAG_TOP_ROW * TILE + 8);
  ctx.lineTo(poleX - 34, FLAG_TOP_ROW * TILE + 20);
  ctx.lineTo(poleX - 2, FLAG_TOP_ROW * TILE + 32);
  ctx.fill();

  for (const walker of state.walkers) {
    if (!walker.alive) continue;
    const squashed = walker.squashed !== undefined;
    const h = squashed ? walker.h / 3 : walker.h;
    const y = walker.y + walker.h - h;
    ctx.fillStyle = colors.wood;
    ctx.beginPath();
    ctx.ellipse(walker.x + walker.w / 2, y + h / 2, walker.w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    if (!squashed) {
      ctx.fillStyle = colors.text;
      ctx.fillRect(walker.x + 7, y + 8, 4, 6);
      ctx.fillRect(walker.x + walker.w - 11, y + 8, 4, 6);
    }
  }

  if (state.respawnIn === 0 || Math.floor(state.respawnIn * 10) % 2 === 0) {
    const { player } = state;
    ctx.fillStyle = colors.danger;
    ctx.fillRect(player.x, player.y, player.w, 10);
    ctx.fillStyle = colors.stripeB;
    ctx.fillRect(player.x + 4, player.y + 10, player.w - 8, 8);
    ctx.fillStyle = colors.water;
    ctx.fillRect(player.x, player.y + 18, player.w, player.h - 18);
  }

  ctx.restore();

  ctx.fillStyle = colors.text;
  ctx.font = canvasFont('body', 'bold');
  ctx.textAlign = 'left';
  ctx.fillText(`Score ${state.score}`, 16, 30);
  ctx.textAlign = 'center';
  ctx.fillText(`Coins ${state.coins}   Lives ${state.lives}`, WIDTH / 2, 30);
  ctx.textAlign = 'right';
  ctx.fillText(`Time ${Math.ceil(state.time)}`, WIDTH - 16, 30);

  if (state.phase !== 'playing') {
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    const message = state.phase === 'won' ? 'Level clear!' : 'Game over!';
    ctx.fillText(`${message} You scored ${state.score}`, WIDTH / 2, HEIGHT / 2);
    ctx.fillStyle = colors.text;
    ctx.font = canvasFont('body');
    ctx.fillText('Press Enter or click to play again', WIDTH / 2, HEIGHT / 2 + 40);
  }
}

const KEYS: Record<string, keyof Input> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'jump',
  KeyW: 'jump',
  Space: 'jump',
};

export const superPlumber: CarnivalGame = {
  id: 'super-plumber',
  name: 'Super Plumber',
  description: 'Run, jump and stomp your way through one level to the flagpole.',

  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    let state = createState();
    let scoreRecorded = false;

    const restart = () => {
      if (state.phase === 'playing') return;
      state = createState();
      scoreRecorded = false;
    };
    const onKey = (event: KeyboardEvent) => {
      const control = KEYS[event.code];
      if (control) {
        event.preventDefault();
        state.input[control] = event.type === 'keydown';
      } else if (event.code === 'Enter' && event.type === 'keydown') {
        restart();
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    canvas.addEventListener('pointerdown', restart);

    let frame = 0;
    let last = performance.now();
    const loop = (time: number) => {
      // Cap the step so a background tab doesn't teleport everything.
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      step(state, dt);
      if (state.phase !== 'playing' && !scoreRecorded) {
        recordScore(superPlumber.id, state.score);
        scoreRecorded = true;
      }
      draw(ctx, state);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      canvas.removeEventListener('pointerdown', restart);
    };
  },
};

export default superPlumber;
