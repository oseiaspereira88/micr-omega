const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const createSeededRandom = (seed = 0.5) => {
  let state = Math.sin(seed * 12_345.678) * 9_812.345;
  return () => {
    state = Math.sin(state + 0.5) * 43_758.5453;
    return state - Math.floor(state);
  };
};

const jitter = (random, magnitude) => (random() - 0.5) * 2 * magnitude;

const ensureRadius = (radius, fallback) => {
  const candidate = Number.isFinite(radius) ? radius : fallback;
  return Math.max(1.5, candidate);
};

export const generateSpiralOffsets = (baseRadius, random = Math.random) => {
  const safeRadius = ensureRadius(baseRadius, 12);
  const count = 5 + Math.floor(random() * 3);
  const angleStep = Math.PI / (2.5 + random() * 0.6);
  const radialStep = safeRadius * (0.28 + random() * 0.08);
  const offsets = [
    {
      x: 0,
      y: 0,
      radius: safeRadius * 0.55,
      stretch: 0.9 + jitter(random, 0.08),
      rotation: jitter(random, 0.6)
    }
  ];

  for (let index = 0; index < count; index += 1) {
    const t = index + 1;
    const angle = t * angleStep + jitter(random, 0.35);
    const distance = radialStep * t;
    const radius = safeRadius * (0.35 + (t / (count + 1)) * 0.45);
    offsets.push({
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      radius,
      stretch: 0.82 + jitter(random, 0.15),
      rotation: angle + Math.PI / 2 + jitter(random, 0.2)
    });
  }

  return offsets;
};

export const generateWaveOffsets = (baseRadius, random = Math.random) => {
  const safeRadius = ensureRadius(baseRadius, 10);
  const count = 4 + Math.floor(random() * 3);
  const length = safeRadius * (1.8 + random() * 0.4);
  const amplitude = safeRadius * (0.35 + random() * 0.18);
  const offsets = [];

  for (let index = 0; index < count; index += 1) {
    const progress = count > 1 ? index / (count - 1) : 0.5;
    const centered = progress - 0.5;
    const x = centered * length + jitter(random, safeRadius * 0.08);
    const waveAngle = progress * Math.PI * (1.8 + random() * 0.4);
    const y = Math.sin(waveAngle) * amplitude + jitter(random, safeRadius * 0.06);
    const radius = safeRadius * (0.35 + Math.cos(progress * Math.PI) * 0.2);
    offsets.push({
      x,
      y,
      radius,
      stretch: 0.9 + jitter(random, 0.18),
      rotation: jitter(random, 0.45)
    });
  }

  return offsets;
};

export const generateCompactBlobOffsets = (baseRadius, random = Math.random) => {
  const safeRadius = ensureRadius(baseRadius, 9);
  const count = 5 + Math.floor(random() * 3);
  const spread = safeRadius * (0.55 + random() * 0.1);
  const offsets = [
    {
      x: 0,
      y: 0,
      radius: safeRadius * 0.75,
      stretch: 0.95 + jitter(random, 0.1),
      rotation: jitter(random, 0.3)
    }
  ];

  for (let index = 1; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2 + jitter(random, 0.6);
    const distance = spread * (0.45 + random() * 0.4);
    const radius = safeRadius * (0.38 + random() * 0.18);
    offsets.push({
      x: Math.cos(angle) * distance + jitter(random, safeRadius * 0.08),
      y: Math.sin(angle) * distance + jitter(random, safeRadius * 0.08),
      radius,
      stretch: 0.85 + jitter(random, 0.2),
      rotation: angle + jitter(random, 0.35)
    });
  }

  return offsets;
};

const generateSphereOffsets = (baseRadius) => [
  {
    x: 0,
    y: 0,
    radius: ensureRadius(baseRadius, 8),
    stretch: 1,
    rotation: 0
  }
];

const generateBlobOffsets = (baseRadius, random) => {
  const safeRadius = ensureRadius(baseRadius, 10);
  const count = 4 + Math.floor(random() * 3);
  const spread = safeRadius * (0.6 + random() * 0.2);
  const offsets = [
    {
      x: 0,
      y: 0,
      radius: safeRadius * 0.7,
      stretch: 1.05 + jitter(random, 0.12),
      rotation: jitter(random, 0.25)
    }
  ];

  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2 + jitter(random, 0.5);
    const distance = spread * (0.5 + random() * 0.35);
    const radius = safeRadius * (0.35 + random() * 0.2);
    offsets.push({
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      radius,
      stretch: 0.9 + jitter(random, 0.15),
      rotation: angle + jitter(random, 0.3)
    });
  }

  return offsets;
};

