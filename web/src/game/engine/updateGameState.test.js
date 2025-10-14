import { describe, expect, it } from 'vitest';

import {
  updateGameState,
  calculateExperienceFromEvents,
  aggregateDrops,
  applyProgressionEvents,
  XP_DISTRIBUTION,
} from './updateGameState';

const createRenderState = () => ({
  camera: {
    x: 0,
    y: 0,
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    viewport: { width: 640, height: 480 },
  },
  pulsePhase: 0,
  background: {
    backgroundLayers: [],
    lightRays: [],
    microorganisms: [],
    glowParticles: [],
    floatingParticles: [],
  },
  worldView: {
    microorganisms: [],
    organicMatter: [],
    obstacles: [],
    roomObjects: [],
  },
  playersById: new Map(),
  playerList: [],
  combatIndicators: [],
  notifications: [],
  effects: [],
  particles: [],
  lastMovementIntent: { x: 0, y: 0, active: false },
});

const createPlayer = (overrides = {}) => ({
  id: overrides.id ?? 'p1',
  name: overrides.name ?? 'Player',
  connected: true,
  score: overrides.score ?? 0,
  combo: overrides.combo ?? 0,
  lastActiveAt: overrides.lastActiveAt ?? 0,
  position: overrides.position ?? { x: 10, y: 12 },
  movementVector: overrides.movementVector ?? { x: 0, y: 0 },
  orientation: overrides.orientation ?? { angle: 0 },
  health: overrides.health ?? { current: 90, max: 100 },
  combatStatus:
    overrides.combatStatus ?? {
      state: 'idle',
      targetPlayerId: null,
      targetObjectId: null,
      lastAttackAt: null,
    },
  combatAttributes:
    overrides.combatAttributes ?? {
      attack: 1,
      defense: 1,
      speed: 1,
      range: 1,
    },
});

const createSharedState = (overrides = {}) => ({
  playerId: overrides.playerId ?? 'p1',
  remotePlayers: {
    all: overrides.players ?? [
      createPlayer({
        id: 'p1',
        name: 'Local',
        position: { x: 25, y: 30 },
        movementVector: { x: 1, y: 0 },
        combatStatus: { state: 'engaged', targetPlayerId: 'p2', targetObjectId: null, lastAttackAt: null },
      }),
      createPlayer({ id: 'p2', name: 'Remote', position: { x: -20, y: -10 } }),
    ],
  },
  players: undefined,
  world: overrides.world ?? {
    microorganisms: [
      {
        id: 'micro-1',
        kind: 'microorganism',
        species: 'amoeba',
        position: { x: 100, y: 200 },
        movementVector: { x: 0.1, y: 0 },
        orientation: { angle: 0 },
        health: { current: 4, max: 8 },
        aggression: 'neutral',
        attributes: {},
      },
    ],
    organicMatter: [
      {
        id: 'organic-1',
        kind: 'organic_matter',
        position: { x: -40, y: 12 },
        quantity: 9,
        nutrients: {},
      },
    ],
    obstacles: [
      {
        id: 'obstacle-1',
        kind: 'obstacle',
        position: { x: 0, y: 0 },
        size: { x: 30, y: 60 },
        orientation: { angle: Math.PI / 4 },
        impassable: true,
      },
    ],
    roomObjects: [
      {
        id: 'room-1',
        kind: 'room_object',
        type: 'control',
        position: { x: 80, y: -30 },
        state: {},
      },
    ],
  },
});

