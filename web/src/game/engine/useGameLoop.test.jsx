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
    restartGame: vi.fn(),
    selectArchetype: vi.fn(),
    gameStoreState: {},
    gameStoreListeners: listeners,
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

vi.mock('../systems', () => ({
  restartGame: (...args) => mocks.restartGame(...args),
  selectArchetype: (...args) => mocks.selectArchetype(...args),
}));

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
    mocks.selectArchetype.mockClear();
    performanceNowSpy = vi.spyOn(performance, 'now').mockReturnValue(0);
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

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
      world: { microorganisms: sharedMicroorganisms },
      microorganisms: { all: sharedMicroorganisms, byId: {}, indexById: new Map() },
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
      world: { microorganisms: [] },
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
