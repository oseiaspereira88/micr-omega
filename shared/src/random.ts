const normalizeSeed = (seed: number | null | undefined): number | undefined => {
  if (!Number.isFinite(seed ?? NaN)) {
    return undefined;
  }
  const normalized = Math.floor(seed as number) >>> 0;
  return normalized;
};

export const toSeedValue = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const scaled = Math.floor(value * 0xffffffff);
  return (scaled >>> 0) >>> 0;
};

export const createMulberry32 = (seed: number): (() => number) => {
  let state = normalizeSeed(seed) ?? 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    const result = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return result;
  };
};

export const combineSeeds = (...seeds: Array<number | null | undefined>): number => {
  let state = 0;
  for (const seed of seeds) {
    const normalized = normalizeSeed(seed);
    if (normalized === undefined) {
      continue;
    }
    state ^= normalized + 0x9e3779b9 + (state << 6) + (state >>> 2);
    state >>>= 0;
  }
  return state >>> 0;
};

export const normalizeSeedValue = normalizeSeed;
