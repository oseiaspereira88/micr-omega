import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import StartScreen, {
  CONTROLS_GUIDE_DONT_SHOW_AGAIN_STORAGE_KEY,
  HAS_SEEN_CONTROLS_GUIDE_STORAGE_KEY,
  START_SCREEN_MOBILE_MEDIA_QUERY,
} from "../StartScreen";
import { GameSettingsProvider, useGameSettings } from "../../store/gameSettings";
import { gameStore, type GameStoreState } from "../../store/gameStore";
import { MIN_NAME_LENGTH, NAME_PATTERN } from "../../utils/messageTypes";
import { INVALID_PLAYER_NAME_MESSAGE } from "../../utils/playerNameStorage";
import React, { useEffect } from "react";
import { featureToggles } from "../../config/featureToggles.js";

const previewMock = vi.fn();
const useSoundPreviewMock = vi.fn(() => ({
  playPreview: previewMock,
  isSupported: true,
}));

vi.mock("../../hooks/useSoundPreview", () => ({
  __esModule: true,
  default: (...args: unknown[]) => useSoundPreviewMock(...args),
}));

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
      damagePopups: [],
    },
    damagePopups: [],
  };
};

const resetStore = () => {
  act(() => {
    gameStore.setState(() => snapshot());
  });
};

const renderWithProviders = (ui: React.ReactNode) =>
  render(<GameSettingsProvider>{ui}</GameSettingsProvider>);

type MediaQueryListener = (event: MediaQueryListEvent) => void;

const createMatchMediaMock = () => {
  const registry = new Map<
    string,
    {
      matches: boolean;
      listeners: Set<MediaQueryListener>;
      lists: Set<MediaQueryList & { _update: (matches: boolean) => void }>;
    }
  >();

  const ensureEntry = (query: string) => {
    if (!registry.has(query)) {
      registry.set(query, {
        matches: false,
        listeners: new Set(),
        lists: new Set(),
      });
    }

    return registry.get(query)!;
  };

  const matchMedia = (query: string): MediaQueryList => {
    const entry = ensureEntry(query);

    const mediaQueryList = {
      matches: entry.matches,
      media: query,
      onchange: null as MediaQueryList["onchange"],
      addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
        if (type === "change" && typeof listener === "function") {
          entry.listeners.add(listener as MediaQueryListener);
        }
      },
      removeEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
        if (type === "change" && typeof listener === "function") {
          entry.listeners.delete(listener as MediaQueryListener);
        }
      },
      addListener: (listener: MediaQueryListener) => {
        entry.listeners.add(listener);
      },
      removeListener: (listener: MediaQueryListener) => {
        entry.listeners.delete(listener);
      },
      dispatchEvent: () => false,
      _update(matches: boolean) {
        if (mediaQueryList.matches === matches) {
          return;
        }

        mediaQueryList.matches = matches;
        const event = { matches, media: query } as MediaQueryListEvent;
        mediaQueryList.onchange?.(event);
      },
    } as MediaQueryList & { _update: (matches: boolean) => void };

    entry.lists.add(mediaQueryList);

    return mediaQueryList;
  };

  const setMatches = (query: string, matches: boolean) => {
    const entry = ensureEntry(query);

    if (entry.matches === matches) {
      return;
    }

    entry.matches = matches;

    const event = { matches, media: query } as MediaQueryListEvent;

    entry.lists.forEach((list) => {
      list._update(matches);
    });

    entry.listeners.forEach((listener) => listener(event));
  };

  return { matchMedia, setMatches };
};

let mediaQueryMock: ReturnType<typeof createMatchMediaMock> | null = null;

const setMobileLayout = (matches: boolean) => {
  mediaQueryMock?.setMatches(START_SCREEN_MOBILE_MEDIA_QUERY, matches);
};

