import { render, screen } from "@testing-library/react";
import { describe, beforeEach, it, expect } from "vitest";
import RankingPanel from "../RankingPanel";
import { gameStore } from "../../store/gameStore";
import type { GameStoreState } from "../../store/gameStore";

type PartialState = Pick<
  GameStoreState,
  "connectionStatus" | "playerId" | "players" | "ranking"
>;

const resetStore = (partial?: PartialState) => {
  const baseline: GameStoreState = {
    connectionStatus: "idle",
    reconnectAttempts: 0,
    reconnectUntil: null,
    playerId: null,
    playerName: null,
    joinError: null,
    lastPingAt: null,
    lastPongAt: null,
    room: {
      phase: "waiting",
      roundId: null,
      roundStartedAt: null,
      roundEndsAt: null
    },
    players: {},
    ranking: []
  };

  gameStore.setState(() => ({
    ...baseline,
    ...partial,
    players: partial?.players ?? baseline.players,
    ranking: partial?.ranking ?? baseline.ranking
  }));
};

describe("RankingPanel", () => {
  beforeEach(() => {
    resetStore();
  });

  it("renders placeholder when ranking is empty", () => {
    render(<RankingPanel />);

    expect(
      screen.getByRole("complementary", { name: "Ranking da partida" })
    ).toBeInTheDocument();
    expect(screen.getByText("Sem dados")).toBeInTheDocument();
    expect(
      screen.getByText("Aguarde o servidor enviar a classificação em tempo real.")
    ).toBeInTheDocument();
  });

  it("highlights the local player and connection status", () => {
    resetStore({
      connectionStatus: "connected",
      playerId: "alice",
      players: {
        alice: {
          id: "alice",
          name: "Alice",
          score: 900,
          combo: 3,
          connected: true,
          lastActiveAt: 10_000
        },
        bob: {
          id: "bob",
          name: "Bob",
          score: 700,
          combo: 2,
          connected: false,
          lastActiveAt: 8_000
        }
      },
      ranking: [
        { playerId: "alice", name: "Alice", score: 900 },
        { playerId: "bob", name: "Bob", score: 700 }
      ]
    });

    render(<RankingPanel />);

    const panel = screen.getByRole("complementary", { name: "Ranking da partida" });
    expect(panel).toBeInTheDocument();
    expect(screen.getByText("Ao vivo")).toBeInTheDocument();
    expect(screen.getByText("Você")).toBeInTheDocument();

    const rankingItems = panel.querySelectorAll("li");
    expect(rankingItems.length).toBe(2);
    expect(rankingItems[0]?.textContent).toContain("Alice");
    expect(rankingItems[1]?.textContent).toContain("Bob");
    expect(rankingItems[1]?.textContent).toContain("⚠️");
  });
});
