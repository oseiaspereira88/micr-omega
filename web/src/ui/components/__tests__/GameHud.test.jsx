import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';

import GameHud from '../GameHud';
import { gameStore } from '../../../store/gameStore';
import { GameSettingsProvider } from '../../../store/gameSettings';

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

    const { rerender } = render(
      <GameSettingsProvider>
        <GameHud {...BASE_PROPS} />
      </GameSettingsProvider>
    );

    expect(
      screen.getByRole('status', { name: /estado da conexão/i })
    ).toHaveTextContent(/conectando ao servidor/i);

    act(() => {
      gameStore.setPartial({ connectionStatus: 'reconnecting' });
    });
    rerender(
      <GameSettingsProvider>
        <GameHud {...BASE_PROPS} />
      </GameSettingsProvider>
    );
    expect(
      screen.getByRole('status', { name: /estado da conexão/i })
    ).toHaveTextContent(/reconectando ao servidor/i);

    act(() => {
      gameStore.setPartial({ connectionStatus: 'connected' });
    });
    rerender(
      <GameSettingsProvider>
        <GameHud {...BASE_PROPS} />
      </GameSettingsProvider>
    );
    expect(
      screen.queryByRole('status', { name: /estado da conexão/i })
    ).not.toBeInTheDocument();
  });
});

describe('GameHud touch controls', () => {
  it('forward cycle skill handler to touch controls', () => {
    const onCycleSkill = vi.fn();

    render(
      <GameSettingsProvider>
        <GameHud
          {...BASE_PROPS}
          showTouchControls
          joystick={{ isPointerActive: false, position: { x: 0, y: 0 } }}
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
      </GameSettingsProvider>
    );

    const cycleButton = screen.getByRole('button', {
      name: 'Trocar habilidade equipada',
    });

    fireEvent.click(cycleButton);

    expect(onCycleSkill).toHaveBeenCalledTimes(1);
  });
});

describe('GameHud sidebar accessibility', () => {
  it('focuses the sidebar when it is opened', async () => {
    const user = userEvent.setup();

    render(
      <GameSettingsProvider>
        <GameHud {...BASE_PROPS} />
      </GameSettingsProvider>,
    );

    const toggleButton = screen.getByRole('button', { name: /mostrar painel/i });

    await user.click(toggleButton);

    const sidebar = await screen.findByRole('complementary', {
      name: /painel lateral do jogo/i,
    });

    await waitFor(() => {
      const activeElement = document.activeElement;
      expect(activeElement).not.toBe(toggleButton);
      expect(sidebar.contains(activeElement)).toBe(true);
    });
  });

  it('closes when Escape is pressed and restores focus to the toggle button', async () => {
    const user = userEvent.setup();

    render(
      <GameSettingsProvider>
        <GameHud {...BASE_PROPS} />
      </GameSettingsProvider>,
    );

    const toggleButton = screen.getByRole('button', { name: /mostrar painel/i });

    await user.click(toggleButton);

    const sidebar = await screen.findByRole('complementary', {
      name: /painel lateral do jogo/i,
    });

    await waitFor(() => {
      const activeElement = document.activeElement;
      expect(activeElement).not.toBe(toggleButton);
      expect(sidebar.contains(activeElement)).toBe(true);
    });

    await user.keyboard('{Escape}');

    await waitFor(() => expect(toggleButton).toHaveFocus());
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
  });
});

