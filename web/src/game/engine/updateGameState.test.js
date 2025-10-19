import { describe, expect, it, vi } from 'vitest';

import {
  updateGameState,
  calculateExperienceFromEvents,
  aggregateDrops,
  applyProgressionEvents,
  XP_DISTRIBUTION,
  calculateDamageWithResistances,
  ensureHealth,
} from './updateGameState';
import { DROP_TABLES } from '../config/enemyTemplates';
import { archetypePalettes } from '../config/archetypePalettes';
import { AFFINITY_TYPES, ELEMENT_TYPES } from '../../shared/combat';

const createRenderState = () => ({
  camera: {
    x: 0,
    y: 0,
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    viewport: { width: 640, height: 480 },
    initialized: false,
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
  playerAppearanceById: new Map(),
  playerList: [],
  combatIndicators: [],
  notifications: [],
  effects: [],
  particles: [],
  lastMovementIntent: { x: 0, y: 0, active: false },
  lastMovementAngle: 0,
  progressionSequences: new Map(),
});

const createPlayer = (overrides = {}) => ({
  id: overrides.id ?? 'p1',
  name: overrides.name ?? 'Player',
  connected: true,
  score: overrides.score ?? 0,
  combo: overrides.combo ?? 0,
  energy: overrides.energy ?? 0,
  xp: overrides.xp ?? 0,
  geneticMaterial: overrides.geneticMaterial ?? 0,
  dashCharge: overrides.dashCharge ?? 100,
  dashCooldownMs: overrides.dashCooldownMs ?? 0,
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
  skillList: overrides.skillList ?? [],
  currentSkill: overrides.currentSkill ?? null,
  skillCooldowns: overrides.skillCooldowns ?? {},
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
  world: overrides.world
    ? { damagePopups: [], ...overrides.world }
    : {
      microorganisms: [
      {
        id: 'micro-1',
        kind: 'microorganism',
        species: 'amoeba',
        name: 'Amber Strand',
        level: 2,
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
      damagePopups: [],
    },
  progression: overrides.progression ?? { players: {} },
  damagePopups: overrides.damagePopups ?? [],
});

describe('ensureHealth', () => {
  it('clamps health values within safe bounds', () => {
    expect(ensureHealth({ current: 150, max: 100 })).toEqual({ current: 100, max: 100 });
    expect(ensureHealth({ current: -5, max: 0 })).toEqual({ current: 0, max: 1 });
    expect(ensureHealth({ current: 20 })).toEqual({ current: 20, max: 20 });
  });
});

describe('calculateDamageWithResistances', () => {
  it('applies RPS advantage, affinity and resistances', () => {
    const result = calculateDamageWithResistances({
      baseDamage: 100,
      attackerElement: ELEMENT_TYPES.BIO,
      attackElement: ELEMENT_TYPES.BIO,
      attackerAffinity: AFFINITY_TYPES.ATTUNED,
      targetElement: ELEMENT_TYPES.CHEMICAL,
      targetResistances: { [ELEMENT_TYPES.BIO]: 0.2 },
      combo: { value: 5, multiplier: 1.2 },
    });

    expect(result.relation).toBe('advantage');
    expect(result.damage).toBe(127);
    expect(result.multiplier).toBeCloseTo(1.2696, 3);
    expect(result.comboApplied).toBe(true);
  });

  it('handles disadvantage, divergent affinity and negative resistances', () => {
    const result = calculateDamageWithResistances({
      baseDamage: 80,
      attackerElement: ELEMENT_TYPES.ELECTRIC,
      attackElement: ELEMENT_TYPES.ELECTRIC,
      attackerAffinity: AFFINITY_TYPES.DIVERGENT,
      targetElement: ELEMENT_TYPES.THERMAL,
      targetResistances: { [ELEMENT_TYPES.ELECTRIC]: -0.25 },
      combo: { multiplier: 1.5, apply: false },
    });

    expect(result.relation).toBe('disadvantage');
    expect(result.comboApplied).toBe(false);
    expect(result.damage).toBe(81);
    expect(result.multiplier).toBeCloseTo(1.0125, 3);
  });

  it('applies penetration and DR caps before elemental multipliers', () => {
    const result = calculateDamageWithResistances({
      baseDamage: 200,
      targetDefense: 150,
      penetration: 50,
      damageReductionCap: 0.5,
      stability: 1.2,
      attackerElement: ELEMENT_TYPES.ACID,
      attackElement: ELEMENT_TYPES.ACID,
      targetElement: ELEMENT_TYPES.KINETIC,
      targetResistances: { [ELEMENT_TYPES.ACID]: 0.1 },
    });

    expect(result.damage).toBe(103);
    expect(result.breakdown.resistance).toBeCloseTo(0.9, 2);
    expect(result.breakdown.rps).toBeCloseTo(1.15, 2);
  });

  it('does not reduce damage when combo multipliers fall below one', () => {
    const hook = vi.fn();
    const result = calculateDamageWithResistances({
      baseDamage: 100,
      combo: { multiplier: 0.4 },
      hooks: { onComboApplied: hook },
    });

    expect(result.damage).toBe(100);
    expect(result.breakdown.combo).toBe(1);
    expect(result.multiplier).toBe(1);
    expect(hook).toHaveBeenCalledWith(
      expect.objectContaining({ multiplier: 0.4, applied: true })
    );
  });
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

    expect(first.commands.movement).toMatchObject({
      vector: { x: 1, y: 0 },
      orientation: { angle: 0 },
    });

    const second = updateGameState({
      renderState,
      sharedState,
      delta: 0.016,
      movementIntent: { x: 1, y: 0 },
      actionBuffer: { attacks: [] },
    });

    expect(second.commands.movement).toBeNull();
  });

  it('preserves last movement angle when stopping and updates local renderer', () => {
    const renderState = createRenderState();
    const sharedState = createSharedState();

    const moving = updateGameState({
      renderState,
      sharedState,
      delta: 0.016,
      movementIntent: { x: 0, y: 2 },
      actionBuffer: { attacks: [] },
    });

    expect(moving.commands.movement).toMatchObject({
      vector: { x: 0, y: 1 },
      orientation: { angle: Math.PI / 2 },
    });

    const stopping = updateGameState({
      renderState,
      sharedState,
      delta: 0.016,
      movementIntent: { x: 0, y: 0 },
      actionBuffer: { attacks: [] },
    });

    expect(stopping.commands.movement).toMatchObject({
      vector: { x: 0, y: 0 },
      orientation: { angle: Math.PI / 2 },
    });

    const localPlayer = renderState.playerList.find((player) => player.isLocal);
    expect(localPlayer?.orientation).toBeCloseTo(Math.PI / 2, 5);
  });

  it('flushes attack queue into command batch with combat metadata', () => {
    const renderState = createRenderState();
    const sharedState = createSharedState();
    const actionBuffer = {
      attacks: [
        {
          kind: 'skill',
          timestamp: 123,
          targetPlayerId: 'p2',
          targetObjectId: 'micro-1',
          state: 'engaged',
          damage: 42,
          resultingHealth: { current: 58, max: 120 },
        },
      ],
    };

    const result = updateGameState({
      renderState,
      sharedState,
      delta: 0.016,
      movementIntent: { x: 0, y: 0 },
      actionBuffer,
    });

    expect(result.commands.attacks).toHaveLength(1);
    expect(result.commands.attacks[0]).toMatchObject({
      kind: 'skill',
      timestamp: 123,
      targetPlayerId: 'p2',
      targetObjectId: 'micro-1',
      state: 'engaged',
      damage: 42,
      resultingHealth: { current: 58, max: 120 },
    });
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

  it('creates a renderer-ready playerList from synchronized players', () => {
    const renderState = createRenderState();
    const localPlayer = createPlayer({
      id: 'pilot-local',
      name: 'Pilot',
      position: { x: 12, y: 6 },
      movementVector: { x: 0.75, y: 0 },
      orientation: { angle: Math.PI / 4 },
      combatStatus: {
        state: 'engaged',
        targetPlayerId: 'raider-remote',
        targetObjectId: null,
        lastAttackAt: 4200,
      },
    });
    const remotePlayer = createPlayer({
      id: 'raider-remote',
      name: 'Raider',
      position: { x: -8, y: -20 },
      movementVector: { x: 0, y: 1 },
      orientation: { angle: Math.PI / 2 },
      health: { current: 14, max: 20 },
    });
    const sharedState = createSharedState({
      playerId: localPlayer.id,
      players: [localPlayer, remotePlayer],
    });

    updateGameState({
      renderState,
      sharedState,
      delta: 0.1,
      movementIntent: { x: 0, y: 0 },
      actionBuffer: { attacks: [] },
    });

    // Snapshot mínimo: jogador local engajado e adversário remoto para alimentar o renderer.
    expect(renderState.playerList.map((player) => player.id)).toEqual([
      'raider-remote',
      'pilot-local',
    ]);
    const localRenderPlayer = renderState.playerList.find((player) => player.id === localPlayer.id);
    const remoteRenderPlayer = renderState.playerList.find((player) => player.id === remotePlayer.id);

    expect(localRenderPlayer).toMatchObject({
      id: 'pilot-local',
      isLocal: true,
      name: 'Pilot',
      combatStatus: expect.objectContaining({
        state: 'engaged',
        targetPlayerId: 'raider-remote',
      }),
    });
    expect(localRenderPlayer.palette).toEqual(
      expect.objectContaining({ base: expect.any(String), accent: expect.any(String), label: expect.any(String) })
    );
    expect(localRenderPlayer.renderPosition).toEqual(
      expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) })
    );

    expect(remoteRenderPlayer).toMatchObject({
      id: 'raider-remote',
      isLocal: false,
      name: 'Raider',
    });
    expect(remoteRenderPlayer.palette).toEqual(
      expect.objectContaining({ base: expect.any(String), accent: expect.any(String), label: expect.any(String) })
    );

    expect(renderState.combatIndicators).toEqual([
      expect.objectContaining({ id: 'pilot-local', targetPlayerId: 'raider-remote' }),
    ]);
  });

  it('applies archetype appearance data to render players', () => {
    const renderState = createRenderState();
    const virusAppearance = archetypePalettes.virus;
    const localPlayer = createPlayer({ id: 'pilot-local', name: 'Pilot' });
    const remotePlayer = {
      ...createPlayer({ id: 'arch-player', name: 'Virion' }),
      selectedArchetype: 'virus',
    };
    const sharedState = createSharedState({
      playerId: localPlayer.id,
      players: [localPlayer, remotePlayer],
    });

    updateGameState({
      renderState,
      sharedState,
      delta: 0.016,
      movementIntent: { x: 0, y: 0 },
      actionBuffer: { attacks: [] },
    });

    const appearance = renderState.playerAppearanceById.get(remotePlayer.id);
    expect(appearance).toBeDefined();
    expect(appearance).toMatchObject({ form: virusAppearance.form });
    expect(appearance.hybridForms).toEqual(expect.arrayContaining(virusAppearance.hybridForms));
    expect(appearance.palette).toEqual(expect.objectContaining(virusAppearance.palette));

    const remoteRenderPlayer = renderState.playerList.find((player) => player.id === remotePlayer.id);
    expect(remoteRenderPlayer).toBeDefined();
    expect(remoteRenderPlayer.form).toBe(virusAppearance.form);
    expect(remoteRenderPlayer.hybridForms).toEqual(expect.arrayContaining(virusAppearance.hybridForms));
    expect(remoteRenderPlayer.palette).toEqual(
      expect.objectContaining({
        base: virusAppearance.palette.base,
        secondary: virusAppearance.palette.secondary,
        tertiary: virusAppearance.palette.tertiary,
      })
    );
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

  it('keeps the highest known level when server snapshot is stale', () => {
    const renderState = createRenderState();
    renderState.hudSnapshot = {
      level: 3,
      confirmedLevel: 3,
      xp: { current: 0, next: 120, total: 0, level: 3 },
      geneticMaterial: { current: 0, total: 0 },
      characteristicPoints: { total: 0, available: 0, spent: 0, perLevel: [] },
      evolutionSlots: {
        small: { used: 0, max: 0 },
        medium: { used: 0, max: 0 },
        large: { used: 0, max: 0 },
        macro: { used: 0, max: 0 },
      },
      reroll: { baseCost: 25, cost: 25, count: 0, pity: 0 },
      dropPity: { fragment: 0, stableGene: 0 },
      recentRewards: { xp: 0, geneticMaterial: 0, fragments: 0, stableGenes: 0 },
      resourceBag: { level: 3 },
    };

    const localPlayer = createPlayer({ id: 'p1', name: 'Local' });
    localPlayer.resources = { level: 1 };

    const sharedState = createSharedState({
      playerId: 'p1',
      players: [localPlayer],
    });

    const { hudSnapshot } = updateGameState({
      renderState,
      sharedState,
      delta: 0.016,
      movementIntent: { x: 0, y: 0 },
      actionBuffer: { attacks: [] },
    });

    expect(hudSnapshot.level).toBe(3);
    expect(hudSnapshot.confirmedLevel).toBeGreaterThanOrEqual(3);
    expect(hudSnapshot.resourceBag.level).toBe(3);
  });

  it('keeps the confirmed XP when the resource bag lags behind', () => {
    const renderState = createRenderState();
    renderState.hudSnapshot = {
      level: 4,
      confirmedLevel: 4,
      xp: { current: 50, next: 180, total: 450, level: 4 },
      geneticMaterial: { current: 0, total: 0 },
      characteristicPoints: { total: 0, available: 0, spent: 0, perLevel: [] },
      evolutionSlots: {
        small: { used: 0, max: 0 },
        medium: { used: 0, max: 0 },
        large: { used: 0, max: 0 },
        macro: { used: 0, max: 0 },
      },
      reroll: { baseCost: 25, cost: 25, count: 0, pity: 0 },
      dropPity: { fragment: 0, stableGene: 0 },
      recentRewards: { xp: 0, geneticMaterial: 0, fragments: 0, stableGenes: 0 },
      resourceBag: {
        level: 4,
        xp: { current: 50, next: 180, total: 450, level: 4 },
      },
    };

    const localPlayer = createPlayer({ id: 'p1', name: 'Local' });
    localPlayer.resources = {
      level: 4,
      xp: { current: 10, next: 120, total: 300, level: 3 },
    };

    const sharedState = createSharedState({
      playerId: 'p1',
      players: [localPlayer],
    });

    const { hudSnapshot } = updateGameState({
      renderState,
      sharedState,
      delta: 0.016,
      movementIntent: { x: 0, y: 0 },
      actionBuffer: { attacks: [] },
    });

    expect(hudSnapshot.xp).toEqual({ current: 50, next: 180, total: 450, level: 4 });
    expect(hudSnapshot.resourceBag.xp).toEqual({
      current: 50,
      next: 180,
      total: 450,
      level: 4,
    });
  });

  it('persists HUD data between frames and normalizes short hex colors', () => {
    const renderState = createRenderState();
    const previousHud = {
      energy: 42,
      level: 4,
      score: 99,
      health: 88,
      maxHealth: 120,
      dashCharge: 77,
      combo: 3,
      maxCombo: 7,
      recentRewards: { xp: 1, geneticMaterial: 2, fragments: 3, stableGenes: 4 },
      xp: { current: 10, next: 120, total: 10, level: 2 },
      geneticMaterial: { current: 5, total: 15, bonus: 1 },
      characteristicPoints: { total: 2, available: 1, spent: 1, perLevel: [1] },
      geneFragments: { minor: 1, major: 2, apex: 3 },
      stableGenes: { minor: 0, major: 1, apex: 0 },
      evolutionSlots: {
        small: { used: 1, max: 2 },
        medium: { used: 0, max: 1 },
        large: { used: 0, max: 1 },
      },
      reroll: { baseCost: 30, cost: 45, count: 2, pity: 1 },
      dropPity: { fragment: 2, stableGene: 3 },
      evolutionMenu: {
        activeTier: 'macro',
        options: { small: ['a'], medium: ['b'], large: [], macro: ['c'] },
      },
      archetypeSelection: { activeTier: 'medium', options: { small: ['a'], medium: ['b'], large: [] } },
      selectedArchetype: 'guardian',
      statusEffects: [{ type: 'shield', stacks: 1 }],
      element: ELEMENT_TYPES.BIO,
      affinity: AFFINITY_TYPES.NEUTRAL,
      resistances: { [ELEMENT_TYPES.BIO]: 0.1 },
      cameraZoom: 1.1,
      notifications: [],
    };
    renderState.hudSnapshot = previousHud;
    renderState.notifications = Array.from({ length: 7 }, (_, index) => ({
      id: index,
      text: `note-${index}`,
    }));

    const localPlayer = createPlayer({ id: 'p1', name: 'Local' });
    delete localPlayer.combo;

    const sharedState = createSharedState({
      playerId: 'p1',
      players: [localPlayer],
      world: {
        microorganisms: [
          {
            id: 'micro-short-hex',
            kind: 'microorganism',
            species: 'mystic',
            name: 'Hex Lumen',
            level: 4,
            position: { x: 0, y: 0 },
            movementVector: { x: 0, y: 0 },
            orientation: { angle: 0 },
            health: { current: 2, max: 4 },
            color: '#0f0',
          },
        ],
        organicMatter: [],
        obstacles: [],
        roomObjects: [],
      },
    });

    const result = updateGameState({
      renderState,
      sharedState,
      delta: 0.016,
      movementIntent: { x: 0, y: 0 },
      actionBuffer: { attacks: [] },
    });

    expect(result.hudSnapshot.energy).toBe(localPlayer.energy);
    expect(result.hudSnapshot.dashCharge).toBe(100);
    expect(result.hudSnapshot.combo).toBe(1);
    expect(result.hudSnapshot.maxCombo).toBe(7);
    expect(result.hudSnapshot.recentRewards).toEqual(previousHud.recentRewards);
    expect(result.hudSnapshot.recentRewards).not.toBe(previousHud.recentRewards);
    expect(result.hudSnapshot.dropPity).toEqual({ fragment: 0, stableGene: 0 });
    expect(result.hudSnapshot.dropPity).not.toBe(previousHud.dropPity);
    expect(result.hudSnapshot.geneFragments).toEqual({ minor: 0, major: 0, apex: 0 });
    expect(result.hudSnapshot.geneFragments).not.toBe(previousHud.geneFragments);
    expect(result.hudSnapshot.stableGenes).toEqual({ minor: 0, major: 0, apex: 0 });
    expect(result.hudSnapshot.stableGenes).not.toBe(previousHud.stableGenes);
    expect(result.hudSnapshot.notifications).toHaveLength(5);
    expect(result.hudSnapshot.notifications.map((note) => note.text)).toEqual([
      'note-2',
      'note-3',
      'note-4',
      'note-5',
      'note-6',
    ]);
    expect(result.hudSnapshot.notifications).not.toBe(renderState.notifications);
    expect(result.hudSnapshot.xp).toMatchObject({ current: 10, total: 10 });
    expect(result.hudSnapshot.xp).not.toBe(previousHud.xp);
    expect(result.hudSnapshot.geneticMaterial).toMatchObject({ current: 0, total: 0 });
    expect(result.hudSnapshot.statusEffects).toEqual(previousHud.statusEffects);
    expect(result.hudSnapshot.statusEffects).not.toBe(previousHud.statusEffects);
    expect(result.hudSnapshot.evolutionSlots).toEqual({
      small: { used: 1, max: 2 },
      medium: { used: 0, max: 1 },
      large: { used: 0, max: 1 },
      macro: { used: 0, max: 0 },
    });
    expect(result.hudSnapshot.evolutionSlots).not.toBe(previousHud.evolutionSlots);
    expect(result.hudSnapshot.evolutionMenu).toEqual(previousHud.evolutionMenu);
    expect(result.hudSnapshot.archetypeSelection).toEqual(previousHud.archetypeSelection);
    expect(result.hudSnapshot.selectedArchetype).toBe(previousHud.selectedArchetype);
    expect(renderState.hudSnapshot).toBe(result.hudSnapshot);
    expect(renderState.worldView.microorganisms[0].color).toBe('#00ff00');
  });

  it('preserves archetype selection arrays when carrying HUD data forward', () => {
    const renderState = createRenderState();
    const previousHud = {
      archetypeSelection: { pending: true, options: ['virus', 'bacteria'] },
    };
    renderState.hudSnapshot = previousHud;

    const sharedState = createSharedState();

    const { hudSnapshot } = updateGameState({
      renderState,
      sharedState,
      delta: 0.016,
      movementIntent: { x: 0, y: 0 },
      actionBuffer: { attacks: [] },
    });

    expect(Array.isArray(hudSnapshot.archetypeSelection.options)).toBe(true);
    expect(hudSnapshot.archetypeSelection.options).toEqual(['virus', 'bacteria']);
  });

  it('maps microorganisms into renderer-friendly descriptors', () => {
    const renderState = createRenderState();
    const sharedState = createSharedState({
      // Snapshot mínimo multiplayer: jogador local, rival remoto e um único microrganismo hostil.
      world: {
        microorganisms: [
          {
            id: 'hostile-micro-1',
            species: 'rotifer',
            name: 'Prime Rotifer',
            level: 7,
            position: { x: 64, y: -32 },
            movementVector: { x: -0.2, y: 0.4 },
            orientation: { angle: 0 },
            health: { current: 3, max: 9 },
            classification: 'boss',
            aggression: 'hostile',
            attributes: { speed: 1.4, damage: 2.2 },
          },
        ],
        organicMatter: [
          {
            id: 'nutrient-1',
            kind: 'organic_matter',
            position: { x: 8, y: 12 },
            quantity: 4,
            nutrients: {},
          },
        ],
        obstacles: [
          {
            id: 'wall-1',
            kind: 'obstacle',
            position: { x: 0, y: 0 },
            size: { x: 24, y: 48 },
            orientation: { angle: Math.PI / 6 },
            impassable: true,
          },
        ],
        roomObjects: [
          {
            id: 'console-1',
            kind: 'room_object',
            type: 'control',
            position: { x: -12, y: 20 },
            state: {},
          },
        ],
      },
    });

    updateGameState({
      renderState,
      sharedState,
      delta: 0.016,
      movementIntent: { x: 0, y: 0 },
      actionBuffer: { attacks: [] },
    });

    const microorganism = renderState.worldView.microorganisms[0];
    expect(microorganism).toMatchObject({
      id: 'hostile-micro-1',
      x: 64,
      y: -32,
      vx: -0.2,
      vy: 0.4,
      color: '#ffa3d0',
      outerColor: '#ffa3d0',
      health: 3,
      maxHealth: 9,
      boss: true,
      opacity: 0.6,
      depth: 0.5,
      name: 'Prime Rotifer',
      level: 7,
      label: 'Prime Rotifer · Lv 7',
      species: 'rotifer',
      aggression: 'hostile',
    });
    expect(microorganism.size).toBeCloseTo(Math.sqrt(9) * 2, 5);
    expect(typeof microorganism.coreColor).toBe('string');
    expect(typeof microorganism.shadowColor).toBe('string');
    expect(typeof microorganism.labelColor).toBe('string');
    expect(typeof microorganism.hpFillColor).toBe('string');
    expect(microorganism.attributes).toEqual({ speed: 1.4, damage: 2.2 });
    expect(microorganism.palette).toMatchObject({ base: '#ffa3d0', core: expect.any(String) });

    const initialPhase = microorganism.animPhase;

    sharedState.world.microorganisms[0] = {
      ...sharedState.world.microorganisms[0],
      movementVector: { x: 0.3, y: -0.1 },
      health: { current: 1, max: 9 },
    };

    updateGameState({
      renderState,
      sharedState,
      delta: 0.016,
      movementIntent: { x: 0, y: 0 },
      actionBuffer: { attacks: [] },
    });

    const updatedMicroorganism = renderState.worldView.microorganisms[0];
    expect(updatedMicroorganism.animPhase).toBeCloseTo(initialPhase, 5);
    expect(updatedMicroorganism.vx).toBeCloseTo(0.3, 5);
    expect(updatedMicroorganism.vy).toBeCloseTo(-0.1, 5);
    expect(updatedMicroorganism.health).toBe(1);

    expect(renderState.worldView.obstacles[0]).toMatchObject({
      id: 'wall-1',
      width: 24,
      height: 48,
      orientation: Math.PI / 6,
    });
    expect(renderState.worldView.organicMatter[0]).toMatchObject({ id: 'nutrient-1', quantity: 4 });
    expect(renderState.worldView.roomObjects[0]).toMatchObject({ id: 'console-1', type: 'control' });
  });

  it('marks the HUD as game over when the local player health reaches zero', () => {
    const renderState = createRenderState();
    const sharedState = createSharedState({
      playerId: 'local',
      players: [
        createPlayer({
          id: 'local',
          name: 'Local Hero',
          health: { current: 0, max: 120 },
          dashCharge: 12,
        }),
      ],
    });

    const { hudSnapshot } = updateGameState({
      renderState,
      sharedState,
      delta: 0.016,
      movementIntent: { x: 0, y: 0 },
      actionBuffer: { attacks: [] },
    });

    expect(hudSnapshot.gameOver).toBe(true);
    expect(hudSnapshot.dashCharge).toBe(12);
  });

  it('propagates NPC combat decisions and loot through helpers', () => {
    const renderState = createRenderState();
    const sharedState = createSharedState({
      world: {
        biome: 'delta',
        microorganisms: [
          {
            id: 'npc-virus',
            species: 'virus',
            position: { x: 0, y: 0 },
            movementVector: { x: 0, y: 0 },
            health: { current: 8, max: 8 },
            attack: 12,
            defense: 1,
            element: ELEMENT_TYPES.BIO,
            dropTier: 'minion',
            dropProfile: DROP_TABLES.minion,
            baseDropProfile: DROP_TABLES.minion,
          },
          {
            id: 'npc-bacteria',
            species: 'bacteria',
            position: { x: 14, y: 0 },
            movementVector: { x: 0, y: 0 },
            health: { current: 4, max: 4 },
            attack: 4,
            defense: 0,
            element: ELEMENT_TYPES.CHEMICAL,
            dropTier: 'minion',
            dropProfile: DROP_TABLES.minion,
            baseDropProfile: DROP_TABLES.minion,
          },
        ],
      },
    });

    const events = [];
    const drops = [];

    updateGameState({
      renderState,
      sharedState,
      delta: 0.2,
      movementIntent: { x: 0, y: 0 },
      actionBuffer: { attacks: [] },
      helpers: {
        rng: () => 0.05,
        onNpcEvents: (payload) => events.push(...payload),
        onNpcDrops: (payload) => drops.push(...payload),
      },
    });

    expect(events.some((event) => event.type === 'attack')).toBe(true);
    expect(events.some((event) => event.type === 'kill')).toBe(true);
    expect(renderState.worldView.microorganisms.length).toBe(1);
    expect(Array.isArray(renderState.worldView.microorganisms[0].scars)).toBe(true);
    expect(drops.length).toBeGreaterThan(0);
    expect(renderState.aiMemory).toBeDefined();
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

    expect(updated.xp.current).toBe(0);
    expect(updated.geneticMaterial.current).toBe(10);
    expect(updated.geneFragments).toEqual(hud.geneFragments);
    const expectedPity = aggregateDrops(events.kills, {
      rng: () => 0.01,
      initialPity: events.dropPity,
    }).pity;
    expect(updated.dropPity).toEqual(expectedPity);
    expect(updated.recentRewards.xp).toBeGreaterThan(0);
    expect(updated.recentRewards.geneticMaterial).toBeGreaterThan(0);
  });

  it('applies progression kills once per sequence when updating game state', () => {
    const renderState = createRenderState();
    renderState.hudSnapshot = {
      xp: { current: 0, next: 120, total: 0 },
      geneticMaterial: { current: 0, total: 0, bonus: 0 },
      geneFragments: { minor: 0, major: 0, apex: 0 },
      stableGenes: { minor: 0, major: 0, apex: 0 },
      dropPity: { fragment: 0, stableGene: 0 },
      recentRewards: { xp: 0, geneticMaterial: 0, fragments: 0, stableGenes: 0 },
    };

    const sharedState = createSharedState({
      progression: {
        players: {
          p1: {
            sequence: 1,
            dropPity: { fragment: 0, stableGene: 0 },
            kills: [
              {
                dropTier: 'minion',
                rolls: { fragment: 0.02, fragmentAmount: 0.3, stableGene: 0.4, mg: 0.2 },
              },
            ],
          },
        },
      },
    });

    const first = updateGameState({
      renderState,
      sharedState,
      delta: 0.16,
      movementIntent: { x: 0, y: 0 },
      actionBuffer: { attacks: [] },
      helpers: { rng: () => 0.5 },
    });

    expect(first.hudSnapshot.xp.current).toBe(0);
    expect(first.hudSnapshot.geneticMaterial.current).toBe(0);
    expect(first.hudSnapshot.recentRewards.xp).toBeGreaterThan(0);
    expect(first.hudSnapshot.recentRewards.geneticMaterial).toBeGreaterThan(0);

    const rewardsAfterFirst = { ...first.hudSnapshot.recentRewards };

    const second = updateGameState({
      renderState,
      sharedState,
      delta: 0.16,
      movementIntent: { x: 0, y: 0 },
      actionBuffer: { attacks: [] },
      helpers: { rng: () => 0.5 },
    });

    expect(second.hudSnapshot.xp.current).toBe(0);
    expect(second.hudSnapshot.geneticMaterial.current).toBe(0);
    expect(second.hudSnapshot.recentRewards).toEqual(rewardsAfterFirst);

    const nextState = createSharedState({
      progression: {
        players: {
          p1: {
            sequence: 2,
            dropPity: { fragment: 0, stableGene: 0 },
            kills: [
              {
                dropTier: 'minion',
                rolls: { fragment: 0.1, fragmentAmount: 0.6, stableGene: 0.3, mg: 0.4 },
              },
            ],
          },
        },
      },
    });

    const third = updateGameState({
      renderState,
      sharedState: nextState,
      delta: 0.16,
      movementIntent: { x: 0, y: 0 },
      actionBuffer: { attacks: [] },
      helpers: { rng: () => 0.5 },
    });

    expect(third.hudSnapshot.recentRewards.xp).toBeGreaterThan(
      rewardsAfterFirst.xp,
    );
    expect(third.hudSnapshot.recentRewards.geneticMaterial).toBeGreaterThan(
      rewardsAfterFirst.geneticMaterial,
    );
  });
});
