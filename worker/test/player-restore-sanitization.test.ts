import { describe, expect, it } from "vitest";
import type { DurableObjectState } from "@cloudflare/workers-types";

import type { Env } from "../src";
import { RoomDO } from "../src/RoomDO";
import {
  DEFAULT_DASH_CHARGE,
  DEFAULT_PLAYER_ENERGY,
  DEFAULT_PLAYER_GENETIC_MATERIAL,
  DEFAULT_PLAYER_XP,
  type StoredPlayerSnapshot,
} from "../src/playerManager";
import { MockDurableObjectState } from "./utils/mock-state";

const PLAYERS_KEY = "players";

const createStoredPlayer = (
  overrides: Partial<Record<keyof StoredPlayerSnapshot, unknown>>,
): StoredPlayerSnapshot => ({
  id: "player-1",
  name: "Player One",
  score: 0,
  combo: 0,
  energy: DEFAULT_PLAYER_ENERGY,
  xp: DEFAULT_PLAYER_XP,
  geneticMaterial: DEFAULT_PLAYER_GENETIC_MATERIAL,
  geneFragments: { minor: 0, major: 0, apex: 0 },
  stableGenes: { minor: 0, major: 0, apex: 0 },
  dashCharge: DEFAULT_DASH_CHARGE,
  dashCooldownMs: 0,
  archetypeKey: null,
  characteristicPoints: { total: 0, available: 0, spent: 0 },
  reconnectTokenHash: "hash-1",
  totalSessionDurationMs: 0,
  sessionCount: 0,
  ...overrides,
} as StoredPlayerSnapshot);

describe("RoomDO player restoration", () => {
  it("skips invalid records and preserves name/id consistency", async () => {
    const mockState = new MockDurableObjectState();

    const storedPlayers: StoredPlayerSnapshot[] = [
      createStoredPlayer({ id: " valid-player ", name: "  Valid Player  ", reconnectTokenHash: "hash-valid" }),
      createStoredPlayer({ id: "   ", name: "Ghost", reconnectTokenHash: "hash-missing-id" }),
      createStoredPlayer({ id: "player-missing-name", name: "   ", reconnectTokenHash: "hash-missing-name" }),
      createStoredPlayer({ id: "player-invalid-name", name: "!!", reconnectTokenHash: "hash-invalid-name" }),
    ];

    await mockState.storage.put(PLAYERS_KEY, storedPlayers);

    const room = new RoomDO(mockState as unknown as DurableObjectState, {} as Env);
    await (room as any).ready;

    const players: Map<string, any> = (room as any).players;
    const nameToPlayerId: Map<string, string> = (room as any).nameToPlayerId;

    expect(players.size).toBe(1);
    expect(nameToPlayerId.size).toBe(1);

    const [[playerId, player]] = [...players.entries()];
    expect(playerId).toBe("valid-player");
    expect(player.id).toBe("valid-player");
    expect(player.name).toBe("Valid Player");

    const [[normalizedName, mappedId]] = [...nameToPlayerId.entries()];
    expect(normalizedName).toBe("valid player");
    expect(mappedId).toBe("valid-player");

    expect(players.get(mappedId)?.name.toLowerCase()).toBe(normalizedName);
  });

  it("sanitizes corrupted score and combo values for ranking", async () => {
    const mockState = new MockDurableObjectState();

    const storedPlayers: StoredPlayerSnapshot[] = [
      createStoredPlayer({
        id: "player-1",
        name: "Player One",
        score: "123.4",
        combo: "5",
        reconnectTokenHash: "hash-1"
      }),
      createStoredPlayer({
        id: "player-2",
        name: "Player Two",
        score: Number.POSITIVE_INFINITY,
        combo: Number.NEGATIVE_INFINITY,
        reconnectTokenHash: "hash-2"
      })
    ];

    await mockState.storage.put(PLAYERS_KEY, storedPlayers);

    const room = new RoomDO(mockState as unknown as DurableObjectState, {} as Env);
    await (room as any).ready;

    const players: Map<string, any> = (room as any).players;
    const playerOne = players.get("player-1");
    const playerTwo = players.get("player-2");

    expect(playerOne?.score).toBeCloseTo(123.4);
    expect(playerOne?.combo).toBe(5);
    expect(playerTwo?.score).toBe(0);
    expect(playerTwo?.combo).toBe(1);

    for (const player of players.values()) {
      player.connected = true;
    }

    (room as any).rankingDirty = true;
    const ranking = (room as any).getRanking();

    expect(ranking).toEqual([
      { playerId: "player-1", name: "Player One", score: 123.4 },
      { playerId: "player-2", name: "Player Two", score: 0 }
    ]);
  });
});

