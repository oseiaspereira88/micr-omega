import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import StartScreen from "../StartScreen";
import { GameSettingsProvider, useGameSettings } from "../../store/gameSettings";
import { gameStore, type GameStoreState } from "../../store/gameStore";
import { MIN_NAME_LENGTH } from "../../utils/messageTypes";
import { INVALID_PLAYER_NAME_MESSAGE } from "../../utils/playerNameStorage";
import React, { useEffect } from "react";
import { featureToggles } from "../../config/featureToggles.js";

const baseState = gameStore.getState();

const snapshot = (): GameStoreState => {
  const emptyPlayers = { byId: {}, all: [] };
  const emptyMicroorganisms = { byId: {}, all: [] };
  const emptyOrganic = { byId: {}, all: [] };
  const emptyObstacles = { byId: {}, all: [] };
  const emptyRoomObjects = { byId: {}, all: [] };

  return {
    ...baseState,
    room: { ...baseState.room },
    players: emptyPlayers.byId,
    remotePlayers: emptyPlayers,
    ranking: [],
    microorganisms: emptyMicroorganisms,
    organicMatter: emptyOrganic,
    obstacles: emptyObstacles,
    roomObjects: emptyRoomObjects,
    connectionStatus: "idle",
    playerId: null,
    playerName: null,
    joinError: null,
    world: {
      microorganisms: emptyMicroorganisms.all,
      organicMatter: emptyOrganic.all,
      obstacles: emptyObstacles.all,
      roomObjects: emptyRoomObjects.all,
    },
  };
};

const resetStore = () => {
  act(() => {
    gameStore.setState(() => snapshot());
  });
};

const renderWithProviders = (ui: React.ReactNode) =>
  render(<GameSettingsProvider>{ui}</GameSettingsProvider>);

