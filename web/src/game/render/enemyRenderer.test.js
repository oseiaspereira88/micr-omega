import { beforeEach, describe, expect, it, vi } from 'vitest';

import { enemyRenderer } from './enemyRenderer.js';

const createMockContext = () => {
  const radialGradientMock = { addColorStop: vi.fn() };
  const linearGradientMock = { addColorStop: vi.fn() };
  let fillStyle = '#000000';
  let strokeStyle = '#000000';
  const fillTextMock = vi.fn(function fillTextRecorder(text, x, y) {
    fillTextMock.styles.push(this.fillStyle);
  });
  fillTextMock.styles = [];
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
    fillText: fillTextMock,
    measureText: vi.fn((text) => ({ width: text.length * 7 })),
    createRadialGradient: vi.fn(() => radialGradientMock),
    createLinearGradient: vi.fn(() => linearGradientMock),
    canvas: { width: 800, height: 600 },
    globalAlpha: 1,
    get fillStyle() {
      return fillStyle;
    },
    set fillStyle(value) {
      fillStyle = value;
    },
    get strokeStyle() {
      return strokeStyle;
    },
    set strokeStyle(value) {
      strokeStyle = value;
    },
    lineWidth: 1,
    shadowBlur: 0,
    shadowColor: '#000000',
    font: '',
    textAlign: '',
    textBaseline: '',
    __fillTextStyles: fillTextMock.styles,
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
      color: '#1b2739',
      coreColor: '#23324d',
      outerColor: '#1b2739',
      shadowColor: '#0d141f',
      name: 'Specimen',
      level: 5,
      species: 'amoeba',
      palette: {
        base: '#1b2739',
        core: '#23324d',
        outer: '#1b2739',
        shadow: '#0d141f',
        accent: '#30486d',
        detail: '#0d141f',
        glow: '#3d5e8d',
        hpFill: '#2c3f5c',
        hpBorder: '#0b111b',
        labelBackground: 'rgba(12, 17, 29, 0.82)',
      },
      label: 'Specimen · Lv 5',
      labelColor: '#f8fbff',
      hpFillColor: '#2c3f5c',
      hpBorderColor: '#0b111b',
      animPhase: 0,
    };

    enemyRenderer.render(ctx, { enemies: [enemy] }, camera);

    expect(ctx.fillText).toHaveBeenCalledWith(expect.stringContaining('Lv 5'), expect.any(Number), expect.any(Number));
    expect(ctx.createLinearGradient).toHaveBeenCalled();
    expect(enemy.animPhase).toBeGreaterThan(0);
    const lastFillStyle = ctx.__fillTextStyles[ctx.__fillTextStyles.length - 1];
    expect(lastFillStyle).toBe('#f8fbff');
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
