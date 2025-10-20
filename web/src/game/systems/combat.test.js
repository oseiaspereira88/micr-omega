import { describe, expect, it, vi } from 'vitest';

import { createInitialState } from '../state/initialState';
import { performAttack, updateEnemy } from './combat';
import { STATUS_EFFECTS } from '../../shared/combat';
import { STATUS_METADATA } from './statusEffects';

const createEnemy = (state, overrides = {}) => ({
  x: state.organism.x + 20,
  y: state.organism.y,
  vx: 0,
  vy: 0,
  size: 16,
  speed: 0,
  attack: 0,
  defense: 0,
  stability: 1,
  behavior: 'aggressive',
  element: state.organism.element,
  color: '#ffffff',
  health: 200,
  maxHealth: 200,
  points: 10,
  attackCooldown: 0,
  dynamicModifiers: {},
  resistances: {},
  ...overrides,
});

const createDotEnemy = (state, { status = STATUS_EFFECTS.CORROSION, stacks = 1 } = {}) => {
  const enemy = createEnemy(state, {
    speed: 0,
    vx: 0,
    vy: 0,
    status: {
      active: {
        [status]: {
          stacks,
          remaining: 5,
          potency: 0,
          tickBuffer: 0,
        },
      },
      controlDr: { value: 0, timer: 0 },
    },
  });
  return enemy;
};

describe('performAttack particle effects', () => {
  it('does not emit particles when true damage is zero or below', () => {
    const state = createInitialState();
    state.organism.attack = 0;
    state.organism.attackCooldown = 0;
    state.enemies = [createEnemy(state)];

    const createParticle = vi.fn();

    performAttack(state, { createParticle, rng: () => 0.6 });

    expect(createParticle).not.toHaveBeenCalled();
  });

  it('scales particle counts with true damage output', () => {
    const lowDamageState = createInitialState();
    lowDamageState.organism.attack = 6;
    lowDamageState.organism.attackCooldown = 0;
    lowDamageState.enemies = [createEnemy(lowDamageState)];

    const lowParticle = vi.fn();
    performAttack(lowDamageState, { createParticle: lowParticle, rng: () => 0.6 });

    expect(lowParticle).toHaveBeenCalledTimes(1);
    const lowBurst = lowParticle.mock.calls[0][1];
    expect(Array.isArray(lowBurst)).toBe(true);
    const lowCount = lowBurst.length;
    expect(lowCount).toBeGreaterThan(0);

    const highDamageState = createInitialState();
    highDamageState.organism.attack = 40;
    highDamageState.organism.attackCooldown = 0;
    highDamageState.enemies = [createEnemy(highDamageState)];

    const highParticle = vi.fn();
    performAttack(highDamageState, { createParticle: highParticle, rng: () => 0.6 });

    expect(highParticle).toHaveBeenCalledTimes(1);
    const highBurst = highParticle.mock.calls[0][1];
    expect(Array.isArray(highBurst)).toBe(true);
    const highCount = highBurst.length;

    expect(highCount).toBeGreaterThan(lowCount);
  });
});

describe('updateEnemy status drip behavior', () => {
  it('applies aura tuned drips and rate limits sustained low damage ticks', () => {
    const state = createInitialState();
    state.debug = {};
    const status = STATUS_EFFECTS.PHOTOLESION;
    const enemy = createDotEnemy(state, { status, stacks: 1 });
    const createParticle = vi.fn();
    const createEffect = vi.fn();

    for (let i = 0; i < 20; i += 1) {
      updateEnemy(state, { createParticle, createEffect }, enemy, 0.1);
    }

    expect(createParticle).toHaveBeenCalled();
    expect(createParticle.mock.calls.length).toBeGreaterThan(0);
    expect(createParticle.mock.calls.length).toBeLessThan(20);

    const particles = createParticle.mock.calls[0][1];
    expect(Array.isArray(particles)).toBe(true);
    expect(particles.length).toBeGreaterThan(0);

    const expectedColor = STATUS_METADATA[status].aura.color;
    particles.forEach((particle) => {
      expect(particle.color).toBe(expectedColor);
      expect(particle.life).toBeLessThan(1);
    });

    const telemetry = state.debug.particleCounts?.statusDrip;
    expect(telemetry).toBeDefined();
    expect(telemetry?.emissions).toBe(createParticle.mock.calls.length);
    expect(telemetry?.particles).toBeGreaterThan(0);
    expect(telemetry?.suppressed).toBeGreaterThan(0);
  });

  it('emits more frequently and with denser drips for high normalized damage ticks', () => {
    const lowState = createInitialState();
    lowState.debug = {};
    const lowEnemy = createDotEnemy(lowState, { status: STATUS_EFFECTS.CORROSION, stacks: 1 });
    const lowCreateParticle = vi.fn();

    for (let i = 0; i < 20; i += 1) {
      updateEnemy(lowState, { createParticle: lowCreateParticle }, lowEnemy, 0.1);
    }

    const lowTelemetry = lowState.debug.particleCounts?.statusDrip ?? {
      emissions: 0,
      particles: 0,
    };
    const lowEmissions = lowTelemetry.emissions || 1;
    const lowAverage = lowTelemetry.particles / lowEmissions;

    const highState = createInitialState();
    highState.debug = {};
    const highEnemy = createDotEnemy(highState, { status: STATUS_EFFECTS.CORROSION, stacks: 4 });
    const highCreateParticle = vi.fn();

    for (let i = 0; i < 20; i += 1) {
      updateEnemy(highState, { createParticle: highCreateParticle }, highEnemy, 0.1);
    }

    const highTelemetry = highState.debug.particleCounts?.statusDrip ?? {
      emissions: 0,
      particles: 0,
    };
    const highEmissions = highTelemetry.emissions || 1;
    const highAverage = highTelemetry.particles / highEmissions;

    expect(highCreateParticle.mock.calls.length).toBeGreaterThanOrEqual(
      lowCreateParticle.mock.calls.length,
    );
    expect(highAverage).toBeGreaterThan(lowAverage);
  });
});
