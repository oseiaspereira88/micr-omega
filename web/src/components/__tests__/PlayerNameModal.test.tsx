import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import PlayerNameModal from "../PlayerNameModal";
import { gameStore, type GameStoreState } from "../../store/gameStore";

const baseState = gameStore.getState();

const snapshot = (): GameStoreState => ({
  ...baseState,
  room: { ...baseState.room },
  players: {},
  ranking: [],
  connectionStatus: "idle",
  playerId: null,
  playerName: null,
  joinError: null,
});

const resetStore = () => {
  act(() => {
    gameStore.setState(() => snapshot());
  });
};

describe("PlayerNameModal", () => {
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

  it("remains visible while a connection is in progress", async () => {
    render(<PlayerNameModal />);

    act(() => {
      gameStore.setState(() => ({
        ...snapshot(),
        connectionStatus: "connecting",
        playerName: "Alice",
      }));
    });

    const input = await screen.findByLabelText("Nome do jogador");
    expect(input).toBeVisible();
  });

  it("hides once the player is connected", async () => {
    render(<PlayerNameModal />);

    act(() => {
      gameStore.setState(() => ({
        ...snapshot(),
        connectionStatus: "connected",
        playerName: "Alice",
        playerId: "player-1",
      }));
    });

    await waitFor(() => {
      expect(screen.queryByLabelText("Nome do jogador")).not.toBeInTheDocument();
    });
  });
});
