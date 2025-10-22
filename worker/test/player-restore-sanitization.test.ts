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

  it("sanitizes corrupted score and combo values before ranking", async () => {
    const mockState = new MockDurableObjectState();

    const storedPlayers: StoredPlayerSnapshot[] = [
      createStoredPlayer({
        id: "player-1",
        name: "Player One",
        score: "9000",
        combo: "999",
        reconnectTokenHash: "hash-1",
      }),
      createStoredPlayer({
        id: "player-2",
        name: "Player Two",
        score: Infinity,
        combo: "-5",
        reconnectTokenHash: "hash-2",
      }),
      createStoredPlayer({
        id: "player-3",
        name: "Player Three",
        score: "NaN",
        combo: "not-a-number",
        reconnectTokenHash: "hash-3",
      }),
    ];

    await mockState.storage.put(PLAYERS_KEY, storedPlayers);

    const room = new RoomDO(mockState as unknown as DurableObjectState, {} as Env);
    await (room as any).ready;

    const players: Map<string, any> = (room as any).players;

    expect(players.get("player-1")?.score).toBe(9000);
    expect(players.get("player-1")?.combo).toBe(50);

    expect(players.get("player-2")?.score).toBe(0);
    expect(players.get("player-2")?.combo).toBe(1);

    expect(players.get("player-3")?.score).toBe(0);
    expect(players.get("player-3")?.combo).toBe(1);

    for (const player of players.values()) {
      player.connected = true;
    }
    (room as any).markRankingDirty();

    const ranking = (room as any).getRanking();

    expect(ranking).toEqual([
      { playerId: "player-1", name: "Player One", score: 9000 },
      { playerId: "player-3", name: "Player Three", score: 0 },
      { playerId: "player-2", name: "Player Two", score: 0 },
    ]);
  });
});

