const EFFECT_CONFIGS = {
  shockwave: { style: 'ring', growth: 260, decay: 1.6, maxSize: 220, lineWidth: 4 },
  hit: { style: 'filled', growth: 220, decay: 4.4, maxSize: 60 },
  attack: { style: 'ring', growth: 240, decay: 2.4, maxSize: 150, lineWidth: 2 },
  shield: { style: 'double-ring', growth: 160, decay: 1.4, maxSize: 160, lineWidth: 3 },
  pulse: { style: 'pulse', growth: 230, decay: 1.7, maxSize: 200 },
  drain: { style: 'spiral', growth: 200, decay: 2.2, maxSize: 160, spin: 3, lineWidth: 2 },
  dashstart: { style: 'burst', growth: 320, decay: 3.2, maxSize: 160, lineWidth: 3, rays: 12 },
  dashend: { style: 'pulse', growth: 220, decay: 2.6, maxSize: 120 },
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
