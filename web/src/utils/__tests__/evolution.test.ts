import { describe, expect, it } from "vitest";

import { buildEvolutionPayload } from "../evolution";

describe("buildEvolutionPayload", () => {
  it("deduplicates and trims trait deltas", () => {
    const payload = buildEvolutionPayload({
      evolutionId: " evo-1 ",
      traitDeltas: [" stealth ", "stealth", "power", "", null, undefined],
      countDelta: 1,
    });

    expect(payload).not.toBeNull();
    expect(payload?.traitDeltas).toEqual(["stealth", "power"]);
  });

  it("truncates countDelta values", () => {
    const payload = buildEvolutionPayload({
      evolutionId: "evo-2",
      countDelta: 2.9,
    });

    expect(payload?.countDelta).toBe(2);
  });

  it("filters out zero-value adjustments", () => {
    const payload = buildEvolutionPayload({
      evolutionId: "evo-3",
      countDelta: 1,
      additiveDelta: { attack: 0, defense: 2 },
      multiplierDelta: { speed: 0, health: 1.5 },
      baseDelta: { mana: 0, stamina: -3 },
    });

    expect(payload?.additiveDelta).toEqual({ defense: 2 });
    expect(payload?.multiplierDelta).toEqual({ health: 1.5 });
    expect(payload?.baseDelta).toEqual({ stamina: -3 });
  });
});
