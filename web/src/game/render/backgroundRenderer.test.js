import { describe, expect, it, vi } from 'vitest';

import { backgroundRenderer } from './backgroundRenderer.js';

const createContextStub = () => {
  const createGradient = () => ({ addColorStop: vi.fn() });

  return {
    canvas: { width: 800, height: 600 },
    createRadialGradient: vi.fn(() => createGradient()),
    createLinearGradient: vi.fn(() => createGradient()),
    fillRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    clearRect: vi.fn(),
    fillStyle: '',
    globalAlpha: 1,
    shadowBlur: 0,
    shadowColor: '',
  };
};

describe('backgroundRenderer', () => {
  it('applies pending spawn offsets before rendering particles', () => {
    const ctx = createContextStub();
    const particle = {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      depth: 0.5,
      size: 2,
      opacity: 0.5,
      hue: 200,
      pulsePhase: 0,
      pulseSpeed: 1,
      spawnOffsetX: 150,
      spawnOffsetY: -50,
      anchorX: 320,
      anchorY: 260,
    };

    const state = {
      backgroundLayers: [],
      lightRays: [],
      microorganisms: [],
      glowParticles: [],
      floatingParticles: [particle],
    };

    const camera = {
      x: 320,
      y: 260,
      offsetX: 100,
      offsetY: 80,
      viewport: { width: 640, height: 480 },
    };

    backgroundRenderer.render(ctx, state, camera);

    expect(particle.spawnOffsetX).toBeNull();
    expect(particle.spawnOffsetY).toBeNull();
    expect(particle.x).toBeCloseTo(470);
    expect(particle.y).toBeCloseTo(210);
  });
});
