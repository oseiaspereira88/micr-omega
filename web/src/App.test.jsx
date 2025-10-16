import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import App from './App.jsx';
import { gameStore } from './store/gameStore';

const sendMock = vi.fn();
const sendAttackMock = vi.fn();
const sendMovementMock = vi.fn();
const mockSettingsRef = { current: null };

vi.mock('./hooks/useGameSocket', () => ({
  useGameSocket: () => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    sendMovement: sendMovementMock,
    sendAttack: sendAttackMock,
    send: sendMock,
  }),
}));

vi.mock('./MicroOmegaGame.jsx', () => ({
  __esModule: true,
  default: ({ settings }) => {
    mockSettingsRef.current = settings;
    return null;
  },
}));

vi.mock('./components/StartScreen', () => ({
  __esModule: true,
  default: ({ onStart }) => {
    React.useEffect(() => {
      onStart({ name: 'Tester' });
    }, [onStart]);
    return null;
  },
}));

vi.mock('./components/ToastStack', () => ({
  __esModule: true,
  default: () => null,
}));

vi.mock('./store/gameSettings', () => ({
  __esModule: true,
  useGameSettings: () => ({ settings: {} }),
  GameSettingsProvider: ({ children }) => <>{children}</>,
}));

const baseState = gameStore.getState();

const createPlayer = () => ({
  id: 'player-1',
  name: 'Test Player',
  connected: true,
  score: 0,
  combo: 0,
  lastActiveAt: 0,
  position: { x: 0, y: 0 },
  movementVector: { x: 0, y: 0 },
  orientation: { angle: 0 },
  health: { current: 100, max: 100 },
  combatStatus: {
    state: 'idle',
    targetPlayerId: null,
    targetObjectId: null,
    lastAttackAt: null,
  },
  combatAttributes: { attack: 1, defense: 1, speed: 1, range: 1 },
  archetype: null,
  archetypeKey: null,
});

const initializeStoreWithPlayer = () => {
  const player = createPlayer();
  const remotePlayers = {
    byId: { [player.id]: player },
    all: [player],
    indexById: new Map([[player.id, 0]]),
  };

  act(() => {
    gameStore.setState(() => ({
      ...baseState,
      connectionStatus: 'connected',
      playerId: player.id,
      playerName: player.name,
      joinError: null,
      players: remotePlayers.byId,
      remotePlayers,
      room: { ...(baseState.room || {}), phase: 'active' },
    }));
  });

  return player;
};

describe('App archetype actions', () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendAttackMock.mockReset();
    sendMovementMock.mockReset();
    sendAttackMock.mockReturnValue(true);
    mockSettingsRef.current = null;
    initializeStoreWithPlayer();
  });

  afterEach(() => {
    act(() => {
      gameStore.setState(() => baseState);
    });
    mockSettingsRef.current = null;
    sendMock.mockReset();
    sendAttackMock.mockReset();
    sendMovementMock.mockReset();
  });

  it('sends archetype commands and updates local combat attributes', async () => {
    render(<App />);

    await waitFor(() => {
      expect(mockSettingsRef.current).toBeTruthy();
    });

    const settings = mockSettingsRef.current;
    expect(typeof settings.onArchetypeSelect).toBe('function');

    const snapshot = {
      health: 140,
      maxHealth: 180,
      combatAttributes: { attack: 12, defense: 9, speed: 1.4, range: 95 },
    };

    await act(async () => {
      settings.onArchetypeSelect('  virus  ', snapshot);
    });

    expect(sendMock).toHaveBeenCalledWith({
      type: 'action',
      playerId: 'player-1',
      action: { type: 'archetype', archetype: 'virus' },
    });

    const updated = gameStore.getState();
    expect(updated.players['player-1'].combatAttributes).toEqual({
      attack: 12,
      defense: 9,
      speed: 1.4,
      range: 95,
    });
    expect(updated.players['player-1'].health).toEqual({ current: 140, max: 180 });
    expect(updated.remotePlayers.byId['player-1'].combatAttributes.attack).toBe(12);
    expect(updated.players['player-1'].archetype).toBe('virus');
    expect(updated.players['player-1'].archetypeKey).toBe('virus');
  });
});

describe('App command batch handling', () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendAttackMock.mockReset();
    sendMovementMock.mockReset();
    sendAttackMock.mockReturnValue(true);
    mockSettingsRef.current = null;
    initializeStoreWithPlayer();
  });

  afterEach(() => {
    act(() => {
      gameStore.setState(() => baseState);
    });
    mockSettingsRef.current = null;
    sendMock.mockReset();
    sendAttackMock.mockReset();
    sendMovementMock.mockReset();
  });

  it('sends dash commands without explicit targets', async () => {
    render(<App />);

    await waitFor(() => {
      expect(mockSettingsRef.current).toBeTruthy();
    });

    const settings = mockSettingsRef.current;
    sendAttackMock.mockClear();

    await act(async () => {
      settings.onCommandBatch({
        attacks: [
          {
            kind: 'dash',
            timestamp: 123,
          },
        ],
      });
    });

    expect(sendAttackMock).toHaveBeenCalledTimes(1);
    const [payload] = sendAttackMock.mock.calls[0];
    expect(payload.kind).toBe('dash');
    expect(payload.playerId).toBe('player-1');
    expect(payload).not.toHaveProperty('targetPlayerId');
    expect(payload).not.toHaveProperty('targetObjectId');
    expect(typeof payload.clientTime).toBe('number');
  });

  it('allows skill commands without a resolved target', async () => {
    render(<App />);

    await waitFor(() => {
      expect(mockSettingsRef.current).toBeTruthy();
    });

    const settings = mockSettingsRef.current;
    sendAttackMock.mockClear();

    await act(async () => {
      settings.onCommandBatch({
        attacks: [
          {
            kind: 'skill',
          },
        ],
      });
    });

    expect(sendAttackMock).toHaveBeenCalledTimes(1);
    const [payload] = sendAttackMock.mock.calls[0];
    expect(payload.kind).toBe('skill');
    expect(payload.playerId).toBe('player-1');
    expect(payload).not.toHaveProperty('targetPlayerId');
    expect(payload).not.toHaveProperty('targetObjectId');
  });

  it('keeps ignoring basic attacks without targets', async () => {
    render(<App />);

    await waitFor(() => {
      expect(mockSettingsRef.current).toBeTruthy();
    });

    const settings = mockSettingsRef.current;
    sendAttackMock.mockClear();

    await act(async () => {
      settings.onCommandBatch({
        attacks: [
          {
            kind: 'basic',
          },
        ],
      });
    });

    expect(sendAttackMock).not.toHaveBeenCalled();
  });

  it('prioritizes command orientation when sending movement updates', async () => {
    render(<App />);

    await waitFor(() => {
      expect(mockSettingsRef.current).toBeTruthy();
    });

    const settings = mockSettingsRef.current;
    sendMovementMock.mockClear();

    const commandOrientation = { angle: Math.PI / 3, tilt: 0.25 };

    await act(async () => {
      settings.onCommandBatch({
        movement: {
          vector: { x: 0.5, y: 0.5 },
          speed: 30,
          timestamp: 123,
          orientation: commandOrientation,
        },
      });
    });

    expect(sendMovementMock).toHaveBeenCalledTimes(1);
    const [payload] = sendMovementMock.mock.calls[0];
    expect(payload.orientation).toEqual(commandOrientation);
  });
});
