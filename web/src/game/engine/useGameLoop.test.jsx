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
});
