import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import RankingPanel from "../RankingPanel";
import { gameStore, type GameStoreState } from "../../store/gameStore";
import type { SharedPlayerState } from "../../utils/messageTypes";

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
    expect(screen.getByText("Aguardando")).toBeVisible();
    expect(
      screen.getByText("Aguardando o início da partida para receber o ranking.")
    ).toBeInTheDocument();
  });

  it("shows connection-aware placeholder messages", () => {
    render(<RankingPanel />);

    act(() => {
      gameStore.setState(() => ({
        ...snapshot(),
        connectionStatus: "disconnected",
      }));
    });

    expect(screen.getByText("Offline")).toBeVisible();
    expect(
      screen.getByText("Conexão perdida. Atualizaremos assim que o servidor responder novamente.")
    ).toBeInTheDocument();
  });

  it("highlights ordering, connection badges and the local player", () => {
    render(<RankingPanel />);

    act(() => {
      const players: GameStoreState["players"] = {
        alpha: createPlayer({
          id: "alpha",
          name: "Alice",
          connected: true,
          score: 4200,
          combo: 2,
          lastActiveAt: 10_000,
        }),
        beta: createPlayer({
          id: "beta",
          name: "Bruno",
          connected: false,
          score: 3150,
          combo: 1,
          lastActiveAt: 9_000,
        }),
      };
      const remotePlayers = {
        byId: players,
        all: Object.values(players),
      };

      gameStore.setState(() => ({
        ...snapshot(),
        connectionStatus: "connected",
        playerId: "beta",
        players,
        remotePlayers,
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
    expect(items[0]).toHaveAccessibleName(
      "1º lugar — Alice — 4.200 pontos — 100% da pontuação do líder — conectado",
    );

    const secondRow = within(items[1]!);
    expect(secondRow.getByText("2")).toBeVisible();
    expect(secondRow.getByText("Bruno")).toBeVisible();
    expect(secondRow.getByText("3.150")).toBeVisible();
    expect(secondRow.getByText("Você")).toBeVisible();
    expect(secondRow.getByLabelText("Jogador desconectado")).toBeVisible();
    expect(items[1]).toHaveAttribute("aria-current", "true");
    expect(items[1]).toHaveAccessibleName(
      "2º lugar — Você — 3.150 pontos — 75% da pontuação do líder — desconectado",
    );
  });

  it("matches snapshot for a populated ranking", () => {
    const { asFragment } = render(<RankingPanel />);

    act(() => {
      const players: GameStoreState["players"] = {
        alpha: createPlayer({
          id: "alpha",
          name: "Alice",
          connected: true,
          score: 4_200,
          combo: 2,
          lastActiveAt: 10_000,
        }),
        beta: createPlayer({
          id: "beta",
          name: "Bruno",
          connected: false,
          score: 3_150,
          combo: 1,
          lastActiveAt: 9_000,
        }),
      };
      const remotePlayers = {
        byId: players,
        all: Object.values(players),
      };

      gameStore.setState(() => ({
        ...snapshot(),
        connectionStatus: "connected",
        playerId: "beta",
        players,
        remotePlayers,
        ranking: [
          { playerId: "alpha", name: "Alice", score: 4_200 },
          { playerId: "beta", name: "Bruno", score: 3_150 },
        ],
      }));
    });

    expect(asFragment()).toMatchSnapshot();
  });

  it("orders ranking entries by score and name for ties", () => {
    render(<RankingPanel />);

    act(() => {
      const players: GameStoreState["players"] = {
        a: createPlayer({
          id: "a",
          name: "Ana",
          connected: true,
          score: 2_500,
          combo: 1,
          lastActiveAt: 1_000,
        }),
        b: createPlayer({
          id: "b",
          name: "Bruno",
          connected: true,
          score: 3_000,
          combo: 1,
          lastActiveAt: 2_000,
        }),
        c: createPlayer({
          id: "c",
          name: "Carla",
          connected: true,
          score: 3_000,
          combo: 1,
          lastActiveAt: 3_000,
        }),
      };
      const remotePlayers = {
        byId: players,
        all: Object.values(players),
      };

      gameStore.setState(() => ({
        ...snapshot(),
        connectionStatus: "connected",
        players,
        remotePlayers,
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

  it("ignores accents when comparing names and falls back to playerId", () => {
    render(<RankingPanel />);

    act(() => {
      const players: GameStoreState["players"] = {
        one: createPlayer({
          id: "one",
          name: "Ágata",
          connected: true,
          score: 4_000,
          combo: 1,
          lastActiveAt: 4_000,
        }),
        two: createPlayer({
          id: "two",
          name: "Agata",
          connected: true,
          score: 4_000,
          combo: 1,
          lastActiveAt: 5_000,
        }),
        three: createPlayer({
          id: "three",
          name: "Bruno",
          connected: true,
          score: 4_000,
          combo: 1,
          lastActiveAt: 6_000,
        }),
      };

      const remotePlayers = {
        byId: players,
        all: Object.values(players),
      };

      gameStore.setState(() => ({
        ...snapshot(),
        connectionStatus: "connected",
        players,
        remotePlayers,
        ranking: [
          { playerId: "three", name: "Bruno", score: 4_000 },
          { playerId: "two", name: "Agata", score: 4_000 },
          { playerId: "one", name: "Ágata", score: 4_000 },
        ],
      }));
    });

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);

    const [first, second, third] = items;
    expect(within(first!).getByText("Ágata")).toBeVisible();
    expect(within(second!).getByText("Agata")).toBeVisible();
    expect(within(third!).getByText("Bruno")).toBeVisible();
  });
});
const createPlayer = (
  overrides: Partial<SharedPlayerState> & Pick<SharedPlayerState, "id" | "name">
): SharedPlayerState => ({
  id: overrides.id,
  name: overrides.name,
  connected: overrides.connected ?? true,
  score: overrides.score ?? 0,
  combo: overrides.combo ?? 1,
  energy: overrides.energy ?? 0,
  xp: overrides.xp ?? 0,
  geneticMaterial: overrides.geneticMaterial ?? 0,
  lastActiveAt: overrides.lastActiveAt ?? 0,
  position: overrides.position ?? { x: 0, y: 0 },
  movementVector: overrides.movementVector ?? { x: 0, y: 0 },
  orientation: overrides.orientation ?? { angle: 0 },
  health: overrides.health ?? { current: 100, max: 100 },
  combatStatus:
    overrides.combatStatus ?? {
      state: "idle",
      targetPlayerId: null,
      targetObjectId: null,
      lastAttackAt: null,
    },
  combatAttributes:
    overrides.combatAttributes ?? {
      attack: 1,
      defense: 1,
      speed: 1,
      range: 1,
    },
  skillList: overrides.skillList ?? [],
  currentSkill: overrides.currentSkill ?? null,
  skillCooldowns: overrides.skillCooldowns ?? {},
});