const generateChainOffsets = (baseRadius, random) => {
  const safeRadius = ensureRadius(baseRadius, 9);
  const count = 5 + Math.floor(random() * 3);
  const spacing = safeRadius * (0.9 + random() * 0.2);
  const offsets = [];

  for (let i = 0; i < count; i += 1) {
    const offset = i - (count - 1) / 2;
    const radius = safeRadius * (0.32 + random() * 0.18);
    offsets.push({
      x: offset * spacing + jitter(random, safeRadius * 0.08),
      y: jitter(random, safeRadius * 0.12),
      radius,
      stretch: 1.1 + jitter(random, 0.18),
      rotation: jitter(random, 0.25)
    });
  }

  return offsets;
};

const generateCrystalOffsets = (baseRadius, random) => {
  const safeRadius = ensureRadius(baseRadius, 11);
  const core = {
    x: 0,
    y: 0,
    radius: safeRadius * 0.6,
    stretch: 0.9 + jitter(random, 0.1),
    rotation: jitter(random, 0.3)
  };
  const spikeRadius = safeRadius * 0.42;
  const offsets = [core];

  for (let i = 0; i < 4; i += 1) {
    const angle = (Math.PI / 2) * i;
    offsets.push({
      x: Math.cos(angle) * safeRadius * 0.9,
      y: Math.sin(angle) * safeRadius * 0.9,
      radius: spikeRadius,
      stretch: 0.7 + jitter(random, 0.12),
      rotation: angle
    });
  }

  return offsets;
};

const generateStarOffsets = (baseRadius, random) => {
  const safeRadius = ensureRadius(baseRadius, 10);
  const points = 5 + Math.floor(random() * 3);
  const offsets = [
    {
      x: 0,
      y: 0,
      radius: safeRadius * 0.5,
      stretch: 0.85 + jitter(random, 0.1),
      rotation: jitter(random, 0.4)
    }
  ];

  for (let i = 0; i < points; i += 1) {
    const angle = (i / points) * Math.PI * 2;
    offsets.push({
      x: Math.cos(angle) * safeRadius,
      y: Math.sin(angle) * safeRadius,
      radius: safeRadius * 0.28,
      stretch: 0.7 + jitter(random, 0.15),
      rotation: angle
    });
  }

  return offsets;
};

const SHAPE_GENERATORS = {
  sphere: (radius) => generateSphereOffsets(radius),
  blob: (radius, random) => generateBlobOffsets(radius, random),
  droplet: (radius, random) => {
    const safeRadius = ensureRadius(radius, 9);
    const tailLength = 3 + Math.floor(random() * 2);
    const offsets = [
      {
        x: 0,
        y: 0,
        radius: safeRadius * 0.75,
        stretch: 1.2 + jitter(random, 0.1),
        rotation: jitter(random, 0.2)
      }
    ];

    for (let i = 1; i <= tailLength; i += 1) {
      offsets.push({
        x: 0,
        y: i * safeRadius * 0.55,
        radius: safeRadius * clamp(0.35 - i * 0.08, 0.15, 0.35),
        stretch: 0.7 + jitter(random, 0.12),
        rotation: jitter(random, 0.2)
      });
    }

    return offsets;
  },
  cluster: (radius, random) => {
    const safeRadius = ensureRadius(radius, 10);
    const count = 5 + Math.floor(random() * 4);
    const offsets = [];
    for (let i = 0; i < count; i += 1) {
      const angle = random() * Math.PI * 2;
      const distance = safeRadius * (0.3 + random() * 0.9);
      const radiusValue = safeRadius * (0.32 + random() * 0.25);
      offsets.push({
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        radius: radiusValue,
        stretch: 0.85 + jitter(random, 0.2),
        rotation: angle + jitter(random, 0.3)
      });
    }
    return offsets;
  },
  chain: generateChainOffsets,
  crystal: generateCrystalOffsets,
  star: generateStarOffsets,
  spiral: generateSpiralOffsets,
  wave: generateWaveOffsets,
  'compact-blob': generateCompactBlobOffsets,
  'compact_blob': generateCompactBlobOffsets,
  compactBlob: generateCompactBlobOffsets
};

export const generateOrganicShapeOffsets = (shape, baseRadius, seed) => {
  const generator = SHAPE_GENERATORS[shape] ?? SHAPE_GENERATORS.sphere;
  const random = typeof seed === 'function' ? seed : createSeededRandom(seed ?? 0.37);
  return generator(baseRadius, random);
};

export const createShapeRandom = (seed) => createSeededRandom(seed);

export const availableOrganicShapes = () => Object.keys(SHAPE_GENERATORS);
