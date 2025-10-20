import { act, render, waitFor } from '@testing-library/react';
import React, { useEffect, useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import useGameLoop from './useGameLoop';

const mocks = vi.hoisted(() => {
  const listeners = new Set();

  return {
    updateGameState: vi.fn(() => ({
      commands: [],
      localPlayerId: null,
      hudSnapshot: null,
    })),
    renderFrame: vi.fn(() => null),
    soundEffectsFactory: vi.fn(() => ({ playSound: vi.fn() })),
    particleFactory: vi.fn((x, y, colorOrOptions, size) => {
      if (x && typeof x === 'object') {
        const particle = x;
        const px = Number.isFinite(particle.x) ? particle.x : 0;
        const py = Number.isFinite(particle.y) ? particle.y : 0;
        const life = Number.isFinite(particle.life) ? particle.life : 1;
        return [
          {
            x: px,
            y: py,
            life,
            vx: Number.isFinite(particle.vx) ? particle.vx : 0,
            vy: Number.isFinite(particle.vy) ? particle.vy : 0,
            color: typeof particle.color === 'string' ? particle.color : '#ffffff',
            size: Number.isFinite(particle.size) ? particle.size : 1,
          },
        ];
      }

      const px = Number.isFinite(x) ? x : 0;
      const py = Number.isFinite(y) ? y : 0;
      const options = colorOrOptions && typeof colorOrOptions === 'object' ? colorOrOptions : null;
      const color =
        typeof colorOrOptions === 'string'
          ? colorOrOptions
          : typeof options?.color === 'string'
            ? options.color
            : '#ffffff';
      const particleSize = Number.isFinite(size)
        ? size
        : Number.isFinite(options?.size)
          ? options.size
          : 1;
      const life = Number.isFinite(options?.life) ? options.life : 1;

      return [
        {
          x: px,
          y: py,
          life,
          vx: 0,
          vy: 0,
          color,
          size: particleSize,
        },
      ];
    }),
    restartGame: vi.fn(),
    selectArchetype: vi.fn(),
    checkEvolution: vi.fn(),
    gameStoreState: {},
    gameStoreListeners: listeners,
    addNotification: vi.fn((notifications = [], text) => [
      ...notifications,
      { id: `mock-${notifications.length}`, text },
    ]),
    actualSystems: null,
  };
});

vi.mock('./updateGameState', () => ({
  updateGameState: mocks.updateGameState,
}));

vi.mock('../render/renderFrame', () => ({
  renderFrame: (...args) => mocks.renderFrame(...args),
}));

vi.mock('../audio/soundEffects', () => ({
  createSoundEffects: (...args) => mocks.soundEffectsFactory(...args),
}));

vi.mock('../effects/particles', () => ({
  createParticle: (...args) => mocks.particleFactory(...args),
}));

vi.mock('../ui/notifications', () => ({
  addNotification: (...args) => mocks.addNotification(...args),
  default: (...args) => mocks.addNotification(...args),
}));

vi.mock('../systems', async (importOriginal) => {
  const actual = await importOriginal();
  mocks.actualSystems = actual;
  if (typeof actual.checkEvolution === 'function') {
    mocks.checkEvolution.mockImplementation((...args) => actual.checkEvolution(...args));
  }
  return {
    ...actual,
    restartGame: (...args) => mocks.restartGame(...args),
    selectArchetype: (...args) => mocks.selectArchetype(...args),
    checkEvolution: (...args) => mocks.checkEvolution(...args),
  };
});

vi.mock('../../store/gameStore', () => ({
  gameStore: {
    getState: () => mocks.gameStoreState,
    subscribe: (listener) => {
      mocks.gameStoreListeners.add(listener);
      return () => {
        mocks.gameStoreListeners.delete(listener);
      };
    },
  },
}));

const createCanvas = () => {
  const canvas = document.createElement('canvas');
  const context = {
    resetTransform: vi.fn(),
    setTransform: vi.fn(),
    scale: vi.fn(),
    clearRect: vi.fn(),
  };
  canvas.getContext = vi.fn(() => context);

  Object.defineProperty(canvas, 'clientWidth', { value: 320, configurable: true });
  Object.defineProperty(canvas, 'clientHeight', { value: 200, configurable: true });

  return canvas;
};

const HookWrapper = ({ canvas, dispatch, settings, onReady }) => {
  const canvasRef = useRef(canvas);

  useEffect(() => {
    canvasRef.current = canvas;
  }, [canvas]);

  const api = useGameLoop({ canvasRef, dispatch, settings });

  useEffect(() => {
    if (typeof onReady === 'function') {
      onReady(api);
    }
  }, [api, onReady]);

  return null;
};

describe('useGameLoop timing safeguards', () => {
  let originalRequestAnimationFrame;
  let originalCancelAnimationFrame;
  let rafCallback;
  let rafId;
  let performanceNowSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    mocks.updateGameState.mockClear();
    mocks.renderFrame.mockClear();
    mocks.soundEffectsFactory.mockClear();
    mocks.particleFactory.mockClear();
    mocks.selectArchetype.mockClear();
    mocks.addNotification.mockClear();
    mocks.checkEvolution.mockClear();
    performanceNowSpy = vi.spyOn(performance, 'now').mockReturnValue(0);
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    if (typeof mocks.actualSystems?.checkEvolution === 'function') {
      mocks.checkEvolution.mockImplementation((...args) =>
        mocks.actualSystems.checkEvolution(...args)
      );
    }

    mocks.updateGameState.mockImplementation(() => ({
      commands: [],
      localPlayerId: null,
      hudSnapshot: null,
    }));

    originalRequestAnimationFrame = window.requestAnimationFrame;
    originalCancelAnimationFrame = window.cancelAnimationFrame;

    rafCallback = undefined;
    rafId = 0;

    window.requestAnimationFrame = vi.fn((callback) => {
      rafCallback = callback;
      rafId += 1;
      return rafId;
    });

    window.cancelAnimationFrame = vi.fn();
  });

  afterEach(() => {
    if (originalRequestAnimationFrame) {
      window.requestAnimationFrame = originalRequestAnimationFrame;
    } else {
      delete window.requestAnimationFrame;
    }

    if (originalCancelAnimationFrame) {
      window.cancelAnimationFrame = originalCancelAnimationFrame;
    } else {
      delete window.cancelAnimationFrame;
    }

    performanceNowSpy?.mockRestore();
    consoleWarnSpy?.mockRestore();
  });

  it('clamps the delta passed to updateGameState after long pauses', async () => {
    const canvas = createCanvas();
    const dispatch = vi.fn();

    render(<HookWrapper canvas={canvas} dispatch={dispatch} />);

    await waitFor(() => {
      expect(typeof rafCallback).toBe('function');
    });

    expect(mocks.updateGameState).toHaveBeenCalledTimes(1);
    expect(mocks.updateGameState.mock.calls[0][0].delta).toBe(0);

    const firstFrame = rafCallback;

    act(() => {
      firstFrame(16);
    });

    expect(mocks.updateGameState).toHaveBeenCalledTimes(2);
    expect(mocks.updateGameState.mock.calls[1][0].delta).toBeCloseTo(0.016, 3);

    const secondFrame = rafCallback;

    act(() => {
      secondFrame(5016);
    });

    expect(mocks.updateGameState).toHaveBeenCalledTimes(3);
    expect(mocks.updateGameState.mock.calls[2][0].delta).toBeCloseTo(0.1, 5);

    const thirdFrame = rafCallback;

    act(() => {
      thirdFrame(5032);
    });

    expect(mocks.updateGameState).toHaveBeenCalledTimes(4);
    expect(mocks.updateGameState.mock.calls[3][0].delta).toBeGreaterThan(0);
    expect(mocks.updateGameState.mock.calls[3][0].delta).toBeLessThan(0.1);
    expect(mocks.updateGameState.mock.calls[3][0].delta).toBeCloseTo(0.016, 3);
  });

  it('applies archetype selection through the progression system', async () => {
    const canvas = createCanvas();
    const dispatch = vi.fn();
    const onReady = vi.fn();
    const onArchetypeSelect = vi.fn();

    mocks.selectArchetype.mockImplementation((state, helpers, archetypeKey) => {
      state.selectedArchetype = archetypeKey;
      state.archetypeSelection = { pending: false, options: ['virus', 'bacteria'] };
      state.energy = 42;
      state.health = 123;
      state.maxHealth = 150;
      state.level = 5;
      state.element = 'bio';
      state.affinity = 'neutral';
      state.resistances = { bio: 0.1 };
      state.elementLabel = 'Bio';
      state.affinityLabel = 'Neutro';
      state.organism = {
        ...(state.organism || {}),
        attack: 9,
        defense: 7,
        speed: 1.2,
        range: 80,
        attackRange: 80,
      };
      helpers.syncState?.(state);
    });

    render(
      <HookWrapper
        canvas={canvas}
        dispatch={dispatch}
        settings={{ onArchetypeSelect }}
        onReady={onReady}
      />
    );

    await waitFor(() => {
      expect(onReady).toHaveBeenCalled();
    });

    const api = onReady.mock.calls[0][0];

    dispatch.mockClear();
    onArchetypeSelect.mockClear();

    act(() => {
      api.selectArchetype('virus');
    });

    expect(mocks.selectArchetype).toHaveBeenCalledTimes(1);
    expect(mocks.selectArchetype.mock.calls[0][2]).toBe('virus');

    const syncCall = dispatch.mock.calls.find(([action]) => action?.type === 'SYNC_STATE');
    expect(syncCall?.[0]?.payload).toMatchObject({
      selectedArchetype: 'virus',
      energy: 42,
      health: 123,
      maxHealth: 150,
      element: 'bio',
      affinity: 'neutral',
      resistances: { bio: 0.1 },
    });

    expect(onArchetypeSelect).toHaveBeenCalledWith(
      'virus',
      expect.objectContaining({
        health: 123,
        maxHealth: 150,
        combatAttributes: expect.objectContaining({
          attack: 9,
          defense: 7,
          speed: 1.2,
          range: 80,
        }),
      })
    );
  });

  it('rechecks evolution when the XP snapshot still exceeds the next threshold', async () => {
    const canvas = createCanvas();
    const dispatch = vi.fn();
    const xpSnapshot = { current: 900, total: 1000, next: 100 };
    let capturedState = null;

    mocks.checkEvolution.mockImplementation((state) => {
      state.level = (Number(state.level) || 1) + 1;
    });

    mocks.updateGameState.mockImplementation(({ renderState }) => {
      capturedState = renderState;
      return {
        commands: [],
        localPlayerId: null,
        hudSnapshot: {
          xp: { ...xpSnapshot },
          level: renderState?.level ?? 1,
        },
      };
    });

    render(<HookWrapper canvas={canvas} dispatch={dispatch} />);

    try {
      await waitFor(() => {
        expect(typeof rafCallback).toBe('function');
        expect(mocks.checkEvolution).toHaveBeenCalledTimes(1);
      });

      expect(capturedState?.level).toBe(2);

      act(() => {
        rafCallback(16);
      });

      expect(mocks.checkEvolution).toHaveBeenCalledTimes(2);
      expect(capturedState?.level).toBe(3);

      act(() => {
        rafCallback(32);
      });

      expect(mocks.checkEvolution).toHaveBeenCalledTimes(3);
      expect(capturedState?.level).toBe(4);
    } finally {
      if (typeof mocks.actualSystems?.checkEvolution === 'function') {
        mocks.checkEvolution.mockImplementation((...args) =>
          mocks.actualSystems.checkEvolution(...args)
        );
      } else {
        mocks.checkEvolution.mockReset();
      }

      mocks.updateGameState.mockImplementation(() => ({
        commands: [],
        localPlayerId: null,
        hudSnapshot: null,
      }));
    }
  });

  it('targets the nearest microorganism when queuing attacks without an active target', async () => {
    const canvas = createCanvas();
    const dispatch = vi.fn();
    let api;

    const localPlayerId = 'player-1';
    const sharedMicroorganisms = [
      {
        id: 'micro-1',
        kind: 'microorganism',
        aggression: 'hostile',
        position: { x: 220, y: 240 },
        health: { current: 8, max: 10 },
      },
      {
        id: 'micro-2',
        kind: 'microorganism',
        aggression: 'hostile',
        position: { x: 80, y: 84 },
        health: { current: 5, max: 10 },
      },
    ];

    mocks.gameStoreState = {
      playerId: localPlayerId,
      players: {
        [localPlayerId]: {
          id: localPlayerId,
          position: { x: 64, y: 64 },
          combatStatus: { state: 'idle', targetPlayerId: null, targetObjectId: null },
        },
      },
      remotePlayers: { byId: {} },
      world: { microorganisms: sharedMicroorganisms, damagePopups: [] },
      microorganisms: { all: sharedMicroorganisms, byId: {}, indexById: new Map() },
      damagePopups: [],
    };

    const renderMicroorganisms = [
      { id: 'micro-1', x: 220, y: 240, aggression: 'hostile', health: { current: 8, max: 10 } },
      { id: 'micro-2', x: 80, y: 84, aggression: 'hostile', health: { current: 5, max: 10 } },
    ];

    let capturedActionBuffer = null;
    mocks.updateGameState.mockImplementation(({ renderState, actionBuffer }) => {
      capturedActionBuffer = actionBuffer;

      if (renderState) {
        renderState.playersById.set(localPlayerId, {
          id: localPlayerId,
          renderPosition: { x: 64, y: 64 },
          combatStatus: { state: 'idle', targetPlayerId: null, targetObjectId: null },
        });
        renderState.worldView.microorganisms = renderMicroorganisms;
      }

      return {
        commands: { movement: null, attacks: actionBuffer.attacks.slice() },
        localPlayerId,
        hudSnapshot: null,
      };
    });

    render(
      <HookWrapper
        canvas={canvas}
        dispatch={dispatch}
        onReady={(readyApi) => {
          api = readyApi;
        }}
      />
    );

    await waitFor(() => {
      expect(typeof rafCallback).toBe('function');
      expect(api).toBeTruthy();
    });

    act(() => {
      api.inputActions.attack();
    });

    act(() => {
      rafCallback(16);
    });

    expect(capturedActionBuffer).toBeTruthy();
    expect(capturedActionBuffer.attacks).toHaveLength(1);
    expect(capturedActionBuffer.attacks[0].targetObjectId).toBe('micro-2');
    expect(capturedActionBuffer.attacks[0]).not.toHaveProperty('state');

    mocks.updateGameState.mockImplementation(() => ({
      commands: [],
      localPlayerId: null,
      hudSnapshot: null,
    }));
    mocks.gameStoreState = {};
  });

  it('omits cooldown state when resending dash commands after recovery', async () => {
    const canvas = createCanvas();
    const dispatch = vi.fn();
    let api;

    const localPlayerId = 'player-1';
    const sharedCombatStatus = {
      state: 'cooldown',
      targetPlayerId: null,
      targetObjectId: 'micro-1',
      lastAttackAt: null,
    };

    mocks.gameStoreState = {
      playerId: localPlayerId,
      players: {
        [localPlayerId]: {
          id: localPlayerId,
          position: { x: 0, y: 0 },
          combatStatus: sharedCombatStatus,
        },
      },
      remotePlayers: {
        byId: {
          [localPlayerId]: {
            id: localPlayerId,
            combatStatus: sharedCombatStatus,
          },
        },
      },
      world: { microorganisms: [], damagePopups: [] },
      microorganisms: { all: [], byId: {}, indexById: new Map() },
    };

    let capturedActionBuffer = null;
    mocks.updateGameState.mockImplementation(({ renderState, actionBuffer }) => {
      capturedActionBuffer = actionBuffer;

      if (renderState) {
        renderState.playersById.set(localPlayerId, {
          id: localPlayerId,
          renderPosition: { x: 0, y: 0 },
          combatStatus: { ...sharedCombatStatus },
        });
      }

      return {
        commands: { movement: null, attacks: actionBuffer.attacks.slice() },
        localPlayerId,
        hudSnapshot: null,
      };
    });

    render(
      <HookWrapper
        canvas={canvas}
        dispatch={dispatch}
        onReady={(readyApi) => {
          api = readyApi;
        }}
      />
    );

    await waitFor(() => {
      expect(typeof rafCallback).toBe('function');
      expect(api).toBeTruthy();
    });

    act(() => {
      api.inputActions.dash();
      api.inputActions.dash();
    });

    act(() => {
      rafCallback(16);
    });

    expect(capturedActionBuffer).toBeTruthy();
    expect(capturedActionBuffer.attacks).toHaveLength(2);
    capturedActionBuffer.attacks.forEach((command) => {
      expect(command.kind).toBe('dash');
      expect(command.targetObjectId).toBe('micro-1');
      expect(command).not.toHaveProperty('state');
    });

    mocks.updateGameState.mockImplementation(() => ({
      commands: [],
      localPlayerId: null,
      hudSnapshot: null,
    }));
    mocks.gameStoreState = {};
  });
});

