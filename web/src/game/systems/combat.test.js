import { describe, expect, it, vi } from 'vitest';

import { createInitialState } from '../state/initialState';
import { performAttack } from './combat';

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
