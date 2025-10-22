import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';

import GameHud from '../GameHud';
import { gameStore } from '../../../store/gameStore';
import { GameSettingsProvider, useGameSettings } from '../../../store/gameSettings';
import * as touchDeviceModule from '../../../hooks/useIsTouchDevice';

const previewMock = vi.fn();
const useSoundPreviewMock = vi.fn(() => ({
  playPreview: previewMock,
  isSupported: true,
}));

vi.mock('../../../hooks/useSoundPreview', () => ({
  __esModule: true,
  default: (...args) => useSoundPreviewMock(...args),
}));

const originalMatchMedia = window.matchMedia;
const createMatchMedia = (matches = false) =>
  vi.fn().mockImplementation((query) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
const useIsTouchDeviceSpy = vi.spyOn(touchDeviceModule, 'default');

beforeEach(() => {
  window.matchMedia = createMatchMedia(false);
  window.localStorage.clear();
  useIsTouchDeviceSpy.mockReturnValue(false);
  previewMock.mockClear();
  useSoundPreviewMock.mockClear();
});

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  useIsTouchDeviceSpy.mockReset();
});

afterAll(() => {
  useIsTouchDeviceSpy.mockRestore();
});

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
  xp: { current: 0, next: 120, total: 0, level: 1 },
  geneticMaterial: { current: 0, total: 0, bonus: 0 },
  characteristicPoints: { total: 0, available: 0, spent: 0, perLevel: [] },
  geneFragments: { minor: 0, major: 0, apex: 0 },
  stableGenes: { minor: 0, major: 0, apex: 0 },
  evolutionSlots: {
    small: { used: 0, max: 0 },
    medium: { used: 0, max: 0 },
    large: { used: 0, max: 0 },
    macro: { used: 0, max: 0 },
  },
  reroll: { baseCost: 25, cost: 25, count: 0, pity: 0 },
  dropPity: { fragment: 0, stableGene: 0 },
  recentRewards: { xp: 0, geneticMaterial: 0, fragments: 0, stableGenes: 0 },
  bossActive: false,
  bossHealth: 0,
  bossMaxHealth: 0,
  bossName: null,
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

