export const normalizeSeed = (seed) => {
  if (!Number.isFinite(seed ?? NaN)) return undefined;
  return (Math.floor(seed) >>> 0) >>> 0;
};

export const toSeedValue = (value) => {
  if (!Number.isFinite(value ?? NaN)) return 0;
  return Math.floor(value * 0xffffffff) >>> 0;
};

export const mulberry32 = (seed = 0) => {
  let state = normalizeSeed(seed) ?? 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const createSeededRandom = ({ rng, seed, clusterSeed, clusterIndex } = {}) => {
  if (typeof rng === 'function') return rng;
  const normalizedSeed = normalizeSeed(seed);
  if (normalizedSeed !== undefined) {
    return mulberry32(normalizedSeed);
  }
  const normalizedClusterSeed = normalizeSeed(clusterSeed);
  if (normalizedClusterSeed !== undefined) {
    const index = normalizeSeed(clusterIndex) ?? 0;
    const combined = (normalizedClusterSeed + index * 0x9e3779b1) >>> 0;
    return mulberry32(combined);
  }
  return Math.random;
};
