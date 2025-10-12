const getRandom = (rng = Math.random) => (typeof rng === 'function' ? rng : Math.random);

const clamp01 = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
};

const formatAlpha = (value) => {
  const clamped = clamp01(value);
  if (clamped === 0 || clamped === 1) {
    return String(clamped);
  }
  return clamped.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
};

const hexToRgba = (hex, alphaOverride) => {
  if (!hex || typeof hex !== 'string') return hex;
  const trimmed = hex.trim();
  if (!trimmed.startsWith('#')) return hex;

  let value = trimmed.slice(1);
  if (![3, 4, 6, 8].includes(value.length)) return hex;

  if (value.length === 3 || value.length === 4) {
    value = value
      .split('')
      .map((char) => char + char)
      .join('');
  }

  const hasAlpha = value.length === 8;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  const alphaFromHex = hasAlpha ? parseInt(value.slice(6, 8), 16) / 255 : undefined;
  const alpha = formatAlpha(
    typeof alphaOverride === 'number' ? alphaOverride : alphaFromHex ?? 1
  );

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const ensureColorWithAlpha = (color, alpha) => {
  if (!color || typeof color !== 'string') return color;
  const trimmed = color.trim();
  if (!trimmed) return color;

  if (trimmed.startsWith('#')) {
    return hexToRgba(trimmed, alpha);
  }

  if (typeof alpha !== 'number') {
    return trimmed;
  }

  const formattedAlpha = formatAlpha(alpha);

  if (trimmed.startsWith('rgba(') || trimmed.startsWith('hsla(')) {
    return trimmed;
  }

  if (trimmed.startsWith('rgb(')) {
    const body = trimmed.slice(4, -1);
    return `rgba(${body}, ${formattedAlpha})`;
  }

  if (trimmed.startsWith('hsl(')) {
    const body = trimmed.slice(4, -1);
    return `hsla(${body}, ${formattedAlpha})`;
  }

  return trimmed;
};

export const createEnemyFromTemplate = (
  templateKey,
  template,
  {
    level = 1,
    rng = Math.random,
    origin = { x: 0, y: 0 },
    spawnDistance = 600,
    idGenerator,
    overrides = {}
  } = {}
) => {
  if (!template) return null;

  const random = getRandom(rng);
  const levelScale = 1 + level * 0.2;
  const angle = random() * Math.PI * 2;
  const distance = overrides.spawnDistance ?? spawnDistance;
  const baseHealth = Math.floor(template.baseSize * levelScale * 2);

  const resolveAlpha = (overrideKey, templateKey, fallback) => {
    const overrideAlpha = overrides?.[overrideKey];
    if (typeof overrideAlpha === 'number' && Number.isFinite(overrideAlpha)) {
      return clamp01(overrideAlpha);
    }
    const templateAlpha = template?.[templateKey];
    if (typeof templateAlpha === 'number' && Number.isFinite(templateAlpha)) {
      return clamp01(templateAlpha);
    }
    return clamp01(fallback);
  };

  const baseColorInput = overrides.baseColor ?? template.baseColor ?? template.color ?? '#FFFFFF';
  const colorInput = overrides.color ?? template.color ?? baseColorInput;
  const coreColorInput = overrides.coreColor ?? template.coreColor ?? baseColorInput;
  const glowColorInput = overrides.glowColor ?? template.glowColor ?? colorInput;
  const outerColorInput = overrides.outerColor ?? template.outerColor ?? colorInput;
  const shadowColorInput = overrides.shadowColor ?? template.shadowColor ?? coreColorInput;
  const strokeColorInput = overrides.strokeColor ?? template.strokeColor ?? glowColorInput;
  const midColorInput = overrides.midColor ?? template.midColor ?? colorInput;

  const colorAlpha = resolveAlpha('colorAlpha', 'colorAlpha', 0.65);
  const coreAlpha = resolveAlpha('coreAlpha', 'coreAlpha', 0.9);
  const glowAlpha = resolveAlpha('glowAlpha', 'glowAlpha', 0.6);
  const outerAlpha = resolveAlpha('outerAlpha', 'outerAlpha', 0.25);
  const shadowAlpha = resolveAlpha('shadowAlpha', 'shadowAlpha', 0.75);
  const strokeAlpha = resolveAlpha('strokeAlpha', 'strokeAlpha', 0.6);

  const color = ensureColorWithAlpha(colorInput, colorAlpha);
  const coreColor = ensureColorWithAlpha(coreColorInput, coreAlpha);
  const glowColor = ensureColorWithAlpha(glowColorInput, glowAlpha);
  const outerColor = ensureColorWithAlpha(outerColorInput, outerAlpha);
  const shadowColor = ensureColorWithAlpha(shadowColorInput, shadowAlpha);
  const strokeColor = ensureColorWithAlpha(strokeColorInput, strokeAlpha);
  const midColor = ensureColorWithAlpha(midColorInput, colorAlpha);

  const defaultEnemy = {
    id: overrides.id ?? (idGenerator ? idGenerator() : Date.now() + random()),
    x: overrides.x ?? origin.x + Math.cos(angle) * distance,
    y: overrides.y ?? origin.y + Math.sin(angle) * distance,
    vx: overrides.vx ?? 0,
    vy: overrides.vy ?? 0,
    type: templateKey,
    size: overrides.size ?? template.baseSize * Math.sqrt(levelScale),
    speed: overrides.speed ?? template.baseSpeed,
    attack: overrides.attack ?? Math.floor(template.baseAttack * levelScale),
    defense: overrides.defense ?? Math.floor(template.baseDefense * levelScale),
    health: overrides.health ?? baseHealth,
    maxHealth: overrides.maxHealth ?? baseHealth,
    points: overrides.points ?? template.points,
    baseColor: baseColorInput,
    color,
    coreColor,
    glowColor,
    outerColor,
    shadowColor,
    strokeColor,
    midColor,
    behavior: overrides.behavior ?? template.behavior,
    evolutionLevel: overrides.evolutionLevel ?? Math.floor(levelScale),
    attackCooldown: overrides.attackCooldown ?? 0,
    state: overrides.state ?? 'wandering',
    animPhase: overrides.animPhase ?? 0,
    canLeave: overrides.canLeave ?? true,
    ticksOutOfRange: overrides.ticksOutOfRange ?? 0,
    boss: false,
    opacity: overrides.opacity ?? template.opacity ?? 1,
    rotation: overrides.rotation ?? 0,
    pulseSpeed:
      overrides.pulseSpeed ?? template.pulseSpeed ?? 0.8 + random() * 0.6,
    behaviorTimer: overrides.behaviorTimer ?? 0,
    behaviorInterval:
      overrides.behaviorInterval ?? template.behaviorInterval ?? random() * 2 + 0.5,
    attackTimer: overrides.attackTimer ?? 0,
    phaseTimer: overrides.phaseTimer ?? 0
  };

  const enemy = {
    ...defaultEnemy,
    ...overrides,
    boss: false,
  };

  enemy.baseColor = baseColorInput;
  enemy.color = color;
  enemy.coreColor = coreColor;
  enemy.midColor = midColor;
  enemy.glowColor = glowColor;
  enemy.outerColor = outerColor;
  enemy.shadowColor = shadowColor;
  enemy.strokeColor = strokeColor;
  enemy.opacity = overrides.opacity ?? enemy.opacity ?? 1;

  return enemy;
};

export const createBossEnemy = (
  config = {},
  {
    origin = { x: 0, y: 0 },
    spawnDistance = 900,
    rng = Math.random,
    idGenerator,
    overrides = {}
  } = {}
) => {
  const random = getRandom(rng);
  const angle = random() * Math.PI * 2;
  const distance = overrides.spawnDistance ?? spawnDistance;
  const id = overrides.id ?? (idGenerator ? idGenerator() : Date.now() + random());

  const defaults = {
    id,
    x: overrides.x ?? origin.x + Math.cos(angle) * distance,
    y: overrides.y ?? origin.y + Math.sin(angle) * distance,
    vx: overrides.vx ?? 0,
    vy: overrides.vy ?? 0,
    type: config.type ?? 'boss',
    size: config.size ?? 160,
    speed: config.speed ?? 1,
    attack: config.attack ?? 20,
    defense: config.defense ?? 10,
    health: config.health ?? 500,
    maxHealth: config.maxHealth ?? config.health ?? 500,
    points: config.points ?? 500,
    color: config.color ?? '#FFFFFF',
    behavior: config.behavior ?? 'boss',
    evolutionLevel: config.evolutionLevel ?? 1,
    attackCooldown: overrides.attackCooldown ?? 0,
    state: overrides.state ?? config.state ?? 'aggressive',
    animPhase: overrides.animPhase ?? 0,
    canLeave: overrides.canLeave ?? config.canLeave ?? false,
    ticksOutOfRange: overrides.ticksOutOfRange ?? 0,
    boss: true
  };

  return {
    ...defaults,
    ...config,
    ...overrides,
    id,
    x: overrides.x ?? defaults.x,
    y: overrides.y ?? defaults.y,
    vx: overrides.vx ?? defaults.vx,
    vy: overrides.vy ?? defaults.vy,
    boss: true,
    canLeave: overrides.canLeave ?? config.canLeave ?? false,
    maxHealth: overrides.maxHealth ?? config.maxHealth ?? defaults.maxHealth
  };
};