const CameraSettingsHarness = (props) => {
  const { updateSettings } = useGameSettings();

  return (
    <GameHud
      {...BASE_PROPS}
      {...props}
      onCameraZoomChange={(value) => {
        updateSettings({ cameraZoom: value });
      }}
    />
  );
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
  let originalConnectionStatus;

  beforeEach(() => {
    const state = gameStore.getState();
    originalConnectionStatus = state.connectionStatus;

    act(() => {
      gameStore.setPartial({ connectionStatus: 'connected', joinError: null });
    });
  });

  afterEach(() => {
    act(() => {
      gameStore.setPartial({
        connectionStatus: originalConnectionStatus,
        joinError: null,
      });
    });
  });

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

describe('GameHud evolution controls', () => {
  let originalConnectionStatus;

  beforeEach(() => {
    const state = gameStore.getState();
    originalConnectionStatus = state.connectionStatus;

    act(() => {
      gameStore.setPartial({ connectionStatus: 'connected', joinError: null });
    });
  });

  afterEach(() => {
    act(() => {
      gameStore.setPartial({
        connectionStatus: originalConnectionStatus,
        joinError: null,
      });
    });
  });

  it('renderiza o botão de evolução no desktop e dispara o callback', async () => {
    const user = userEvent.setup();
    const onOpenEvolutionMenu = vi.fn();

    render(
      <GameSettingsProvider>
        <GameHud
          {...BASE_PROPS}
          canEvolve
          onOpenEvolutionMenu={onOpenEvolutionMenu}
        />
      </GameSettingsProvider>,
    );

    const evolutionButton = screen.getByRole('button', {
      name: /abrir menu de evolução/i,
    });

    expect(evolutionButton).toBe(
      document.querySelector('[data-desktop-evolution-button="true"]'),
    );

    await user.click(evolutionButton);

    expect(onOpenEvolutionMenu).toHaveBeenCalledTimes(1);
  });

  it('não exibe o botão de evolução quando os controles por toque estão ativos', () => {
    render(
      <GameSettingsProvider>
        <GameHud
          {...BASE_PROPS}
          canEvolve
          showTouchControls
          joystick={{ isPointerActive: false, position: { x: 0, y: 0 } }}
        />
      </GameSettingsProvider>,
    );

    expect(
      document.querySelector('[data-desktop-evolution-button="true"]'),
    ).toBeNull();
  });
});

describe('GameHud sidebar accessibility', () => {
  let originalConnectionStatus;

  beforeEach(() => {
    const state = gameStore.getState();
    originalConnectionStatus = state.connectionStatus;

    act(() => {
      gameStore.setPartial({ connectionStatus: 'connected', joinError: null });
    });
  });

  afterEach(() => {
    act(() => {
      gameStore.setPartial({
        connectionStatus: originalConnectionStatus,
        joinError: null,
      });
    });
  });

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

describe('GameHud mobile layout', () => {
  let originalConnectionStatus;
  let originalJoinError;

  beforeEach(() => {
    const state = gameStore.getState();
    originalConnectionStatus = state.connectionStatus;
    originalJoinError = state.joinError;

    window.matchMedia = createMatchMedia(true);

    act(() => {
      gameStore.setPartial({ connectionStatus: 'connected', joinError: null });
    });
  });

  afterEach(() => {
    act(() => {
      gameStore.setPartial({
        connectionStatus: originalConnectionStatus,
        joinError: originalJoinError,
      });
    });
  });

  it('habilita o modo mobile e mantém o painel acessível', () => {
    render(
      <GameSettingsProvider>
        <GameHud {...BASE_PROPS} />
      </GameSettingsProvider>,
    );

    const hud = document.querySelector('[data-mobile-hud="true"]');
    expect(hud).not.toBeNull();

    const toggleButton = screen.getByRole('button', { name: /mostrar painel/i });
    expect(toggleButton).toBeVisible();
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');

    const accordionSummary = screen.getByText('Detalhes do status');
    expect(accordionSummary.tagName.toLowerCase()).toBe('summary');
    expect(accordionSummary.closest('details')).not.toBeNull();
  });
});

describe('GameHud settings panel', () => {
  let originalConnectionStatus;
  let originalJoinError;

  beforeEach(() => {
    const state = gameStore.getState();
    originalConnectionStatus = state.connectionStatus;
    originalJoinError = state.joinError;

    act(() => {
      gameStore.setPartial({ connectionStatus: 'connected', joinError: null });
    });
  });

  afterEach(() => {
    act(() => {
      gameStore.setPartial({
        connectionStatus: originalConnectionStatus,
        joinError: originalJoinError,
      });
    });
  });

  it('permite alternar efeitos sonoros via configurações do jogo', async () => {
    const user = userEvent.setup();

    render(
      <GameSettingsProvider>
        <GameHud {...BASE_PROPS} />
      </GameSettingsProvider>,
    );

    const openButton = screen.getByRole('button', { name: /mostrar painel/i });
    await user.click(openButton);

    await screen.findByRole('slider', { name: /volume dos efeitos sonoros/i });
    const muteButton = screen.getByRole('button', { name: /mutar som/i });
    expect(screen.getByText(/som ligado/i)).toBeInTheDocument();

    await user.click(muteButton);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /ativar som/i })
      ).toBeInTheDocument();
      expect(screen.getByText(/som desligado/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      const stored = window.localStorage.getItem('micr-omega:game-settings');
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored ?? '{}');
      expect(parsed.audioEnabled).toBe(false);
    });

    const unmuteButton = screen.getByRole('button', { name: /ativar som/i });
    await user.click(unmuteButton);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /mutar som/i })
      ).toBeInTheDocument();
      expect(screen.getByText(/som ligado/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      const stored = window.localStorage.getItem('micr-omega:game-settings');
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored ?? '{}');
      expect(parsed.audioEnabled).toBe(true);
    });
  });

  it('exibe o toggle de áudio e persiste a preferência do usuário', async () => {
    const user = userEvent.setup();
    const storageKey = 'micr-omega:game-settings';

    const firstRender = render(
      <GameSettingsProvider>
        <GameHud {...BASE_PROPS} />
      </GameSettingsProvider>,
    );

    const openButton = screen.getByRole('button', { name: /mostrar painel/i });
    await user.click(openButton);

    const volumeSlider = await screen.findByRole('slider', {
      name: /volume dos efeitos sonoros/i,
    });
    expect(volumeSlider).toHaveValue('100');

    fireEvent.change(volumeSlider, { target: { value: '45' } });

    const muteButton = screen.getByRole('button', { name: /mutar som/i });
    await user.click(muteButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /ativar som/i })).toBeInTheDocument();
      expect(screen.getByText(/som desligado/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      const stored = window.localStorage.getItem(storageKey);
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored);
      expect(parsed.audioEnabled).toBe(false);
      expect(parsed.masterVolume).toBeCloseTo(0.45, 5);
    });

    firstRender.unmount();

    const secondUser = userEvent.setup();
    render(
      <GameSettingsProvider>
        <GameHud {...BASE_PROPS} />
      </GameSettingsProvider>,
    );

    const secondOpenButton = screen.getByRole('button', { name: /mostrar painel/i });
    await secondUser.click(secondOpenButton);

    const persistedSlider = await screen.findByRole('slider', {
      name: /volume dos efeitos sonoros/i,
    });
    expect(persistedSlider).toHaveValue('45');
    expect(screen.getByRole('button', { name: /ativar som/i })).toBeInTheDocument();
    expect(screen.getByText(/som desligado/i)).toBeInTheDocument();
  });

  it('persiste a preferência de zoom da câmera após reiniciar o HUD', async () => {
    const user = userEvent.setup();
    const storageKey = 'micr-omega:game-settings';

    const firstRender = render(
      <GameSettingsProvider>
        <CameraSettingsHarness />
      </GameSettingsProvider>,
    );

    const openButton = screen.getByRole('button', { name: /mostrar painel/i });
    await user.click(openButton);

    const zoomSlider = await screen.findByRole('slider', {
      name: /controle de zoom da câmera/i,
    });
    expect(zoomSlider).toHaveValue('1');

    fireEvent.change(zoomSlider, { target: { value: '0.8' } });

    await waitFor(() => {
      expect(zoomSlider).toHaveValue('0.8');
      const stored = window.localStorage.getItem(storageKey);
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored ?? '{}');
      expect(parsed.cameraZoom).toBeCloseTo(0.8, 5);
    });

    firstRender.unmount();

    const secondUser = userEvent.setup();
    render(
      <GameSettingsProvider>
        <CameraSettingsHarness />
      </GameSettingsProvider>,
    );

    const secondOpenButton = screen.getByRole('button', { name: /mostrar painel/i });
    await secondUser.click(secondOpenButton);

    const persistedSlider = await screen.findByRole('slider', {
      name: /controle de zoom da câmera/i,
    });
    expect(persistedSlider).toHaveValue('0.8');
  });

  it('executa a prévia de áudio ao clicar em Testar som', async () => {
    const user = userEvent.setup();

    render(
      <GameSettingsProvider>
        <GameHud {...BASE_PROPS} />
      </GameSettingsProvider>,
    );

    const openButton = screen.getByRole('button', { name: /mostrar painel/i });
    await user.click(openButton);

    const previewButton = await screen.findByRole('button', { name: /testar som/i });
    await user.click(previewButton);

    expect(previewMock).toHaveBeenCalledTimes(1);
  });

  it('não exibe preferências de controles touch quando o dispositivo não é compatível', async () => {
    const user = userEvent.setup();

    render(
      <GameSettingsProvider>
        <GameHud {...BASE_PROPS} />
      </GameSettingsProvider>,
    );

    const openButton = screen.getByRole('button', { name: /mostrar painel/i });
    await user.click(openButton);

    expect(
      screen.queryByRole('heading', { name: /controles touch/i })
    ).not.toBeInTheDocument();
  });

  it('permite configurar controles touch quando disponível', async () => {
    useIsTouchDeviceSpy.mockReturnValue(true);
    const user = userEvent.setup();
    const storageKey = 'micr-omega:game-settings';

    render(
      <GameSettingsProvider>
        <GameHud {...BASE_PROPS} />
      </GameSettingsProvider>,
    );

    const openButton = screen.getByRole('button', { name: /mostrar painel/i });
    await user.click(openButton);

    const touchToggle = await screen.findByRole('checkbox', {
      name: /exibir controles touch/i,
    });
    expect(touchToggle).not.toBeChecked();

    const touchLayoutSelect = screen.getByRole('combobox', {
      name: /layout dos controles touch/i,
    });
    expect(touchLayoutSelect).toBeDisabled();

    const preview = screen.getByRole('img', {
      name: /prévia do layout com botões à direita/i,
    });
    expect(preview).toHaveAttribute('data-layout', 'right');
    expect(preview).toHaveAccessibleName(/botões à direita/i);

    const autoSwapToggle = screen.getByRole('checkbox', {
      name: /ajustar layout automaticamente quando o painel lateral estiver aberto/i,
    });
    expect(autoSwapToggle).toBeDisabled();

    const touchScaleSlider = screen.getByLabelText('Tamanho dos controles');
    const joystickSensitivitySlider = screen.getByLabelText('Sensibilidade do joystick');
    expect(touchScaleSlider).toBeDisabled();
    expect(joystickSensitivitySlider).toBeDisabled();

    await user.click(touchToggle);

    await waitFor(() => {
      expect(touchToggle).toBeChecked();
    });

    await waitFor(() => {
      const stored = window.localStorage.getItem(storageKey);
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored);
      expect(parsed.showTouchControls).toBe(true);
    });

    expect(touchLayoutSelect).not.toBeDisabled();
    expect(autoSwapToggle).not.toBeDisabled();
    expect(touchScaleSlider).not.toBeDisabled();
    expect(joystickSensitivitySlider).not.toBeDisabled();

    await user.selectOptions(touchLayoutSelect, 'left');

    await waitFor(() => {
      expect(touchLayoutSelect).toHaveValue('left');
      expect(preview).toHaveAttribute('data-layout', 'left');
      expect(preview).toHaveAccessibleName(/botões à esquerda/i);
      const stored = window.localStorage.getItem(storageKey);
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored);
      expect(parsed.touchLayout).toBe('left');
    });

    expect(autoSwapToggle).toBeChecked();
    await user.click(autoSwapToggle);

    await waitFor(() => {
      expect(autoSwapToggle).not.toBeChecked();
      const stored = window.localStorage.getItem(storageKey);
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored);
      expect(parsed.autoSwapTouchLayoutWhenSidebarOpen).toBe(false);
    });

    fireEvent.change(touchScaleSlider, { target: { value: '1.4' } });

    await waitFor(() => {
      expect(touchScaleSlider).toHaveValue('1.4');
      expect(preview).toHaveAttribute('data-touch-scale', '1.400');
      const stored = window.localStorage.getItem(storageKey);
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored ?? '{}');
      expect(parsed.touchControlScale).toBeCloseTo(1.4, 5);
    });

    fireEvent.change(joystickSensitivitySlider, { target: { value: '0.6' } });

    await waitFor(() => {
      expect(joystickSensitivitySlider).toHaveValue('0.6');
      expect(preview).toHaveAttribute('data-touch-sensitivity', '0.600');
      const stored = window.localStorage.getItem(storageKey);
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored ?? '{}');
      expect(parsed.joystickSensitivity).toBeCloseTo(0.6, 5);
    });
  });
});