describe("StartScreen", () => {
  beforeEach(() => {
    resetStore();
    if (typeof window !== "undefined") {
      window.localStorage.clear();
    }
  });

  afterEach(() => {
    resetStore();
    if (typeof window !== "undefined") {
      window.localStorage.clear();
    }
  });

  it("valida o nome antes de entrar na partida", () => {
    const onStart = vi.fn();
    renderWithProviders(<StartScreen onStart={onStart} onQuit={() => {}} />);

    const startButton = screen.getByRole("button", { name: /entrar na partida/i });
    fireEvent.click(startButton);

    expect(onStart).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Informe um nome");

    const input = screen.getByLabelText(/nome do jogador/i);
    fireEvent.change(input, { target: { value: "a".repeat(MIN_NAME_LENGTH - 1) } });
    fireEvent.click(startButton);

    expect(onStart).not.toHaveBeenCalled();
    const validationAlert = screen.getByRole("alert");
    expect(validationAlert).toHaveTextContent(INVALID_PLAYER_NAME_MESSAGE);
    expect(validationAlert.textContent).toBe(INVALID_PLAYER_NAME_MESSAGE);
  });

  it("mantém o foco no campo de nome quando a validação falha", () => {
    renderWithProviders(<StartScreen onStart={() => {}} onQuit={() => {}} />);

    const input = screen.getByLabelText(/nome do jogador/i);
    const startButton = screen.getByRole("button", { name: /entrar na partida/i });

    fireEvent.click(startButton);

    expect(input).toHaveFocus();
  });

  it("persiste o nome sanitizado e envia as configurações", () => {
    const onStart = vi.fn();
    renderWithProviders(<StartScreen onStart={onStart} onQuit={() => {}} />);

    const input = screen.getByLabelText(/nome do jogador/i);
    fireEvent.change(input, { target: { value: "  Alice  " } });

    const audioToggle = screen.getByLabelText(/som ligado/i);
    fireEvent.click(audioToggle); // desativa áudio
    expect(audioToggle).toHaveAccessibleName(/som desligado/i);

    const densitySelect = screen.getByLabelText(/densidade visual/i);
    fireEvent.change(densitySelect, { target: { value: "high" } });

    const touchLayoutSelect = screen.getByLabelText(/layout dos controles touch/i);
    fireEvent.change(touchLayoutSelect, { target: { value: "left" } });

    const touchToggle = screen.getByLabelText(/mostrar controles/i);
    fireEvent.click(touchToggle);

    const startButton = screen.getByRole("button", { name: /entrar na partida/i });
    fireEvent.click(startButton);

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart.mock.calls[0][0]).toMatchObject({
      name: "Alice",
      settings: {
        audioEnabled: false,
        visualDensity: "high",
        showTouchControls: true,
        showMinimap: featureToggles.minimap,
        touchLayout: "left",
      },
      autoJoinRequested: true,
    });

    expect(gameStore.getState().playerName).toBe("Alice");
    expect(window.localStorage.getItem("micr-omega:player-name")).toBe("Alice");
  });

  it("preenche o campo com o nome persistido sem atualizar o store", async () => {
    const persistedName = "Persistido";
    window.localStorage.setItem("micr-omega:player-name", persistedName);

    renderWithProviders(<StartScreen onStart={() => {}} onQuit={() => {}} />);

    const input = screen.getByLabelText(/nome do jogador/i);

    await waitFor(() => {
      expect(input).toHaveValue(persistedName);
    });

    expect(gameStore.getState().playerName).toBeNull();
  });

  it("mantém o nome persistido ao sair", () => {
    const onQuit = vi.fn();

    act(() => {
      gameStore.actions.setPlayerName("Carol");
      gameStore.actions.setPlayerId("player-1");
      gameStore.actions.setConnectionStatus("connected");
    });

    window.localStorage.setItem("micr-omega:player-name", "Carol");

    renderWithProviders(<StartScreen onStart={() => {}} onQuit={onQuit} />);

    const quitButton = screen.getByRole("button", { name: /desconectar/i });
    fireEvent.click(quitButton);

    expect(onQuit).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem("micr-omega:player-name")).toBe("Carol");
  });

  it("não exibe o controle de desconexão quando não há sessão ativa", () => {
    renderWithProviders(<StartScreen onStart={() => {}} onQuit={() => {}} />);

    expect(
      screen.queryByRole("button", { name: /desconectar/i })
    ).not.toBeInTheDocument();
  });

  it("atualiza o store de configurações quando os toggles mudam", async () => {
    const settingsSpy = vi.fn();

    const SettingsObserver = ({ onChange }: { onChange: (value: ReturnType<typeof useGameSettings>["settings"]) => void }) => {
      const { settings } = useGameSettings();
      useEffect(() => {
        onChange(settings);
      }, [onChange, settings]);
      return null;
    };

    render(
      <GameSettingsProvider>
        <SettingsObserver onChange={settingsSpy} />
        <StartScreen onStart={() => {}} onQuit={() => {}} />
      </GameSettingsProvider>
    );

    const audioToggle = screen.getByLabelText(/som ligado/i);
    fireEvent.click(audioToggle);
    expect(audioToggle).toHaveAccessibleName(/som desligado/i);

    const densitySelect = screen.getByLabelText(/densidade visual/i);
    fireEvent.change(densitySelect, { target: { value: "low" } });

    const touchLayoutSelect = screen.getByLabelText(/layout dos controles touch/i);
    fireEvent.change(touchLayoutSelect, { target: { value: "left" } });

    const touchToggle = screen.getByLabelText(/mostrar controles/i);
    fireEvent.click(touchToggle);

    await waitFor(() => {
      expect(settingsSpy).toHaveBeenCalled();
      const lastCall = settingsSpy.mock.calls.at(-1);
      expect(lastCall?.[0]).toMatchObject({
        audioEnabled: false,
        visualDensity: "low",
        showTouchControls: true,
        showMinimap: featureToggles.minimap,
        touchLayout: "left",
      });
    });
  });
});