describe('useGameLoop evolution confirmation flow', () => {
  let originalRequestAnimationFrame;
  let originalCancelAnimationFrame;
  let rafCallback;
  let rafId;

  beforeEach(() => {
    mocks.updateGameState.mockReset();
    mocks.renderFrame.mockClear();
    mocks.soundEffectsFactory.mockClear();
    mocks.addNotification.mockClear();

    originalRequestAnimationFrame = window.requestAnimationFrame;
    originalCancelAnimationFrame = window.cancelAnimationFrame;
    rafCallback = undefined;
    rafId = 0;

    window.requestAnimationFrame = vi.fn((callback) => {
      rafCallback = callback;
      rafId += 1;
      return rafId;
    });

    window.cancelAnimationFrame = vi.fn();
  });

  afterEach(() => {
    if (originalRequestAnimationFrame) {
      window.requestAnimationFrame = originalRequestAnimationFrame;
    } else {
      delete window.requestAnimationFrame;
    }

    if (originalCancelAnimationFrame) {
      window.cancelAnimationFrame = originalCancelAnimationFrame;
    } else {
      delete window.cancelAnimationFrame;
    }
  });

  it('keeps the evolution UI open and avoids duplicate level toasts while awaiting confirmation', async () => {
    const snapshots = [
      {
        commands: { movement: null, attacks: [] },
        localPlayerId: 'p1',
        hudSnapshot: {
          xp: { current: 180, total: 180, next: 120, level: 1 },
          level: 1,
          reroll: { baseCost: 25, cost: 25, count: 0, pity: 0 },
          evolutionMenu: { activeTier: 'small', options: { small: [], medium: [], large: [], macro: [] } },
          notifications: [],
          showEvolutionChoice: false,
        },
      },
      {
        commands: { movement: null, attacks: [] },
        localPlayerId: 'p1',
        hudSnapshot: {
          xp: { current: 40, total: 220, next: 180, level: 2 },
          level: 1,
          reroll: { baseCost: 25, cost: 25, count: 0, pity: 0 },
          evolutionMenu: { activeTier: 'small', options: { small: [], medium: [], large: [], macro: [] } },
          notifications: [],
          showEvolutionChoice: false,
        },
      },
      {
        commands: { movement: null, attacks: [] },
        localPlayerId: 'p1',
        hudSnapshot: {
          xp: { current: 10, total: 230, next: 200, level: 2 },
          level: 2,
          reroll: { baseCost: 25, cost: 25, count: 0, pity: 0 },
          evolutionMenu: { activeTier: 'small', options: { small: [], medium: [], large: [], macro: [] } },
          notifications: [],
          showEvolutionChoice: false,
        },
      },
    ];

    let callIndex = 0;
    mocks.updateGameState.mockImplementation(() => {
      const frame = snapshots[Math.min(callIndex, snapshots.length - 1)];
      callIndex += 1;
      return frame;
    });

    const canvas = createCanvas();
    const dispatch = vi.fn();
    const onReady = vi.fn();

    render(<HookWrapper canvas={canvas} dispatch={dispatch} onReady={onReady} />);

    await waitFor(() => {
      expect(typeof rafCallback).toBe('function');
    });

    const firstFrame = rafCallback;
    act(() => {
      firstFrame(0);
    });

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(onReady).toHaveBeenCalled();
    });

    const api = onReady.mock.calls[0][0];

    act(() => {
      api.inputActions.openEvolutionMenu();
    });

    const secondFrame = rafCallback;
    act(() => {
      secondFrame(16);
    });

    const thirdFrame = rafCallback;
    act(() => {
      thirdFrame(32);
    });

    const syncPayloads = dispatch.mock.calls
      .filter(([action]) => action?.type === 'SYNC_STATE')
      .map(([action]) => action.payload);

    expect(syncPayloads.length).toBeGreaterThanOrEqual(3);

    const firstLevelTwoIndex = syncPayloads.findIndex((payload) => payload.level >= 2);
    expect(firstLevelTwoIndex).toBeGreaterThanOrEqual(0);

    const afterLevelUp = syncPayloads.slice(firstLevelTwoIndex);
    expect(afterLevelUp.every((payload) => payload.level >= 2)).toBe(true);

    const openPayload = afterLevelUp.find((payload) => payload.showEvolutionChoice);
    expect(openPayload).toBeDefined();
    expect(openPayload.level).toBe(2);

    const finalPayload = afterLevelUp[afterLevelUp.length - 1];
    expect(finalPayload.level).toBe(2);
    expect(finalPayload.showEvolutionChoice).toBe(true);
    expect(finalPayload.resourceBag.level).toBe(2);

    const toastAdditions = mocks.addNotification.mock.calls.filter(([, text]) => text === '⬆️ Nível 2');
    expect(toastAdditions).toHaveLength(1);
  });

  it('emits only one level-up toast when the XP snapshot stabilizes after leveling', async () => {
    const snapshots = [
      {
        commands: { movement: null, attacks: [] },
        localPlayerId: 'player-1',
        hudSnapshot: {
          xp: { current: 90, total: 90, next: 100, level: 1 },
          level: 1,
          reroll: { baseCost: 25, cost: 25, count: 0, pity: 0 },
          evolutionMenu: { activeTier: 'small', options: { small: [], medium: [], large: [], macro: [] } },
          notifications: [],
          showEvolutionChoice: false,
        },
      },
      {
        commands: { movement: null, attacks: [] },
        localPlayerId: 'player-1',
        hudSnapshot: {
          xp: { current: 10, total: 110, next: 150, level: 2 },
          level: 2,
          reroll: { baseCost: 25, cost: 25, count: 0, pity: 0 },
          evolutionMenu: { activeTier: 'small', options: { small: [], medium: [], large: [], macro: [] } },
          notifications: [],
          showEvolutionChoice: false,
        },
      },
      {
        commands: { movement: null, attacks: [] },
        localPlayerId: 'player-1',
        hudSnapshot: {
          xp: { current: 10, total: 110, next: 150, level: 2 },
          level: 2,
          reroll: { baseCost: 25, cost: 25, count: 0, pity: 0 },
          evolutionMenu: { activeTier: 'small', options: { small: [], medium: [], large: [], macro: [] } },
          notifications: [],
          showEvolutionChoice: false,
        },
      },
    ];

    let callIndex = 0;
    mocks.updateGameState.mockImplementation(() => {
      const frame = snapshots[Math.min(callIndex, snapshots.length - 1)];
      callIndex += 1;
      return frame;
    });

    const canvas = createCanvas();
    const dispatch = vi.fn();

    render(<HookWrapper canvas={canvas} dispatch={dispatch} />);

    await waitFor(() => {
      expect(typeof rafCallback).toBe('function');
    });

    const firstFrame = rafCallback;
    act(() => {
      firstFrame(0);
    });

    const secondFrame = rafCallback;
    act(() => {
      secondFrame(16);
    });

    const thirdFrame = rafCallback;
    act(() => {
      thirdFrame(32);
    });

    await waitFor(() => {
      const levelUpToasts = mocks.addNotification.mock.calls.filter(([, text]) => text === '⬆️ Nível 2');
      expect(levelUpToasts.length).toBeGreaterThan(0);
    });

    const toastAdditions = mocks.addNotification.mock.calls.filter(([, text]) => text === '⬆️ Nível 2');
    expect(toastAdditions).toHaveLength(1);
  });

  it('normalizes repeated XP snapshots across frames without double-leveling', async () => {
    const actualCheckEvolution = mocks.actualSystems?.checkEvolution;
    expect(actualCheckEvolution).toBeTypeOf('function');

    mocks.checkEvolution.mockClear();
    mocks.checkEvolution.mockImplementation((state, helpers) => actualCheckEvolution(state, helpers));

    const repeatedSnapshot = {
      commands: { movement: null, attacks: [] },
      localPlayerId: 'player-1',
      hudSnapshot: {
        xp: { current: 260, total: 260, next: 120, level: 1 },
        level: 1,
        notifications: [],
        resourceBag: {},
        showEvolutionChoice: false,
      },
    };

    const snapshots = [repeatedSnapshot, repeatedSnapshot, repeatedSnapshot];

    let callIndex = 0;
    mocks.updateGameState.mockImplementation(() => {
      const frame = snapshots[Math.min(callIndex, snapshots.length - 1)];
      callIndex += 1;
      const { hudSnapshot } = frame;

      return {
        commands: frame.commands,
        localPlayerId: frame.localPlayerId,
        hudSnapshot: {
          ...hudSnapshot,
          xp: { ...hudSnapshot.xp },
          notifications: [...(hudSnapshot.notifications ?? [])],
          resourceBag: { ...(hudSnapshot.resourceBag ?? {}) },
        },
      };
    });

    const canvas = createCanvas();
    const dispatch = vi.fn();

    render(<HookWrapper canvas={canvas} dispatch={dispatch} />);

    await waitFor(() => {
      expect(typeof rafCallback).toBe('function');
    });

    act(() => {
      rafCallback(0);
    });

    await waitFor(() => {
      expect(mocks.checkEvolution).toHaveBeenCalled();
    });

    const firstFrameCheckCalls = mocks.checkEvolution.mock.calls.slice();
    const firstCheckState = firstFrameCheckCalls[firstFrameCheckCalls.length - 1][0];
    const firstFrameDispatchCount = dispatch.mock.calls.length;
    const firstFrameFinalPayload = dispatch.mock.calls[firstFrameDispatchCount - 1][0].payload;

    expect(firstFrameFinalPayload.level).toBe(firstCheckState.level);
    expect(firstFrameFinalPayload.xp).toMatchObject({
      current: firstCheckState.xp.current,
      next: firstCheckState.xp.next,
      total: firstCheckState.xp.total,
      level: firstCheckState.xp.level,
    });
    expect(firstFrameFinalPayload.xp.current).toBeLessThan(260);
    expect(firstFrameFinalPayload.xp.next).toBeGreaterThan(120);

    const firstFrameResourceBagLevel = firstFrameFinalPayload.resourceBag?.level;
    expect(firstFrameResourceBagLevel).toBe(firstCheckState.level);

    const syncNotifications = dispatch.mock.calls
      .slice(0, firstFrameDispatchCount)
      .flatMap(([action]) =>
        Array.isArray(action.payload?.notifications)
          ? action.payload.notifications.map((notification) =>
              typeof notification === 'string' ? notification : notification?.text
            )
          : []
      )
      .filter(Boolean);
    expect(syncNotifications).toContain('⬆️ Nível 2');

    const firstFrameNotificationTexts = Array.isArray(firstFrameFinalPayload.notifications)
      ? firstFrameFinalPayload.notifications.map((notification) =>
          typeof notification === 'string' ? notification : notification?.text
        )
      : [];
    expect(firstFrameNotificationTexts).toContain('⬆️ Nível 2');

    act(() => {
      rafCallback(16);
    });

    await waitFor(() => {
      expect(mocks.checkEvolution.mock.calls.length).toBeGreaterThan(firstFrameCheckCalls.length);
    });

    const subsequentCheckStates = mocks.checkEvolution.mock.calls
      .slice(firstFrameCheckCalls.length)
      .map(([state]) => state);
    expect(subsequentCheckStates.length).toBeGreaterThan(0);
    expect(subsequentCheckStates.every((state) => state.level === firstCheckState.level)).toBe(true);

    const finalPayload = dispatch.mock.calls.at(-1)[0].payload;
    expect(finalPayload.level).toBe(firstCheckState.level);
    expect(finalPayload.xp.current).toBe(firstCheckState.xp.current);
    expect(finalPayload.xp.next).toBe(firstCheckState.xp.next);
    expect(finalPayload.resourceBag.level).toBe(firstCheckState.level);

    const finalNotificationTexts = Array.isArray(finalPayload.notifications)
      ? finalPayload.notifications.map((notification) =>
          typeof notification === 'string' ? notification : notification?.text
        )
      : [];
    expect(finalNotificationTexts).toContain('⬆️ Nível 2');

    const levelUpToasts = mocks.addNotification.mock.calls.filter(([, text]) => text === '⬆️ Nível 2');
    expect(levelUpToasts).toHaveLength(1);
  });
});