describe("StartScreen", () => {
  beforeEach(() => {
    resetStore();
    previewMock.mockClear();
    useSoundPreviewMock.mockClear();
    if (typeof window !== "undefined") {
      window.localStorage.clear();
      mediaQueryMock = createMatchMediaMock();
      Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: (query: string) => mediaQueryMock!.matchMedia(query),
      });
      setMobileLayout(false);
      window.localStorage.setItem(
        HAS_SEEN_CONTROLS_GUIDE_STORAGE_KEY,
        "true",
      );
      window.localStorage.setItem(
        CONTROLS_GUIDE_DONT_SHOW_AGAIN_STORAGE_KEY,
        "true",
      );
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

  it("configura os atributos de validação do campo de nome", () => {
    renderWithProviders(<StartScreen onStart={() => {}} onQuit={() => {}} />);

    const input = screen.getByLabelText(/nome do jogador/i);

    expect(input).toBeRequired();
    expect(input).toHaveAttribute("aria-required", "true");
    expect(input).toHaveAttribute("minlength", String(MIN_NAME_LENGTH));
    expect(input).toHaveAttribute("maxlength");
    expect(input).toHaveAttribute("pattern", NAME_PATTERN.source);
  });

  it("mantém o foco no campo de nome quando a validação falha", () => {
    renderWithProviders(<StartScreen onStart={() => {}} onQuit={() => {}} />);

    const input = screen.getByLabelText(/nome do jogador/i);
    const startButton = screen.getByRole("button", { name: /entrar na partida/i });

    fireEvent.click(startButton);

    expect(input).toHaveFocus();
  });

  it("exibe o guia de controles acessível quando solicitado", () => {
    renderWithProviders(<StartScreen onStart={() => {}} onQuit={() => {}} />);

    const openGuideButton = screen.getByRole("button", { name: /como jogar/i });
    expect(openGuideButton).toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", {
        name: /como jogar/i,
      }),
    ).not.toBeInTheDocument();

    fireEvent.click(openGuideButton);

    const guideDialog = screen.getByRole("dialog", { name: /como jogar/i });
    expect(guideDialog).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: /teclado/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/W, A, S, D/i)).toBeInTheDocument();

    fireEvent.keyDown(guideDialog, { key: "Escape" });

    expect(
      screen.queryByRole("dialog", {
        name: /como jogar/i,
      }),
    ).not.toBeInTheDocument();
    expect(openGuideButton).toHaveFocus();
  });

  it("abre o guia de controles automaticamente na primeira visita", () => {
    window.localStorage.removeItem(HAS_SEEN_CONTROLS_GUIDE_STORAGE_KEY);
    window.localStorage.removeItem(
      CONTROLS_GUIDE_DONT_SHOW_AGAIN_STORAGE_KEY,
    );

    const { unmount } = renderWithProviders(
      <StartScreen onStart={() => {}} onQuit={() => {}} />,
    );

    const guideDialog = screen.getByRole("dialog", { name: /como jogar/i });
    expect(guideDialog).toBeInTheDocument();

    const preferenceCheckbox = screen.getByRole("checkbox", {
      name: /não mostrar novamente/i,
    });
    expect(preferenceCheckbox).toBeChecked();

    const closeButton = screen.getByRole("button", { name: /fechar/i });
    fireEvent.click(closeButton);

    expect(window.localStorage.getItem(HAS_SEEN_CONTROLS_GUIDE_STORAGE_KEY)).toBe(
      "true",
    );
    expect(
      window.localStorage.getItem(
        CONTROLS_GUIDE_DONT_SHOW_AGAIN_STORAGE_KEY,
      ),
    ).toBe("true");

    unmount();

    const { unmount: unmountSecond } = renderWithProviders(
      <StartScreen onStart={() => {}} onQuit={() => {}} />,
    );

    expect(
      screen.queryByRole("dialog", { name: /como jogar/i }),
    ).not.toBeInTheDocument();

    unmountSecond();
  });

  it("permite reativar a abertura automática do guia de controles", () => {
    const firstRender = renderWithProviders(
      <StartScreen onStart={() => {}} onQuit={() => {}} />,
    );

    const openGuideButton = screen.getByRole("button", { name: /como jogar/i });
    fireEvent.click(openGuideButton);

    const preferenceCheckbox = screen.getByRole("checkbox", {
      name: /não mostrar novamente/i,
    });
    expect(preferenceCheckbox).toBeChecked();

    fireEvent.click(preferenceCheckbox);
    expect(preferenceCheckbox).not.toBeChecked();

    const closeButton = screen.getByRole("button", { name: /fechar/i });
    fireEvent.click(closeButton);

    expect(
      window.localStorage.getItem(
        CONTROLS_GUIDE_DONT_SHOW_AGAIN_STORAGE_KEY,
      ),
    ).toBe("false");

    firstRender.unmount();

    const secondRender = renderWithProviders(
      <StartScreen onStart={() => {}} onQuit={() => {}} />,
    );

    expect(screen.getByRole("dialog", { name: /como jogar/i })).toBeInTheDocument();

    secondRender.unmount();
  });

  it("foca o diálogo ao abrir e mantém o foco preso nele", async () => {
    act(() => {
      gameStore.actions.setConnectionStatus("connected");
      gameStore.actions.setPlayerId("player-1");
    });

    renderWithProviders(<StartScreen onStart={() => {}} onQuit={() => {}} />);

    const dialog = screen.getByRole("dialog", { name: /micro/i });
    const nameInput = screen.getByLabelText(/nome do jogador/i);
    const quitButton = screen.getByRole("button", { name: /desconectar/i });

    expect(dialog).toHaveAttribute("tabindex", "-1");

    await waitFor(() => {
      expect(dialog).toHaveFocus();
    });

    fireEvent.keyDown(dialog, { key: "Tab" });

    await waitFor(() => {
      expect(nameInput).toHaveFocus();
    });

    fireEvent.keyDown(nameInput, { key: "Tab", shiftKey: true });

    await waitFor(() => {
      expect(quitButton).toHaveFocus();
    });

    fireEvent.keyDown(quitButton, { key: "Tab" });

    await waitFor(() => {
      expect(nameInput).toHaveFocus();
    });
  });

  it("mantém o foco preso no layout móvel", async () => {
    setMobileLayout(true);

    renderWithProviders(<StartScreen onStart={() => {}} onQuit={() => {}} />);

    const dialog = screen.getByRole("dialog", { name: /micro/i });
    const nameInput = screen.getByLabelText(/nome do jogador/i);

    await waitFor(() => {
      expect(dialog).toHaveFocus();
    });

    fireEvent.keyDown(dialog, { key: "Tab" });

    await waitFor(() => {
      expect(nameInput).toHaveFocus();
    });

    const startButton = screen.getByRole("button", { name: /entrar na partida/i });
    act(() => {
      startButton.focus();
    });

    fireEvent.keyDown(startButton, { key: "Tab" });

    await waitFor(() => {
      expect(nameInput).toHaveFocus();
    });
  });

  it("persiste o nome sanitizado e envia as configurações", () => {
    const onStart = vi.fn();
    renderWithProviders(<StartScreen onStart={onStart} onQuit={() => {}} />);

    const input = screen.getByLabelText(/nome do jogador/i);
    fireEvent.change(input, { target: { value: "  Alice  " } });

    const volumeSlider = screen.getByRole("slider", {
      name: /volume dos efeitos sonoros/i,
    });
    fireEvent.change(volumeSlider, { target: { value: "72" } });

    const muteButton = screen.getByRole("button", { name: /mutar som/i });
    fireEvent.click(muteButton);
    expect(
      screen.getByRole("button", { name: /ativar som/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/som desligado/i)).toBeInTheDocument();

    const densitySelect = screen.getByLabelText(/densidade visual/i);
    fireEvent.change(densitySelect, { target: { value: "high" } });

    const touchToggle = screen.getByLabelText(/mostrar controles/i);
    const touchLayoutSelect = screen.getByLabelText(
      /layout dos controles touch/i,
    );
    const touchAutoSwapToggle = screen.getByLabelText(/ajuste automático/i);
    expect(touchLayoutSelect).toBeDisabled();
    expect(touchLayoutSelect).toHaveAttribute("aria-disabled", "true");
    expect(
      screen.getByText(/ative os controles touch para escolher o layout/i),
    ).toBeInTheDocument();
    expect(touchAutoSwapToggle).toBeDisabled();
    expect(touchAutoSwapToggle).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(touchToggle);

    expect(touchLayoutSelect).not.toBeDisabled();
    expect(touchAutoSwapToggle).not.toBeDisabled();
    expect(touchAutoSwapToggle).toBeChecked();
    fireEvent.change(touchLayoutSelect, { target: { value: "left" } });
    fireEvent.click(touchAutoSwapToggle);
    expect(touchAutoSwapToggle).not.toBeChecked();

    const startButton = screen.getByRole("button", { name: /entrar na partida/i });
    fireEvent.click(startButton);

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart.mock.calls[0][0]).toMatchObject({
      name: "Alice",
      settings: {
        audioEnabled: false,
        masterVolume: 0.72,
        visualDensity: "high",
        showTouchControls: true,
        showMinimap: featureToggles.minimap,
        touchLayout: "left",
        autoSwapTouchLayoutWhenSidebarOpen: false,
      },
      autoJoinRequested: true,
    });

    expect(gameStore.getState().playerName).toBe("Alice");
    expect(window.localStorage.getItem("micr-omega:player-name")).toBe("Alice");
  });

  it("atualiza a prévia do layout touch conforme a seleção", () => {
    renderWithProviders(<StartScreen onStart={() => {}} onQuit={() => {}} />);

    const preview = screen.getByRole("img", {
      name: /prévia do layout com botões à direita/i,
    });
    expect(preview).toHaveAttribute("data-layout", "right");
    expect(preview).toHaveAccessibleName(/botões à direita/i);

    const touchToggle = screen.getByLabelText(/mostrar controles/i);
    fireEvent.click(touchToggle);

    const touchLayoutSelect = screen.getByLabelText(
      /layout dos controles touch/i,
    );
    fireEvent.change(touchLayoutSelect, { target: { value: "left" } });

    expect(preview).toHaveAttribute("data-layout", "left");
    expect(preview).toHaveAccessibleName(/botões à esquerda/i);
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

    const volumeSlider = screen.getByRole("slider", {
      name: /volume dos efeitos sonoros/i,
    });
    fireEvent.change(volumeSlider, { target: { value: "30" } });

    const muteButton = screen.getByRole("button", { name: /mutar som/i });
    fireEvent.click(muteButton);
    expect(
      screen.getByRole("button", { name: /ativar som/i })
    ).toBeInTheDocument();

    const densitySelect = screen.getByLabelText(/densidade visual/i);
    fireEvent.change(densitySelect, { target: { value: "low" } });

    const touchToggle = screen.getByLabelText(/mostrar controles/i);
    fireEvent.click(touchToggle);

    const touchLayoutSelect = screen.getByLabelText(
      /layout dos controles touch/i,
    );
    const touchAutoSwapToggle = screen.getByLabelText(/ajuste automático/i);
    fireEvent.click(touchAutoSwapToggle);
    fireEvent.change(touchLayoutSelect, { target: { value: "left" } });

    await waitFor(() => {
      expect(settingsSpy).toHaveBeenCalled();
      const lastCall = settingsSpy.mock.calls.at(-1);
      expect(lastCall?.[0]).toMatchObject({
        audioEnabled: false,
        masterVolume: 0.3,
        visualDensity: "low",
        showTouchControls: true,
        showMinimap: featureToggles.minimap,
        touchLayout: "left",
        autoSwapTouchLayoutWhenSidebarOpen: false,
      });
    });
  });

  it("executa uma prévia de áudio ao clicar em Testar som", () => {
    renderWithProviders(<StartScreen onStart={() => {}} onQuit={() => {}} />);

    const previewButton = screen.getByRole("button", { name: /testar som/i });
    fireEvent.click(previewButton);

    expect(previewMock).toHaveBeenCalledTimes(1);
  });

  it("mantém o layout selecionado ao reativar os controles touch", () => {
    renderWithProviders(<StartScreen onStart={() => {}} onQuit={() => {}} />);

    const touchToggle = screen.getByLabelText(/mostrar controles/i);
    fireEvent.click(touchToggle);

    const touchLayoutSelect = screen.getByLabelText(
      /layout dos controles touch/i,
    );
    fireEvent.change(touchLayoutSelect, { target: { value: "left" } });

    fireEvent.click(touchToggle);

    expect(touchLayoutSelect).toBeDisabled();
    expect(touchLayoutSelect).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(touchToggle);

    expect(touchLayoutSelect).toHaveValue("left");
    expect(touchLayoutSelect).not.toBeDisabled();
  });
});
