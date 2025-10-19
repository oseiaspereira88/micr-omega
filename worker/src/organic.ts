import { createMulberry32, normalizeSeedValue, toSeedValue } from "@micr-omega/shared";
import type { OrganicMatterAppearance } from "@micr-omega/shared";

export const ORGANIC_TYPE_KEYS = ["protein", "lipid", "carbohydrate", "vitamin"] as const;
export type OrganicTypeKey = (typeof ORGANIC_TYPE_KEYS)[number];

const DEFAULT_ORGANIC_TYPE: OrganicTypeKey = "protein";

const isValidOrganicType = (value?: string | null): value is OrganicTypeKey =>
  typeof value === "string" && ORGANIC_TYPE_KEYS.includes(value as OrganicTypeKey);

const selectOrganicType = (
  rng: () => number,
  fallback?: string | null,
): OrganicTypeKey => {
  if (isValidOrganicType(fallback)) {
    return fallback;
  }
  const index = Math.floor(rng() * ORGANIC_TYPE_KEYS.length);
  return ORGANIC_TYPE_KEYS[index] ?? DEFAULT_ORGANIC_TYPE;
};

export type OrganicClusterPlanEntry = {
  scatterAngle: number;
  scatterDistance: number;
  delayFactor: number;
  appearance: OrganicMatterAppearance;
};

export type OrganicClusterPlan = {
  size: number;
  entries: OrganicClusterPlanEntry[];
};

export type OrganicClusterPlanOptions = {
  remaining: number;
  scatterMin: number;
  scatterRadius: number;
  fallbackType?: OrganicMatterAppearance["type"];
  sizeOverride?: number;
};

export const planOrganicCluster = (
  seed: number,
  options: OrganicClusterPlanOptions,
): OrganicClusterPlan => {
  const normalizedSeed = normalizeSeedValue(seed) ?? 0;
  const rng = createMulberry32(normalizedSeed);
  const baseSize = options.sizeOverride ?? Math.floor(rng() * 3) + 3;
  const size = Math.max(1, Math.min(options.remaining, baseSize));
  const type = selectOrganicType(rng, options.fallbackType);
  const entries: OrganicClusterPlanEntry[] = [];

  for (let index = 0; index < size; index += 1) {
    const scatterAngle = rng() * Math.PI * 2;
    const scatterDistance = options.scatterMin + rng() * options.scatterRadius;
    const delayFactor = rng();
    const seedValue = toSeedValue(rng());
    const appearance: OrganicMatterAppearance = {
      type,
      seed: seedValue,
      clusterSeed: normalizedSeed,
      clusterIndex: index,
    };
    entries.push({ scatterAngle, scatterDistance, delayFactor, appearance });
  }

  return { size, entries };
};

