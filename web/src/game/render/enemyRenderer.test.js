import { beforeEach, describe, expect, it, vi } from 'vitest';

import { enemyRenderer } from './enemyRenderer.js';

const createMockContext = () => {
  const radialGradientMock = { addColorStop: vi.fn() };
  const linearGradientMock = { addColorStop: vi.fn() };
  return {
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    closePath: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn((text) => ({ width: text.length * 7 })),
    createRadialGradient: vi.fn(() => radialGradientMock),
    createLinearGradient: vi.fn(() => linearGradientMock),
    canvas: { width: 800, height: 600 },
    globalAlpha: 1,
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    shadowBlur: 0,
    shadowColor: '#000000',
    font: '',
    textAlign: '',
    textBaseline: '',
  };
};

const createCamera = () => ({
  offsetX: 0,
  offsetY: 0,
  viewport: { width: 800, height: 600 },
  zoom: 1,
  x: 0,
  y: 0,
});

describe('enemyRenderer', () => {
  let ctx;
  let camera;

  beforeEach(() => {
    ctx = createMockContext();
    camera = createCamera();
  });

  it('renders labels and health bars even at full health', () => {
    const enemy = {
      id: 'enemy-1',
      x: 160,
      y: 220,
      size: 18,
      health: 20,
      maxHealth: 20,
      color: '#88c0ff',
      coreColor: '#9ad4ff',
      outerColor: '#88c0ff',
      shadowColor: '#36546f',
      name: 'Specimen',
      level: 5,
      species: 'amoeba',
      palette: {
        base: '#88c0ff',
        core: '#9ad4ff',
        outer: '#88c0ff',
        shadow: '#2d4055',
        accent: '#addbff',
        detail: '#2d4055',
        glow: '#b6e4ff',
        hpFill: '#8fc6ff',
        hpBorder: '#1f2b3a',
        label: '#0c111e',
        labelBackground: 'rgba(12, 17, 29, 0.82)',
      },
      label: 'Specimen · Lv 5',
      labelColor: '#0c111e',
      hpFillColor: '#8fc6ff',
      hpBorderColor: '#1f2b3a',
      animPhase: 0,
    };

    enemyRenderer.render(ctx, { enemies: [enemy] }, camera);

    expect(ctx.fillText).toHaveBeenCalledWith(expect.stringContaining('Lv 5'), expect.any(Number), expect.any(Number));
    expect(ctx.createLinearGradient).toHaveBeenCalled();
    expect(enemy.animPhase).toBeGreaterThan(0);
  });

  it('adds directional detailing for paramecium species', () => {
    const enemy = {
      id: 'enemy-2',
      x: 0,
      y: 0,
      size: 16,
      health: 8,
      maxHealth: 10,
      color: '#a3ffa3',
      coreColor: '#8fe88f',
      outerColor: '#a3ffa3',
      shadowColor: '#2d402d',
      name: 'Paramecium',
      level: 3,
      species: 'paramecium',
      palette: {
        base: '#a3ffa3',
        core: '#8fe88f',
        outer: '#a3ffa3',
        shadow: '#2d402d',
        accent: '#bfffbf',
        detail: '#274027',
        glow: '#d4ffd4',
        hpFill: '#abf7ab',
        hpBorder: '#203020',
        label: '#0c111e',
        labelBackground: 'rgba(12, 17, 29, 0.82)',
      },
      animPhase: 0,
    };

    enemyRenderer.render(ctx, { enemies: [enemy] }, camera);

    expect(ctx.createLinearGradient).toHaveBeenCalledTimes(2);
    expect(ctx.quadraticCurveTo).toHaveBeenCalled();
  });
});
