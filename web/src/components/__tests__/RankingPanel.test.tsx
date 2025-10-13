import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import RankingPanel from "../RankingPanel";
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

describe("RankingPanel", () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    resetStore();
  });

  it("renders placeholder content when no ranking is available", () => {
    render(<RankingPanel />);

    expect(screen.getByRole("complementary", { name: "Ranking da partida" })).toBeInTheDocument();
    expect(screen.getByText("Sem dados")).toBeVisible();
    expect(
      screen.getByText("Aguarde o servidor enviar a classificação em tempo real.")
    ).toBeInTheDocument();
  });

  it("highlights ordering, connection badges and the local player", () => {
    render(<RankingPanel />);

    act(() => {
      const players: GameStoreState["players"] = {
        alpha: {
          id: "alpha",
          name: "Alice",
          connected: true,
          score: 4200,
          combo: 2,
          lastActiveAt: 10_000,
        },
        beta: {
          id: "beta",
          name: "Bruno",
          connected: false,
          score: 3150,
          combo: 1,
          lastActiveAt: 9_000,
        },
      };

      gameStore.setState(() => ({
        ...snapshot(),
        connectionStatus: "connected",
        playerId: "beta",
        players,
        ranking: [
          { playerId: "alpha", name: "Alice", score: 4200 },
          { playerId: "beta", name: "Bruno", score: 3150 },
        ],
      }));
    });

    expect(screen.getByText("Ranking")).toBeInTheDocument();
    expect(screen.getByText("Ao vivo")).toBeVisible();

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);

    const firstRow = within(items[0]!);
    expect(firstRow.getByText("1")).toBeVisible();
    expect(firstRow.getByText("Alice")).toBeVisible();
    expect(firstRow.getByText("4.200")).toBeVisible();

    const secondRow = within(items[1]!);
    expect(secondRow.getByText("2")).toBeVisible();
    expect(secondRow.getByText("Bruno")).toBeVisible();
    expect(secondRow.getByText("3.150")).toBeVisible();
    expect(secondRow.getByText("Você")).toBeVisible();
    expect(secondRow.getByLabelText("Jogador desconectado")).toBeVisible();
  });

  it("orders ranking entries by score and name for ties", () => {
    render(<RankingPanel />);

    act(() => {
      const players: GameStoreState["players"] = {
        a: {
          id: "a",
          name: "Ana",
          connected: true,
          score: 2_500,
          combo: 1,
          lastActiveAt: 1_000,
        },
        b: {
          id: "b",
          name: "Bruno",
          connected: true,
          score: 3_000,
          combo: 1,
          lastActiveAt: 2_000,
        },
        c: {
          id: "c",
          name: "Carla",
          connected: true,
          score: 3_000,
          combo: 1,
          lastActiveAt: 3_000,
        },
      };

      gameStore.setState(() => ({
        ...snapshot(),
        connectionStatus: "connected",
        players,
        ranking: [
          { playerId: "a", name: "Ana", score: 2_500 },
          { playerId: "c", name: "Carla", score: 3_000 },
          { playerId: "b", name: "Bruno", score: 3_000 },
        ],
      }));
    });

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);

    const [first, second, third] = items;
    expect(within(first!).getByText("Bruno")).toBeVisible();
    expect(within(second!).getByText("Carla")).toBeVisible();
    expect(within(third!).getByText("Ana")).toBeVisible();
  });
});
