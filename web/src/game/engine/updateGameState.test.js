import { describe, expect, it, vi } from 'vitest';

import { updateGameState } from './updateGameState';

const createState = (overrides = {}) => {
  const baseOrganism = {
    x: 0,
    y: 0,
    size: 12,
    vx: 0,
    vy: 0,
    speed: 1,
    dashTimer: 0,
    dashCharge: 0,
    maxDashCharge: 100,
    dashChargeRegenRate: 20,
    attackCooldown: 0,
    dashCooldown: 0,
    isDashing: false,
    invulnerable: false,
    invulnerableFromPowerUp: false,
    invulnerableTimer: 0,
    color: '#ffffff',
  };

  const baseState = {
    gameTime: 0,
    lastSpawnTime: 0,
    spawnInterval: 1000,
    enemies: [],
    organicMatter: [],
    powerUps: [],
    obstacles: [],
    nebulas: [],
    projectiles: [],
    effects: [],
    level: 1,
    bossPending: false,
    boss: null,
    worldSize: 1000,
    health: 100,
    maxHealth: 100,
    energy: 0,
    score: 0,
    combo: 0,
    maxCombo: 0,
    uiSyncTimer: 1,
    organism: baseOrganism,
    camera: { x: 0, y: 0 },
  };

  const mergedState = {
    ...baseState,
    ...overrides,
  };

  mergedState.organism = {
    ...baseOrganism,
    ...(overrides.organism || {}),
  };

  return mergedState;
};

const createEnemy = (overrides = {}) => ({
  boss: false,
  behaviorTimer: 0,
  behaviorInterval: 1,
  speed: 0,
  vx: 0,
  vy: 0,
  x: 0,
  y: 0,
  size: 10,
  color: '#ff0000',
  health: 10,
  maxHealth: 10,
  energyReward: 0,
  points: 0,
  phase: 'charge',
  attackTimer: 0,
  attackCooldown: 1,
  dashSpeed: 0,
  dashDuration: 0,
  dashDurationMax: 0,
  ...overrides,
});

describe('updateGameState enemy collisions', () => {
  it('applies finite damage from attack attribute without producing NaN health', () => {
    const state = createState({
      enemies: [
        createEnemy({
          attack: 15,
          x: 0,
          y: 0,
        }),
      ],
    });

    updateGameState({ state, delta: 0.016 });

    expect(state.health).toBe(85);
    expect(Number.isFinite(state.health)).toBe(true);
  });

  it('falls back to safe damage when enemy attack data is invalid', () => {
    const state = createState({
      enemies: [
        createEnemy({
          attack: Number.NaN,
          damage: 'not-a-number',
          baseDamage: undefined,
          x: 0,
          y: 0,
        }),
      ],
    });

    updateGameState({ state, delta: 0.016 });
    expect(state.health).toBe(100);
    expect(Number.isFinite(state.health)).toBe(true);
  });

  it('converts enemy energy rewards to finite numbers before awarding energy', () => {
    const state = createState({
      energy: 10,
      enemies: [
        createEnemy({
          health: 0,
          energyReward: '15',
          points: 25,
        }),
      ],
    });

    updateGameState({ state, delta: 0.016 });

    expect(state.energy).toBe(25);
    expect(Number.isFinite(state.energy)).toBe(true);
  });

  it('ignores invalid energy reward values when enemies are defeated', () => {
    const state = createState({
      energy: 5,
      enemies: [
        createEnemy({
          health: -1,
          energyReward: 'invalid',
        }),
      ],
    });

    updateGameState({ state, delta: 0.016 });

    expect(state.energy).toBe(5);
    expect(Number.isFinite(state.energy)).toBe(true);
  });

  it('counts down invulnerability timer and clears invulnerability when it expires', () => {
    const state = createState({
      organism: {
        invulnerable: true,
        invulnerableTimer: 0.5,
      },
    });

    updateGameState({ state, delta: 1 });

    expect(state.organism.invulnerableTimer).toBe(0);
    expect(state.organism.invulnerable).toBe(false);
  });

  it('preserves invulnerability from power ups when timer expires', () => {
    const state = createState({
      organism: {
        invulnerable: true,
        invulnerableTimer: 0.2,
        invulnerableFromPowerUp: true,
      },
    });

    updateGameState({ state, delta: 0.5 });

    expect(state.organism.invulnerableTimer).toBe(0);
    expect(state.organism.invulnerable).toBe(true);
  });
});

describe('updateGameState evolved enemy behaviours', () => {
  it('fires hostile projectiles for enemies with projectile volley traits', () => {
    const state = createState({
      enemies: [
        createEnemy({
          id: 'volley',
          attack: 12,
          behaviorTraits: {
            projectileVolley: {
              interval: 0.1,
              count: 2,
              speed: 3,
              spread: 0.2,
              damageMultiplier: 0.5,
              life: 1,
              color: '#ff0000',
            },
          },
          projectileCooldown: 0,
        }),
      ],
    });

    const helpers = {
      createEffect: vi.fn(),
      playSound: vi.fn(),
    };

    updateGameState({ state, delta: 0.2, helpers });

    expect(state.projectiles.length).toBeGreaterThan(0);
    expect(state.projectiles.every((proj) => proj.hostile)).toBe(true);
  });

  it('applies support aura buffs to nearby allies', () => {
    const supportEnemy = createEnemy({
      id: 'supporter',
      x: 0,
      y: 0,
      attack: 8,
      behaviorTraits: {
        supportAura: {
          interval: 0.1,
          duration: 1,
          radius: 150,
          modifiers: { attackMultiplier: 1.5 },
          includeSelf: true,
        },
      },
    });

    const ally = createEnemy({
      id: 'ally',
      x: 40,
      y: 0,
      attack: 10,
    });

    const state = createState({
      enemies: [supportEnemy, ally],
    });

    const helpers = {
      createEffect: vi.fn(),
      playSound: vi.fn(),
    };

    updateGameState({ state, delta: 0.2, helpers });

    const buffedAlly = state.enemies.find((enemy) => enemy.id === 'ally');
    expect(buffedAlly).toBeDefined();
    expect(buffedAlly.attack).toBeGreaterThan(10);
    expect(helpers.createEffect).toHaveBeenCalledWith(
      expect.anything(),
      supportEnemy.x,
      supportEnemy.y,
      'buff',
      supportEnemy.color
    );
    expect(helpers.playSound).toHaveBeenCalledWith('buff');
  });
});

