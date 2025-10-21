import type {
  SharedProgressionKillEvent,
  SharedProgressionStream,
} from "./types";

export type GeneCounter = { minor: number; major: number; apex: number };

export const createGeneCounter = (counter?: Partial<GeneCounter> | null): GeneCounter => ({
  minor: Math.max(0, Number.isFinite(counter?.minor) ? Number(counter!.minor) : 0),
  major: Math.max(0, Number.isFinite(counter?.major) ? Number(counter!.major) : 0),
  apex: Math.max(0, Number.isFinite(counter?.apex) ? Number(counter!.apex) : 0),
});

export const cloneGeneCounter = (counter?: GeneCounter | null): GeneCounter =>
  createGeneCounter(counter ?? undefined);

export const incrementGeneCounter = (
  target: GeneCounter,
  increment: Partial<GeneCounter> | undefined,
) => {
  if (!increment) {
    return;
  }
  if (Number.isFinite(increment.minor)) {
    target.minor = Math.max(0, target.minor + Math.max(0, Math.round(increment.minor!)));
  }
  if (Number.isFinite(increment.major)) {
    target.major = Math.max(0, target.major + Math.max(0, Math.round(increment.major!)));
  }
  if (Number.isFinite(increment.apex)) {
    target.apex = Math.max(0, target.apex + Math.max(0, Math.round(increment.apex!)));
  }
};

const MIN_XP_REQUIREMENT = 60;
const BASE_XP_REQUIREMENT = 120;
const XP_REQUIREMENT_GROWTH = 45;

export const getXpRequirementForLevel = (level: number): number => {
  return Math.max(
    MIN_XP_REQUIREMENT,
    BASE_XP_REQUIREMENT + (Math.max(1, level) - 1) * XP_REQUIREMENT_GROWTH,
  );
};

export type PlayerLevelOptions = {
  xpRequirementForLevel?: (level: number) => number;
};

export const getPlayerLevelFromXp = (
  xp: number,
  options?: PlayerLevelOptions,
): number => {
  if (!Number.isFinite(xp)) {
    return 1;
  }

  let remaining = Math.max(0, Math.trunc(xp));
  let level = 1;
  const requirementForLevel = options?.xpRequirementForLevel ?? getXpRequirementForLevel;
  let requirement = requirementForLevel(level);
  let previousRequirement = 0;

  while (remaining >= requirement) {
    remaining -= requirement;
    level += 1;
    previousRequirement = requirement;
    requirement = requirementForLevel(level);

    if (
      !Number.isFinite(requirement) ||
      requirement <= 0 ||
      requirement <= previousRequirement
    ) {
      break;
    }
  }

  return Math.max(1, level);
};

export type PlayerProgressionState = {
  dropPity: { fragment: number; stableGene: number };
  sequence: number;
};

export type PendingProgressionStream = {
  sequence: number;
  dropPity: { fragment: number; stableGene: number };
  damage?: SharedProgressionStream["damage"];
  objectives?: SharedProgressionStream["objectives"];
  kills?: SharedProgressionKillEvent[];
};
