import { beforeEach, describe, expect, it } from 'vitest';

import { updateStatusAuras, __statusAuraTestUtils } from './statusAuras.js';

const createParticleStub = (x, y, options = {}) => ({
  x,
  y,
  vx: Math.cos(options.angle ?? 0) * (options.speed ?? 0),
  vy: Math.sin(options.angle ?? 0) * (options.speed ?? 0),
  life: options.life ?? 1,
  color: options.color ?? '#ffffff',
  size: options.size ?? 2,
  fade: options.fade ?? 0.02,
  gravity: options.gravity ?? 0,
  blend: options.blend ?? 'source-over',
});

describe('status aura helpers', () => {
  beforeEach(() => {
    __statusAuraTestUtils.reset();
  });

  it('creates aura batches while the status is active and removes them after expiration', () => {
    const entity = { id: 'mob-1', x: 10, y: 20, size: 14 };
    const state = {
      worldView: { microorganisms: [entity] },
      particles: [],
    };

    const events = [
      {
        targetKind: 'microorganism',
        targetObjectId: 'mob-1',
        status: 'fissure',
        stacks: 2,
        durationMs: 600,
      },
    ];

    updateStatusAuras(state, 0.1, { events, createParticle: createParticleStub, now: 0 });
    expect(__statusAuraTestUtils.getActive().has('mob-1')).toBe(true);

    const previousParticleCount = state.particles.length;
    updateStatusAuras(state, 0.3, { createParticle: createParticleStub, now: 400 });
    expect(state.particles.length).toBeGreaterThanOrEqual(previousParticleCount);

    updateStatusAuras(state, 0.4, { createParticle: createParticleStub, now: 800 });
    expect(__statusAuraTestUtils.getActive().has('mob-1')).toBe(false);
  });

  it('removes the aura when stacks drop to zero', () => {
    const entity = { id: 'mob-2', x: 0, y: 0, size: 12 };
    const state = {
      worldView: { microorganisms: [entity] },
      particles: [],
    };

    const applyEvent = {
      targetKind: 'microorganism',
      targetObjectId: 'mob-2',
      status: 'corrosion',
      stacks: 1,
      durationMs: 800,
    };

    updateStatusAuras(state, 0.05, { events: [applyEvent], createParticle: createParticleStub, now: 0 });
    expect(__statusAuraTestUtils.getActive().has('mob-2')).toBe(true);

    const removalEvent = {
      targetKind: 'microorganism',
      targetObjectId: 'mob-2',
      status: 'corrosion',
      stacks: 0,
      durationMs: 0,
    };

    updateStatusAuras(state, 0.05, { events: [removalEvent], createParticle: createParticleStub, now: 100 });
    expect(__statusAuraTestUtils.getActive().has('mob-2')).toBe(false);
  });
});
