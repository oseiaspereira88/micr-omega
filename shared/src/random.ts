export type SeededRandom = () => number;

const UINT32_MAX = 0xffffffff;

const normalizeSeed = (seed: number): number => {
  if (!Number.isFinite(seed)) {
    return 1;
  }

  const normalized = Math.floor(Math.abs(seed)) >>> 0;
  if (normalized === 0) {
    return 1;
  }
  return normalized;
};

export const createMulberry32 = (seed: number): SeededRandom => {
  let state = normalizeSeed(seed);

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    const result = ((t ^ (t >>> 14)) >>> 0) / (UINT32_MAX + 1);
    return result;
  };
};

export const createSeededRandom = (seed: number): { seed: number; next: SeededRandom } => ({
  seed: normalizeSeed(seed),
  next: createMulberry32(seed),
});

export const randomFromSeed = (seed: number): number => createMulberry32(seed)();
