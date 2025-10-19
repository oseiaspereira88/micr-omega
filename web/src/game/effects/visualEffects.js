const EFFECT_CONFIGS = {
  shockwave: { style: 'ring', growth: 260, decay: 1.6, maxSize: 220, lineWidth: 4 },
  hit: { style: 'filled', growth: 220, decay: 4.4, maxSize: 60 },
  normal: { style: 'filled', growth: 250, decay: 3.2, maxSize: 80, lineWidth: 2 },
  attack: { style: 'ring', growth: 240, decay: 2.4, maxSize: 150, lineWidth: 2 },
  shield: { style: 'double-ring', growth: 160, decay: 1.4, maxSize: 160, lineWidth: 3 },
  pulse: { style: 'pulse', growth: 230, decay: 1.7, maxSize: 200 },
  drain: { style: 'spiral', growth: 200, decay: 2.2, maxSize: 160, spin: 3, lineWidth: 2 },
  dashstart: { style: 'burst', growth: 320, decay: 3.2, maxSize: 160, lineWidth: 3, rays: 12 },
  dashend: { style: 'pulse', growth: 220, decay: 2.6, maxSize: 120 },
  fissure: { style: 'burst', growth: 200, decay: 2, maxSize: 140, lineWidth: 3, rays: 10 },
  corrosion: { style: 'ring', growth: 180, decay: 2.4, maxSize: 130, lineWidth: 2 },
  photolesion: { style: 'pulse', growth: 210, decay: 1.8, maxSize: 150, lineWidth: 3 },
  entangled: { style: 'pulse', growth: 160, decay: 2.6, maxSize: 120, lineWidth: 2 },
  critical: { style: 'burst', growth: 320, decay: 2.1, maxSize: 180, lineWidth: 3, rays: 16 },
  advantage: { style: 'burst', growth: 280, decay: 2.4, maxSize: 150, lineWidth: 3, rays: 12 },
  resisted: { style: 'ring', growth: 210, decay: 3, maxSize: 110, lineWidth: 3 },
  phagocytosis: { style: 'spiral', growth: 260, decay: 2.6, maxSize: 200, spin: 4, lineWidth: 3 },
  knockback: { style: 'ring', growth: 240, decay: 2.2, maxSize: 160, lineWidth: 3 },
  status: { style: 'pulse', growth: 180, decay: 2, maxSize: 120, lineWidth: 2 },
  default: { style: 'ring', growth: 200, decay: 2, maxSize: 120, lineWidth: 2 }
};

export const getEffectConfig = (type) => EFFECT_CONFIGS[type] || EFFECT_CONFIGS.default;

export const createVisualEffect = (x, y, type, color) => {
  const config = getEffectConfig(type);

  return {
    x,
    y,
    type,
    color,
    style: config.style,
    life: 1,
    size: config.initialSize ?? 0,
    maxSize: config.maxSize,
    growth: config.growth,
    decay: config.decay,
    lineWidth: config.lineWidth ?? 3,
    rays: config.rays ?? 0,
    rotation: Math.random() * Math.PI * 2,
    spin: config.spin ?? 0
  };
};

export default createVisualEffect;