describe('useGameLoop combat log feedback', () => {
  let originalRequestAnimationFrame;
  let originalCancelAnimationFrame;
  let rafCallback;
  let performanceNowSpy;

  const notifyStoreSubscribers = () => {
    for (const listener of mocks.gameStoreListeners) {
      listener();
    }
  };

  beforeEach(() => {
    mocks.updateGameState.mockClear();
    mocks.renderFrame.mockClear();
    mocks.soundEffectsFactory.mockClear();
    mocks.particleFactory.mockClear();
    mocks.gameStoreListeners.clear();
    mocks.gameStoreState = {};

    performanceNowSpy = vi.spyOn(performance, 'now').mockReturnValue(0);

    originalRequestAnimationFrame = window.requestAnimationFrame;
    originalCancelAnimationFrame = window.cancelAnimationFrame;

    rafCallback = undefined;

    window.requestAnimationFrame = vi.fn((callback) => {
      rafCallback = callback;
      return 1;
    });

    window.cancelAnimationFrame = vi.fn();

    mocks.updateGameState.mockImplementation(() => ({
      commands: [],
      localPlayerId: null,
      hudSnapshot: null,
    }));
  });

  afterEach(() => {
    if (originalRequestAnimationFrame) {
      window.requestAnimationFrame = originalRequestAnimationFrame;
    } else {
      delete window.requestAnimationFrame;
    }

    if (originalCancelAnimationFrame) {
      window.cancelAnimationFrame = originalCancelAnimationFrame;
    } else {
      delete window.cancelAnimationFrame;
    }

    performanceNowSpy?.mockRestore();
    mocks.updateGameState.mockReset();
    mocks.updateGameState.mockImplementation(() => ({
      commands: [],
      localPlayerId: null,
      hudSnapshot: null,
    }));
    mocks.gameStoreState = {};
  });

  it('creates a local damage popup when the player hits a target', async () => {
    const canvas = createCanvas();
    const dispatch = vi.fn();
    let capturedRenderState = null;
    let latestSharedState = null;

    const localPlayerId = 'player-1';
    const targetMicroId = 'micro-42';

    mocks.gameStoreState = {
      playerId: localPlayerId,
      players: {
        [localPlayerId]: {
          id: localPlayerId,
          position: { x: 48, y: 72 },
          combatStatus: { state: 'idle', targetPlayerId: null, targetObjectId: null },
        },
      },
      remotePlayers: { byId: {} },
      world: { microorganisms: [{ id: targetMicroId, position: { x: 200, y: 180 }, color: '#22aa88' }] },
      combatLog: [],
    };

    mocks.updateGameState.mockImplementation(({ renderState, sharedState }) => {
      capturedRenderState = renderState;
      latestSharedState = sharedState;
      if (renderState) {
        renderState.playersById.set(localPlayerId, {
          id: localPlayerId,
          renderPosition: { x: 64, y: 96 },
          palette: { base: '#ff5f73' },
        });
        renderState.worldView.microorganisms = [
          { id: targetMicroId, x: 200, y: 180, color: '#22aa88' },
        ];
      }
      return {
        commands: { movement: null, attacks: [] },
        localPlayerId,
        hudSnapshot: null,
      };
    });

    render(<HookWrapper canvas={canvas} dispatch={dispatch} />);

    await waitFor(() => {
      expect(typeof rafCallback).toBe('function');
    });

    const firstFrame = rafCallback;
    act(() => {
      firstFrame(16);
    });

    const secondFrame = rafCallback;
    expect(mocks.gameStoreListeners.size).toBeGreaterThan(0);

    const logEntry = {
      timestamp: 1_000,
      attackerId: localPlayerId,
      targetKind: 'microorganism',
      targetObjectId: targetMicroId,
      damage: 12,
      outcome: 'hit',
      remainingHealth: 8,
    };

    mocks.gameStoreState = {
      ...mocks.gameStoreState,
      combatLog: [logEntry],
    };
    act(() => {
      notifyStoreSubscribers();
    });

    act(() => {
      secondFrame(32);
    });

    expect(capturedRenderState).toBeTruthy();
    expect(latestSharedState?.combatLog).toHaveLength(1);
    expect(latestSharedState?.playerId).toBe(localPlayerId);
    expect(capturedRenderState.damagePopups).toHaveLength(1);
    const popup = capturedRenderState.damagePopups[0];
    expect(popup.value).toBe(12);
    expect(popup.variant).toBe('advantage');
    expect(popup.x).toBe(200);
    expect(popup.y).toBe(180);
    expect(capturedRenderState.damagePopupIndex.get(popup.id)).toBe(popup);
    expect(capturedRenderState.particles.length).toBeGreaterThan(0);
    expect(capturedRenderState.lastCombatLogEntry).toMatchObject({ timestamp: 1_000, sequence: 0 });

    const thirdFrame = rafCallback;
    act(() => {
      thirdFrame(48);
    });

    expect(capturedRenderState.damagePopups).toHaveLength(1);
  });

  it('creates popups for damage received by the local player without duplicating entries', async () => {
    const canvas = createCanvas();
    const dispatch = vi.fn();
    let capturedRenderState = null;
    let latestSharedState = null;

    const localPlayerId = 'player-1';
    const attackerId = 'player-2';

    mocks.gameStoreState = {
      playerId: localPlayerId,
      players: {
        [localPlayerId]: {
          id: localPlayerId,
          position: { x: 120, y: 140 },
          combatStatus: { state: 'idle', targetPlayerId: null, targetObjectId: null },
        },
        [attackerId]: {
          id: attackerId,
          position: { x: 240, y: 140 },
          combatStatus: { state: 'idle', targetPlayerId: null, targetObjectId: null },
        },
      },
      remotePlayers: { byId: {} },
      world: { microorganisms: [] },
      combatLog: [],
    };

    mocks.updateGameState.mockImplementation(({ renderState, sharedState }) => {
      capturedRenderState = renderState;
      latestSharedState = sharedState;
      if (renderState) {
        renderState.playersById.set(localPlayerId, {
          id: localPlayerId,
          renderPosition: { x: 132, y: 156 },
          palette: { base: '#ff5f73' },
        });
        renderState.playersById.set(attackerId, {
          id: attackerId,
          renderPosition: { x: 240, y: 156 },
          palette: { base: '#3388ff' },
        });
      }
      return {
        commands: { movement: null, attacks: [] },
        localPlayerId,
        hudSnapshot: null,
      };
    });

    render(<HookWrapper canvas={canvas} dispatch={dispatch} />);

    await waitFor(() => {
      expect(typeof rafCallback).toBe('function');
    });

    const firstFrame = rafCallback;
    act(() => {
      firstFrame(16);
    });

    const secondFrame = rafCallback;
    expect(mocks.gameStoreListeners.size).toBeGreaterThan(0);

    const damageEntry = {
      timestamp: 2_000,
      attackerId,
      targetKind: 'player',
      targetId: localPlayerId,
      damage: 7,
      outcome: 'hit',
      remainingHealth: 25,
    };

    mocks.gameStoreState = {
      ...mocks.gameStoreState,
      combatLog: [damageEntry],
    };
    act(() => {
      notifyStoreSubscribers();
    });

    act(() => {
      secondFrame(32);
    });

    expect(capturedRenderState).toBeTruthy();
    expect(latestSharedState?.combatLog).toHaveLength(1);
    expect(latestSharedState?.playerId).toBe(localPlayerId);
    expect(capturedRenderState.damagePopups).toHaveLength(1);
    const popup = capturedRenderState.damagePopups[0];
    expect(popup.value).toBe(7);
    expect(popup.variant).toBe('normal');
    expect(popup.x).toBe(132);
    expect(popup.y).toBe(156);
    expect(capturedRenderState.lastCombatLogEntry).toMatchObject({ timestamp: 2_000, sequence: 0 });
    expect(capturedRenderState.lastCombatLogLength).toBe(1);

    const thirdFrame = rafCallback;
    act(() => {
      thirdFrame(48);
    });

    expect(capturedRenderState.damagePopups).toHaveLength(1);
  });

  it('throttles damage particles for rapid consecutive hits from the same attacker and target', async () => {
    const canvas = createCanvas();
    const dispatch = vi.fn();
    let capturedRenderState = null;

    const localPlayerId = 'player-1';
    const targetMicroId = 'micro-84';

    mocks.gameStoreState = {
      playerId: localPlayerId,
      players: {
        [localPlayerId]: {
          id: localPlayerId,
          position: { x: 64, y: 80 },
          combatStatus: { state: 'idle', targetPlayerId: null, targetObjectId: null },
        },
      },
      remotePlayers: { byId: {} },
      world: { microorganisms: [{ id: targetMicroId, position: { x: 200, y: 180 }, color: '#33ffaa' }] },
      combatLog: [],
    };

    mocks.updateGameState.mockImplementation(({ renderState }) => {
      capturedRenderState = renderState;
      if (renderState) {
        renderState.playersById.set(localPlayerId, {
          id: localPlayerId,
          renderPosition: { x: 72, y: 92 },
          palette: { base: '#ff5f73' },
        });
        renderState.worldView.microorganisms = [
          { id: targetMicroId, x: 200, y: 180, color: '#33ffaa' },
        ];
      }
      return {
        commands: { movement: null, attacks: [] },
        localPlayerId,
        hudSnapshot: null,
      };
    });

    render(<HookWrapper canvas={canvas} dispatch={dispatch} />);

    await waitFor(() => {
      expect(typeof rafCallback).toBe('function');
    });

    const firstFrame = rafCallback;
    act(() => {
      firstFrame(16);
    });

    const baselineParticleCalls = mocks.particleFactory.mock.calls.length;
    const baselineParticleCount = capturedRenderState?.particles?.length ?? 0;
    const baselinePopupCount = capturedRenderState?.damagePopups?.length ?? 0;

    const firstHit = {
      timestamp: 5_000,
      attackerId: localPlayerId,
      targetKind: 'microorganism',
      targetObjectId: targetMicroId,
      damage: 9,
      outcome: 'hit',
      remainingHealth: 21,
    };

    const secondHit = {
      ...firstHit,
      timestamp: 5_300,
      damage: 7,
    };

    mocks.gameStoreState = {
      ...mocks.gameStoreState,
      combatLog: [firstHit, secondHit],
    };

    act(() => {
      notifyStoreSubscribers();
    });

    const secondFrame = rafCallback;
    act(() => {
      secondFrame(32);
    });

    expect(mocks.particleFactory.mock.calls.length - baselineParticleCalls).toBe(1);
    const popupDelta = (capturedRenderState?.damagePopups?.length ?? 0) - baselinePopupCount;
    expect(popupDelta).toBe(2);
    const particleDelta = (capturedRenderState?.particles?.length ?? 0) - baselineParticleCount;
    expect(particleDelta).toBe(1);
  });
});

