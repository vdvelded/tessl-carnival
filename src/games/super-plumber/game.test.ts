import { describe, expect, it } from 'vitest';
import {
  COIN_POINTS,
  COLS,
  FLAG_COL,
  LIVES,
  ROWS,
  STOMP_POINTS,
  TILE,
  TIME_LIMIT,
  TIME_POINTS,
  buildLevel,
  bump,
  createState,
  flagBonus,
  isSolid,
  step,
  type SuperPlumberState,
} from './game';

/** Runs the game for `seconds` in small steps. */
function run(state: SuperPlumberState, seconds: number) {
  for (let t = 0; t < seconds; t += 1 / 60) step(state, 1 / 60);
}

describe('super plumber', () => {
  it('starts on the ground with full lives, a full clock and no score', () => {
    const state = createState();
    run(state, 0.5);
    expect(state.player.onGround).toBe(true);
    expect(state.lives).toBe(LIVES);
    expect(state.score).toBe(0);
    expect(state.time).toBeLessThan(TIME_LIMIT);
    expect(state.phase).toBe('playing');
  });

  it('builds a level with ground under the start and a flag at the end', () => {
    const tiles = buildLevel();
    expect(tiles).toHaveLength(ROWS);
    expect(tiles[0]).toHaveLength(COLS);
    expect(isSolid(tiles, 3, 13)).toBe(true);
    expect(isSolid(tiles, FLAG_COL, 12)).toBe(true);
    expect(isSolid(tiles, 69, 13)).toBe(false);
  });

  it('runs right and jumps', () => {
    const state = createState();
    run(state, 0.5);
    const startX = state.player.x;
    state.input.right = true;
    run(state, 0.3);
    expect(state.player.x).toBeGreaterThan(startX);
    state.input.jump = true;
    step(state, 1 / 60);
    expect(state.player.vy).toBeLessThan(0);
  });

  it('pays one coin for a question block, and only once', () => {
    const state = createState();
    expect(state.tiles[9][16]).toBe('?');
    bump(state, 16, 9);
    bump(state, 16, 9);
    expect(state.coins).toBe(1);
    expect(state.score).toBe(COIN_POINTS);
    expect(state.tiles[9][16]).toBe('U');
  });

  it('bumps a block when the player jumps into it from below', () => {
    const state = createState();
    run(state, 0.5);
    state.player.x = 16 * TILE + 4;
    state.input.jump = true;
    run(state, 0.5);
    expect(state.tiles[9][16]).toBe('U');
    expect(state.coins).toBe(1);
  });

  it('stomps a walker when landing on it', () => {
    const state = createState();
    const walker = state.walkers[0];
    state.walkers = [walker];
    state.player.x = walker.x;
    state.player.y = walker.y - state.player.h - 2;
    state.player.vy = 200;
    step(state, 1 / 60);
    expect(walker.squashed).toBe(0);
    expect(state.score).toBe(STOMP_POINTS);
    expect(state.lives).toBe(LIVES);
  });

  it('loses a life when a walker runs into the player', () => {
    const state = createState();
    run(state, 0.5);
    const walker = state.walkers[0];
    state.walkers = [walker];
    walker.x = state.player.x + 4;
    walker.y = state.player.y + state.player.h - walker.h;
    step(state, 1 / 60);
    expect(state.lives).toBe(LIVES - 1);
  });

  it('loses a life in a pit, then starts the level again', () => {
    const state = createState();
    state.player.x = 69 * TILE + 4;
    state.player.y = 12 * TILE;
    run(state, 0.5);
    expect(state.lives).toBe(LIVES - 1);
    run(state, 1.1);
    expect(state.player.x).toBe(3 * TILE);
    expect(state.time).toBeGreaterThan(TIME_LIMIT - 5);
  });

  it('ends the game when the last life is lost', () => {
    const state = createState();
    state.lives = 1;
    state.time = 0.01;
    step(state, 0.1);
    expect(state.phase).toBe('over');
  });

  it('wins at the flagpole with a bonus for height and time left', () => {
    const state = createState();
    state.walkers = [];
    run(state, 0.5);
    state.player.x = FLAG_COL * TILE - state.player.w - 2;
    state.input.right = true;
    run(state, 0.5);
    expect(state.phase).toBe('won');
    expect(state.score).toBe(flagBonus(state.player.y) + Math.ceil(state.time) * TIME_POINTS);
  });

  it('pays more for grabbing the flag higher up', () => {
    expect(flagBonus(3 * TILE)).toBe(5000);
    expect(flagBonus(12 * TILE)).toBe(100);
    expect(flagBonus(3 * TILE)).toBeGreaterThan(flagBonus(8 * TILE));
  });

  it('stops changing once the round is over', () => {
    const state = createState();
    state.phase = 'won';
    const x = state.player.x;
    state.input.right = true;
    run(state, 0.5);
    expect(state.player.x).toBe(x);
  });
});