describe('updateGameState', () => {
  it('aggregates movement commands when intent changes', () => {
    const renderState = createRenderState();
    const sharedState = createSharedState();

    const first = updateGameState({
      renderState,
      sharedState,
      delta: 0.016,
      movementIntent: { x: 1, y: 0 },
      actionBuffer: { attacks: [] },
    });

    expect(first.commands.movement).toMatchObject({ vector: { x: 1, y: 0 } });

    const second = updateGameState({
      renderState,
      sharedState,
      delta: 0.016,
      movementIntent: { x: 1, y: 0 },
      actionBuffer: { attacks: [] },
    });

    expect(second.commands.movement).toBeNull();
  });

  it('flushes attack queue into command batch', () => {
    const renderState = createRenderState();
    const sharedState = createSharedState();
    const actionBuffer = { attacks: [{ kind: 'basic', timestamp: 123 }] };

    const result = updateGameState({
      renderState,
      sharedState,
      delta: 0.016,
      movementIntent: { x: 0, y: 0 },
      actionBuffer,
    });

    expect(result.commands.attacks).toHaveLength(1);
    expect(actionBuffer.attacks).toHaveLength(0);
  });

  it('interpolates remote players and updates camera', () => {
    const renderState = createRenderState();
    const sharedState = createSharedState();

    const result = updateGameState({
      renderState,
      sharedState,
      delta: 0.5,
      movementIntent: { x: 0, y: 0 },
      actionBuffer: { attacks: [] },
    });

    expect(renderState.playerList).toHaveLength(2);
    const localPlayer = renderState.playerList.find((player) => player.id === 'p1');
    expect(localPlayer).toBeDefined();
    expect(localPlayer.renderPosition.x).toBeGreaterThan(0);
    expect(renderState.camera.x).toBeGreaterThan(0);
    expect(result.localPlayerId).toBe('p1');
  });

  it('builds HUD snapshot with opponents list', () => {
    const renderState = createRenderState();
    const sharedState = createSharedState();

    const { hudSnapshot } = updateGameState({
      renderState,
      sharedState,
      delta: 0.016,
      movementIntent: { x: 0, y: 0 },
      actionBuffer: { attacks: [] },
    });

    expect(hudSnapshot.health).toBe(90);
    expect(hudSnapshot.opponents).toHaveLength(1);
    expect(hudSnapshot.opponents[0].name).toBe('Remote');
    expect(hudSnapshot.xp).toEqual(
      expect.objectContaining({ current: expect.any(Number), next: expect.any(Number) })
    );
    expect(hudSnapshot.geneticMaterial).toEqual(
      expect.objectContaining({ current: expect.any(Number), total: expect.any(Number) })
    );
  });

  it('maps world entities into renderable state', () => {
    const renderState = createRenderState();
    const sharedState = createSharedState();

    updateGameState({
      renderState,
      sharedState,
      delta: 0.016,
      movementIntent: { x: 0, y: 0 },
      actionBuffer: { attacks: [] },
    });

    const microorganism = renderState.worldView.microorganisms[0];
    expect(microorganism).toMatchObject({
      id: 'micro-1',
      color: '#88c0ff',
      health: 4,
      maxHealth: 8,
    });
    expect(typeof microorganism.coreColor).toBe('string');
    expect(typeof microorganism.outerColor).toBe('string');
    expect(typeof microorganism.shadowColor).toBe('string');
    expect(renderState.worldView.obstacles[0]).toMatchObject({ id: 'obstacle-1', width: 30, height: 60 });
    expect(renderState.combatIndicators).not.toHaveLength(0);
  });
});

describe('progression utilities', () => {
  it('calculates experience from damage, objectives and kills', () => {
    const events = {
      damage: [{ amount: 100 }, { amount: 50, multiplier: 1.5 }],
      objectives: [{ xp: 200 }, {}],
      kills: [{ dropTier: 'elite' }, { dropTier: 'boss', xpMultiplier: 1.5 }],
    };

    const xpGain = calculateExperienceFromEvents(events, XP_DISTRIBUTION);

    expect(xpGain).toBeGreaterThan(0);
    expect(xpGain).toBeCloseTo(100 * XP_DISTRIBUTION.perDamage + 50 * 1.5 * XP_DISTRIBUTION.perDamage + 200 + XP_DISTRIBUTION.perObjective + XP_DISTRIBUTION.baseKillXp.elite + XP_DISTRIBUTION.baseKillXp.boss * 1.5, 5);
  });

  it('aggregates drops with advantage and pity progression', () => {
    const kills = [
      { dropTier: 'minion', rolls: { fragment: 0.05, fragmentAmount: 0.3, stableGene: 0.99, mg: 0.4 } },
      { dropTier: 'boss', advantage: true, rolls: { fragment: 0.8, stableGene: 0.2, mg: 0.2 } },
    ];

    const result = aggregateDrops(kills, {
      rng: () => 0.01,
      initialPity: { fragment: 4, stableGene: 2 },
    });

    expect(result.geneticMaterial).toBeGreaterThan(0);
    expect(result.fragments.minor + result.fragments.major + result.fragments.apex).toBeGreaterThanOrEqual(1);
    expect(result.stableGenes.apex + result.stableGenes.major + result.stableGenes.minor).toBeGreaterThanOrEqual(0);
    expect(result.pity.fragment).toBeGreaterThanOrEqual(0);
  });

  it('applies progression events onto HUD snapshot', () => {
    const hud = {
      xp: { current: 0, next: 120, total: 0 },
      geneticMaterial: { current: 10, total: 20 },
      geneFragments: { minor: 0, major: 0, apex: 0 },
      stableGenes: { minor: 0, major: 0, apex: 0 },
      dropPity: { fragment: 0, stableGene: 0 },
      recentRewards: { xp: 0, geneticMaterial: 0, fragments: 0, stableGenes: 0 },
    };

    const events = {
      damage: [{ amount: 40 }],
      objectives: [{ xp: 60 }],
      kills: [{ dropTier: 'minion', rolls: { fragment: 0.02, fragmentAmount: 0.5, stableGene: 0.9, mg: 0.3 } }],
      dropPity: { fragment: 2, stableGene: 1 },
    };

    const updated = applyProgressionEvents(hud, events, {
      rng: () => 0.01,
    });

    expect(updated.xp.current).toBeGreaterThan(0);
    expect(updated.geneticMaterial.current).toBeGreaterThan(10);
    expect(updated.geneFragments.minor + updated.geneFragments.major + updated.geneFragments.apex).toBeGreaterThanOrEqual(0);
    expect(updated.dropPity.fragment).toBeGreaterThanOrEqual(0);
    expect(updated.recentRewards.xp).toBeGreaterThan(0);
  });
});
