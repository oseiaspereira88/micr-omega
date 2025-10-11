const getRandom = (rng = Math.random) => (typeof rng === 'function' ? rng : Math.random);

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
    color: overrides.color ?? template.color,
    behavior: overrides.behavior ?? template.behavior,
    evolutionLevel: overrides.evolutionLevel ?? Math.floor(levelScale),
    attackCooldown: overrides.attackCooldown ?? 0,
    state: overrides.state ?? 'wandering',
    animPhase: overrides.animPhase ?? 0,
    canLeave: overrides.canLeave ?? true,
    ticksOutOfRange: overrides.ticksOutOfRange ?? 0,
    boss: false
  };

  return {
    ...defaultEnemy,
    ...overrides,
    boss: false
  };
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