describe('GameHud boss health bar', () => {
  let originalConnectionStatus;
  let originalJoinError;

  beforeEach(() => {
    const state = gameStore.getState();
    originalConnectionStatus = state.connectionStatus;
    originalJoinError = state.joinError;

    act(() => {
      gameStore.setPartial({ connectionStatus: 'connected', joinError: null });
    });
  });

  afterEach(() => {
    act(() => {
      gameStore.setPartial({
        connectionStatus: originalConnectionStatus,
        joinError: originalJoinError,
      });
    });
  });

  it('renderiza o nome personalizado do chefe', () => {
    render(
      <GameSettingsProvider>
        <GameHud
          {...BASE_PROPS}
          bossActive
          bossHealth={320}
          bossMaxHealth={640}
          bossName="Soberano Plasmático"
        />
      </GameSettingsProvider>,
    );

    expect(screen.getByText(/⚠️ Soberano Plasmático/)).toBeInTheDocument();
    expect(
      screen.getByRole('progressbar', { name: /soberano plasmático/i }),
    ).toBeInTheDocument();
  });
});

describe('GameHud notifications layout cues', () => {
  it('mantém o deslocamento padrão sem barra de chefe ativa', () => {
    const longNotification =
      'Notificação prolongada para verificar o espaçamento entre elementos do HUD em cenários normais.';

    render(
      <GameSettingsProvider>
        <GameHud
          {...BASE_PROPS}
          notifications={[{ id: 'long', text: longNotification }]}
        />
      </GameSettingsProvider>,
    );

    const hudRoot = document.querySelector('[data-mobile-hud]');
    expect(hudRoot).toBeInTheDocument();
    expect(hudRoot).not.toHaveAttribute('data-boss-bar-active');
    expect(screen.getByText(longNotification)).toBeInTheDocument();
  });

  it('ativa o deslocamento somado quando a barra de chefe está presente', () => {
    const extendedNotifications = [
      {
        id: 'boss-alert',
        text: 'Alerta de chefe extremamente perigoso aparecendo com mensagem extensa e detalhada.',
      },
      {
        id: 'boss-tip',
        text: 'Dica prolongada: use habilidades de controle de multidão para diminuir o ritmo do inimigo chefe.',
      },
    ];

    render(
      <GameSettingsProvider>
        <GameHud
          {...BASE_PROPS}
          bossActive
          bossHealth={320}
          bossMaxHealth={640}
          bossName="Soberano Plasmático"
          notifications={extendedNotifications}
        />
      </GameSettingsProvider>,
    );

    const hudRoot = document.querySelector('[data-mobile-hud]');
    expect(hudRoot).toBeInTheDocument();
    expect(hudRoot).toHaveAttribute('data-boss-bar-active', 'true');
    extendedNotifications.forEach((notification) => {
      expect(screen.getByText(notification.text)).toBeInTheDocument();
    });
  });
});

