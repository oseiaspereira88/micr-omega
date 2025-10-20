import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  backgroundRenderer: { render: vi.fn() },
  organismRenderer: { render: vi.fn() },
  effectsRenderer: { render: vi.fn(() => undefined) },
  enemyRenderer: { render: vi.fn() },
}));

vi.mock('./backgroundRenderer.js', () => ({ backgroundRenderer: mocks.backgroundRenderer }));
vi.mock('./organismRenderer.js', () => ({ organismRenderer: mocks.organismRenderer }));
vi.mock('./effectsRenderer.js', () => ({ effectsRenderer: mocks.effectsRenderer }));
vi.mock('./enemyRenderer.js', () => ({ enemyRenderer: mocks.enemyRenderer }));

import { enemyRenderer } from './enemyRenderer.js';
import { renderFrame } from './renderFrame.js';

const createMockContext = () => ({
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  scale: vi.fn(),
  beginPath: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  canvas: { width: 1920, height: 1080 },
  globalAlpha: 1,
  fillStyle: '#000000',
  strokeStyle: '#000000',
  lineWidth: 1,
  shadowBlur: 0,
  shadowColor: '#000000',
});

const createState = () => ({
  background: {},
  worldView: {
    microorganisms: [
      {
        id: 'micro-1',
        x: 120,
        y: 80,
        size: 14,
        color: '#1b2739',
        coreColor: '#213049',
        outerColor: '#1b2739',
        shadowColor: '#0d141f',
        health: { current: 6, max: 12 },
        healthValue: 6,
        maxHealth: 12,
        animPhase: 0.3,
        boss: true,
        name: 'Amoeba Nova',
        level: 9,
        species: 'amoeba',
        aggression: 'hostile',
        attributes: { speed: 1.1 },
        palette: {
          base: '#1b2739',
          core: '#213049',
          outer: '#1b2739',
          label: '#f8fbff',
          labelBackground: 'rgba(12, 17, 29, 0.82)',
        },
        label: 'Amoeba Nova · Lv 9',
        labelColor: '#f8fbff',
        hpFillColor: '#2c3f5c',
        hpBorderColor: '#0b111b',
      },
    ],
  },
  players: [],
  combatIndicators: [],
  localPlayerId: 'p1',
  pulsePhase: 0,
  effects: [],
  particles: [],
});

const createCamera = () => ({
  x: 0,
  y: 0,
  offsetX: 0,
  offsetY: 0,
  viewport: { width: 1920, height: 1080 },
});

describe('renderFrame', () => {
  beforeEach(() => {
    mocks.enemyRenderer.render.mockClear();
    mocks.backgroundRenderer.render.mockClear();
    mocks.organismRenderer.render.mockClear();
    mocks.effectsRenderer.render.mockClear();
  });

  it('forwards microorganisms as enemies to the enemy renderer', () => {
    const ctx = createMockContext();
    const state = createState();
    const camera = createCamera();

    renderFrame(ctx, state, camera);

    expect(enemyRenderer.render).toHaveBeenCalledTimes(1);
    const [, enemyState] = enemyRenderer.render.mock.calls[0];
    expect(enemyState.enemies).toHaveLength(1);
    expect(enemyState.enemies[0]).toMatchObject({
      id: 'micro-1',
      x: 120,
      y: 80,
      size: 14,
      color: '#1b2739',
      coreColor: '#213049',
      outerColor: '#1b2739',
      shadowColor: '#0d141f',
      health: 6,
      maxHealth: 12,
      boss: true,
      name: 'Amoeba Nova',
      level: 9,
      species: 'amoeba',
      aggression: 'hostile',
      attributes: { speed: 1.1 },
      label: 'Amoeba Nova · Lv 9',
    });
    expect(enemyState.enemies[0].animPhase).toBeCloseTo(state.worldView.microorganisms[0].animPhase);
    expect(enemyState.enemies[0].palette).toMatchObject({
      base: '#1b2739',
      core: '#213049',
      label: '#f8fbff',
      labelBackground: 'rgba(12, 17, 29, 0.82)',
    });
    expect(enemyState.enemies[0].labelColor).toBe('#f8fbff');
  });
});
