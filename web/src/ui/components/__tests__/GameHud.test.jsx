import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import GameHud from '../GameHud';
import { gameStore } from '../../../store/gameStore';

const BASE_PROPS = {
  level: 1,
  score: 0,
  energy: 0,
  health: 10,
  maxHealth: 10,
  dashCharge: 1,
  combo: 0,
  maxCombo: 10,
  activePowerUps: [],
  xp: 0,
  geneticMaterial: 0,
  characteristicPoints: 0,
  geneFragments: 0,
  stableGenes: 0,
  evolutionSlots: 0,
  reroll: 0,
  dropPity: 0,
  recentRewards: [],
  bossActive: false,
  bossHealth: 0,
  bossMaxHealth: 0,
  element: null,
  affinity: null,
  elementLabel: '',
  affinityLabel: '',
  resistances: [],
  statusEffects: [],
  skillData: {
    currentSkill: null,
    skillList: [],
  },
  notifications: [],
  joystick: null,
  onJoystickStart: vi.fn(),
  onJoystickMove: vi.fn(),
  onJoystickEnd: vi.fn(),
  onAttackPress: vi.fn(),
  onAttackRelease: vi.fn(),
  onAttack: vi.fn(),
  onDash: vi.fn(),
  onUseSkill: vi.fn(),
  onCycleSkill: vi.fn(),
  onOpenEvolutionMenu: vi.fn(),
  canEvolve: false,
  showTouchControls: false,
  cameraZoom: 1,
  onCameraZoomChange: vi.fn(),
  opponents: [],
};

describe('GameHud connection status overlay', () => {
  let originalConnectionStatus;
  let originalJoinError;

  beforeEach(() => {
    const state = gameStore.getState();
    originalConnectionStatus = state.connectionStatus;
    originalJoinError = state.joinError;
  });

  afterEach(() => {
    act(() => {
      gameStore.setPartial({
        connectionStatus: originalConnectionStatus,
        joinError: originalJoinError,
      });
    });
  });

  it('exibe e oculta o overlay conforme o status da conexão', () => {
    act(() => {
      gameStore.setPartial({ connectionStatus: 'connecting', joinError: null });
    });

    const { rerender } = render(<GameHud {...BASE_PROPS} />);

    expect(
      screen.getByRole('status', { name: /estado da conexão/i })
    ).toHaveTextContent(/conectando ao servidor/i);

    act(() => {
      gameStore.setPartial({ connectionStatus: 'reconnecting' });
    });
    rerender(<GameHud {...BASE_PROPS} />);
    expect(
      screen.getByRole('status', { name: /estado da conexão/i })
    ).toHaveTextContent(/reconectando ao servidor/i);

    act(() => {
      gameStore.setPartial({ connectionStatus: 'connected' });
    });
    rerender(<GameHud {...BASE_PROPS} />);
    expect(
      screen.queryByRole('status', { name: /estado da conexão/i })
    ).not.toBeInTheDocument();
  });
});

describe('GameHud touch controls', () => {
  it('forward cycle skill handler to touch controls', () => {
    const onCycleSkill = vi.fn();

    render(
      <GameHud
        {...BASE_PROPS}
        showTouchControls
        joystick={{ isTouchActive: false, position: { x: 0, y: 0 } }}
        skillData={{
          ...BASE_PROPS.skillData,
          currentSkill: { icon: '🔥' },
          skillDisabled: false,
          skillCoolingDown: false,
          skillCooldownLabel: 'Pronto',
          skillCooldownPercent: 0,
          costLabel: '5⚡',
        }}
        onCycleSkill={onCycleSkill}
      />
    );

    const cycleButton = screen.getByRole('button', {
      name: 'Trocar habilidade equipada',
    });

    fireEvent.click(cycleButton);

    expect(onCycleSkill).toHaveBeenCalledTimes(1);
  });
});

