import { describe, expect, it } from 'vitest';

import { updateGameState } from './updateGameState';

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

    expect(renderState.worldView.microorganisms[0]).toMatchObject({
      id: 'micro-1',
      color: '#88c0ff',
    });
    expect(renderState.worldView.obstacles[0]).toMatchObject({ id: 'obstacle-1', width: 30, height: 60 });
    expect(renderState.combatIndicators).not.toHaveLength(0);
  });
});