describe('setActiveEvolutionTier', () => {
  beforeEach(() => {
    mocks.updateGameState.mockClear();
    mocks.updateGameState.mockImplementation(({ renderState }) => {
      if (renderState) {
        renderState.evolutionMenu = {
          activeTier: 'small',
          options: {
            small: [{ key: 'small-1', name: 'Pequena' }],
            medium: [{ key: 'medium-1', name: 'Média' }],
            large: [{ key: 'large-1', name: 'Grande' }],
          },
        };
      }

      return {
        commands: [],
        localPlayerId: null,
        hudSnapshot: null,
      };
    });
  });

  afterEach(() => {
    mocks.updateGameState.mockImplementation(() => ({
      commands: [],
      localPlayerId: null,
      hudSnapshot: null,
    }));
  });

  it('updates the HUD state when switching tiers and preserves options', async () => {
    const canvas = createCanvas();
    const dispatch = vi.fn();
    const onReady = vi.fn();

    render(<HookWrapper canvas={canvas} dispatch={dispatch} onReady={onReady} />);

    await waitFor(() => {
      expect(onReady).toHaveBeenCalled();
    });

    const api = onReady.mock.calls[0][0];

    dispatch.mockClear();

    act(() => {
      api.setActiveEvolutionTier('medium');
    });

    expect(dispatch).toHaveBeenCalledTimes(1);
    const mediumSync = dispatch.mock.calls[0][0];
    expect(mediumSync.type).toBe('SYNC_STATE');
    expect(mediumSync.payload.evolutionMenu).toMatchObject({
      activeTier: 'medium',
      options: {
        small: [{ key: 'small-1', name: 'Pequena' }],
        medium: [{ key: 'medium-1', name: 'Média' }],
        large: [{ key: 'large-1', name: 'Grande' }],
      },
    });

    dispatch.mockClear();

    act(() => {
      api.setActiveEvolutionTier('medium');
    });

    expect(dispatch).not.toHaveBeenCalled();

    act(() => {
      api.setActiveEvolutionTier('large');
    });

    expect(dispatch).toHaveBeenCalledTimes(1);
    const largeSync = dispatch.mock.calls[0][0];
    expect(largeSync.type).toBe('SYNC_STATE');
    expect(largeSync.payload.evolutionMenu.activeTier).toBe('large');
  });
});
