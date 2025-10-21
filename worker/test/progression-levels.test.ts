import { describe, expect, it } from "vitest";

import { getPlayerLevelFromXp, getXpRequirementForLevel } from "../src/progression";

const xpToReachLevel = (targetLevel: number): number => {
  let total = 0;
  for (let level = 1; level < targetLevel; level += 1) {
    total += getXpRequirementForLevel(level);
  }
  return total;
};

describe("getPlayerLevelFromXp", () => {
  it("scales without an artificial level cap", () => {
    const xpForLevel400 = xpToReachLevel(400);

    expect(getPlayerLevelFromXp(xpForLevel400)).toBe(400);
    expect(getPlayerLevelFromXp(xpForLevel400 + 1)).toBe(400);
  });

  it("stops leveling if requirements stop increasing", () => {
    const constantRequirement = () => 100;

    expect(getPlayerLevelFromXp(10_000, { xpRequirementForLevel: constantRequirement })).toBe(2);
  });
});

