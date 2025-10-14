import { DROP_TABLES, ELEMENTAL_ADVANTAGE_MULTIPLIER } from '../config/enemyTemplates';

const MOVEMENT_EPSILON = 0.05;
const POSITION_SMOOTHING = 7.5;
const CAMERA_SMOOTHING = 4;
const SPEED_SCALER = 60;

const PLAYER_PALETTE = [
  { base: '#47c2ff', accent: '#0b82c1', label: '#ffffff' },
  { base: '#f7a072', accent: '#d96f34', label: '#1b1b1b' },
  { base: '#9b6bff', accent: '#5a2d9f', label: '#f5f3ff' },
  { base: '#4fd1c5', accent: '#2c7a7b', label: '#ffffff' },
  { base: '#ff6fb7', accent: '#c52878', label: '#ffffff' },
];

const SPECIES_COLORS = {
  amoeba: '#88c0ff',
  paramecium: '#a3ffa3',
  rotifer: '#ffa3d0',
};

const DEFAULT_SPECIES_COLOR = '#8fb8ff';

const clampColorChannel = (value) => Math.min(255, Math.max(0, Math.round(value ?? 0)));

const normalizeHexColor = (value) => {
  if (typeof value !== 'string' || !value) return DEFAULT_SPECIES_COLOR;
  return value.startsWith('#') ? value : `#${value}`;
};

const adjustHexColor = (hex, delta) => {
  const normalized = normalizeHexColor(hex);
  const match = /^#([0-9a-fA-F]{6})$/.exec(normalized);
  if (!match) return normalized;

  const [r, g, b] = [
    parseInt(match[1].slice(0, 2), 16),
    parseInt(match[1].slice(2, 4), 16),
    parseInt(match[1].slice(4, 6), 16),
  ];

  const next = [r, g, b]
    .map((channel) => clampColorChannel(channel + delta))
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('');

  return `#${next}`;
};

const createMicroorganismPalette = (baseColor) => {
  const color = normalizeHexColor(baseColor ?? DEFAULT_SPECIES_COLOR);
  return {
    color,
    coreColor: adjustHexColor(color, 24),
    outerColor: color,
    shadowColor: adjustHexColor(color, -40),
  };
};

export const XP_DISTRIBUTION = {
  perDamage: 0.45,
  perObjective: 120,
  baseKillXp: {
    minion: 40,
    elite: 120,
    boss: 400,
  },
};

const FRAGMENT_KEY_BY_TIER = {
  minion: 'minor',
  elite: 'major',
  boss: 'apex',
};

const STABLE_KEY_BY_TIER = {
  minion: 'minor',
  elite: 'major',
  boss: 'apex',
};

const DEFAULT_RESOURCE_STUB = {
  current: 0,
  next: 120,
  total: 0,
  level: 1,
};

const createGeneCounter = () => ({ minor: 0, major: 0, apex: 0 });

export const calculateExperienceFromEvents = (events = {}, xpConfig = XP_DISTRIBUTION) => {
  if (!events) return 0;
  const damageEvents = Array.isArray(events.damage) ? events.damage : [];
  const objectiveEvents = Array.isArray(events.objectives) ? events.objectives : [];
  const killEvents = Array.isArray(events.kills) ? events.kills : [];

  const damageXp = damageEvents.reduce((total, event) => {
    const amount = Number.isFinite(event?.amount) ? event.amount : 0;
    const multiplier = Number.isFinite(event?.multiplier) ? event.multiplier : 1;
    return total + Math.max(0, amount) * (xpConfig.perDamage ?? 0) * Math.max(multiplier, 0);
  }, 0);

  const objectiveXp = objectiveEvents.reduce((total, event) => {
    if (Number.isFinite(event?.xp)) {
      return total + Math.max(0, event.xp);
    }
    return total + (xpConfig.perObjective ?? 0);
  }, 0);

  const killXp = killEvents.reduce((total, kill) => {
    const tier = kill?.dropTier ?? kill?.tier ?? 'minion';
    const base = xpConfig.baseKillXp?.[tier] ?? xpConfig.baseKillXp?.minion ?? 0;
    const multiplier = Number.isFinite(kill?.xpMultiplier) ? kill.xpMultiplier : 1;
    return total + base * Math.max(multiplier, 0);
  }, 0);

  return Math.max(0, damageXp + objectiveXp + killXp);
};

const clampChance = (value) => Math.min(1, Math.max(0, value ?? 0));

const computePityChance = (baseChance, pityCounter, config) => {
  if (!config) return clampChance(baseChance);
  const threshold = Number.isFinite(config.pityThreshold) ? config.pityThreshold : Infinity;
  const increment = Number.isFinite(config.pityIncrement) ? config.pityIncrement : 0;
  if (!Number.isFinite(pityCounter) || pityCounter < threshold) {
    return clampChance(baseChance);
  }

  const stacks = Math.max(0, pityCounter - threshold + 1);
  return clampChance((baseChance ?? 0) + stacks * increment);
};

const rollValueBetween = (min, max, roll) => {
  const lower = Number.isFinite(min) ? min : 0;
  const upper = Number.isFinite(max) ? max : lower;
  if (upper <= lower) return lower;
  const normalized = clampChance(roll);
  return lower + Math.round((upper - lower) * normalized);
};

export const aggregateDrops = (
  kills = [],
  {
    dropTables = DROP_TABLES,
    rng = Math.random,
    initialPity = { fragment: 0, stableGene: 0 },
  } = {}
) => {
  const counters = {
    geneticMaterial: 0,
    fragments: createGeneCounter(),
    stableGenes: createGeneCounter(),
    pity: {
      fragment: Number.isFinite(initialPity?.fragment) ? initialPity.fragment : 0,
      stableGene: Number.isFinite(initialPity?.stableGene) ? initialPity.stableGene : 0,
    },
  };

  kills.forEach((kill) => {
    const tier = kill?.dropTier ?? kill?.tier ?? 'minion';
    const profile = dropTables?.[tier] ?? dropTables?.minion;
    if (!profile) return;

    const advantageMultiplier = kill?.advantage ? ELEMENTAL_ADVANTAGE_MULTIPLIER : 1;
    const baseMin = Number.isFinite(profile.geneticMaterial?.min)
      ? profile.geneticMaterial.min
      : 0;
    const baseMax = Number.isFinite(profile.geneticMaterial?.max)
      ? profile.geneticMaterial.max
      : baseMin;
    const mgRoll = kill?.rolls?.mg ?? rng();
    const mgGain = Math.max(
      baseMin,
      Math.round(rollValueBetween(baseMin, baseMax, mgRoll) * Math.max(advantageMultiplier, 0))
    );
    counters.geneticMaterial += mgGain;

    const fragmentKey = FRAGMENT_KEY_BY_TIER[tier] ?? 'minor';
    const fragmentConfig = profile.fragment ?? {};
    const fragmentChance = computePityChance(
      fragmentConfig.chance,
      counters.pity.fragment,
      fragmentConfig
    );
    const fragmentRoll = kill?.rolls?.fragment ?? rng();
    if (fragmentRoll < fragmentChance) {
      const amount = rollValueBetween(
        fragmentConfig.min ?? 1,
        fragmentConfig.max ?? fragmentConfig.min ?? 1,
        kill?.rolls?.fragmentAmount ?? rng()
      );
      counters.fragments[fragmentKey] =
        (counters.fragments[fragmentKey] ?? 0) + Math.max(1, amount);
      counters.pity.fragment = 0;
    } else {
      counters.pity.fragment += 1;
    }

    const stableKey = STABLE_KEY_BY_TIER[tier] ?? 'minor';
    const stableConfig = profile.stableGene ?? {};
    const stableChance = computePityChance(
      stableConfig.chance,
      counters.pity.stableGene,
      stableConfig
    );
    const stableRoll = kill?.rolls?.stableGene ?? rng();
    if (stableRoll < stableChance) {
      const amount = Number.isFinite(stableConfig.amount) ? stableConfig.amount : 1;
      counters.stableGenes[stableKey] =
        (counters.stableGenes[stableKey] ?? 0) + Math.max(1, amount);
      counters.pity.stableGene = 0;
    } else {
      counters.pity.stableGene += 1;
    }
  });

  return counters;
};

export const applyProgressionEvents = (
  hudSnapshot,
  progression = {},
  { dropTables = DROP_TABLES, rng = Math.random, xpConfig = XP_DISTRIBUTION } = {}
) => {
  if (!hudSnapshot || !progression) return hudSnapshot;

  const xpGain = calculateExperienceFromEvents(progression, xpConfig);
  if (xpGain > 0) {
    const baseXp = hudSnapshot.xp ? { ...hudSnapshot.xp } : { ...DEFAULT_RESOURCE_STUB };
    baseXp.current = (baseXp.current ?? 0) + xpGain;
    baseXp.total = (baseXp.total ?? 0) + xpGain;
    hudSnapshot.xp = baseXp;
  }

  const dropResults = aggregateDrops(progression.kills, {
    dropTables,
    rng,
    initialPity: progression.dropPity ?? hudSnapshot.dropPity,
  });

  if (!hudSnapshot.geneticMaterial) {
    hudSnapshot.geneticMaterial = { current: 0, total: 0, bonus: 0 };
  }
  hudSnapshot.geneticMaterial = {
    ...hudSnapshot.geneticMaterial,
    current: (hudSnapshot.geneticMaterial.current ?? 0) + dropResults.geneticMaterial,
    total: (hudSnapshot.geneticMaterial.total ?? 0) + dropResults.geneticMaterial,
  };

  const mergeGenes = (target = {}, increments = {}) => ({
    minor: (target.minor ?? 0) + (increments.minor ?? 0),
    major: (target.major ?? 0) + (increments.major ?? 0),
    apex: (target.apex ?? 0) + (increments.apex ?? 0),
  });

  hudSnapshot.geneFragments = mergeGenes(hudSnapshot.geneFragments, dropResults.fragments);
  hudSnapshot.stableGenes = mergeGenes(hudSnapshot.stableGenes, dropResults.stableGenes);
  hudSnapshot.dropPity = { ...dropResults.pity };

  if (!hudSnapshot.recentRewards) {
    hudSnapshot.recentRewards = { xp: 0, geneticMaterial: 0, fragments: 0, stableGenes: 0 };
  }
  hudSnapshot.recentRewards = {
    xp: (hudSnapshot.recentRewards.xp ?? 0) + xpGain,
    geneticMaterial:
      (hudSnapshot.recentRewards.geneticMaterial ?? 0) + dropResults.geneticMaterial,
    fragments:
      (hudSnapshot.recentRewards.fragments ?? 0) +
      Object.values(dropResults.fragments || {}).reduce((sum, value) => sum + value, 0),
    stableGenes:
      (hudSnapshot.recentRewards.stableGenes ?? 0) +
      Object.values(dropResults.stableGenes || {}).reduce((sum, value) => sum + value, 0),
  };

  return hudSnapshot;
};

const hashId = (id = '') => {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(hash);
};

const getPaletteForPlayer = (playerId) => {
  const index = hashId(playerId) % PLAYER_PALETTE.length;
  return PLAYER_PALETTE[index];
};

const ensureVector = (value, fallback = { x: 0, y: 0 }) => {
  if (!value || typeof value !== 'object') return { ...fallback };
  const x = Number.isFinite(value.x) ? value.x : fallback.x;
  const y = Number.isFinite(value.y) ? value.y : fallback.y;
  return { x, y };
};

const ensureHealth = (health) => {
  if (!health || typeof health !== 'object') {
    return { current: 0, max: 1 };
  }

  const current = Number.isFinite(health.current) ? health.current : 0;
  const max = Number.isFinite(health.max) && health.max > 0 ? health.max : Math.max(1, current);
  return { current, max };
};

const normalizeMovementIntent = (intent = {}) => {
  const rawX = Number.isFinite(intent.x) ? intent.x : 0;
  const rawY = Number.isFinite(intent.y) ? intent.y : 0;
  const magnitude = Math.sqrt(rawX * rawX + rawY * rawY);

  if (magnitude < MOVEMENT_EPSILON) {
    return { x: 0, y: 0, active: false };
  }

  return {
    x: rawX / magnitude,
    y: rawY / magnitude,
    active: true,
  };
};

const interpolate = (start, end, factor) => start + (end - start) * factor;

const updateCamera = (renderState, targetPlayer, delta) => {
  const camera = renderState.camera;
  if (!camera || !targetPlayer) return;

  const smoothing = Math.min(1, delta * CAMERA_SMOOTHING);
  const targetX = targetPlayer.renderPosition.x;
  const targetY = targetPlayer.renderPosition.y;

  camera.x = interpolate(camera.x, targetX, smoothing);
  camera.y = interpolate(camera.y, targetY, smoothing);
};

const createRenderPlayer = (sharedPlayer) => {
  const palette = getPaletteForPlayer(sharedPlayer.id);
  const position = ensureVector(sharedPlayer.position);
  const movementVector = ensureVector(sharedPlayer.movementVector);
  const health = ensureHealth(sharedPlayer.health);

  return {
    id: sharedPlayer.id,
    name: sharedPlayer.name,
    score: Number.isFinite(sharedPlayer.score) ? sharedPlayer.score : 0,
    combo: Number.isFinite(sharedPlayer.combo) ? sharedPlayer.combo : 0,
    palette,
    position,
    renderPosition: { ...position },
    movementVector,
    orientation: Number.isFinite(sharedPlayer.orientation?.angle)
      ? sharedPlayer.orientation.angle
      : 0,
    tilt: Number.isFinite(sharedPlayer.orientation?.tilt)
      ? sharedPlayer.orientation.tilt
      : 0,
    speed: Math.sqrt(movementVector.x * movementVector.x + movementVector.y * movementVector.y),
    health,
    combatStatus: {
      state: sharedPlayer.combatStatus?.state ?? 'idle',
      targetPlayerId: sharedPlayer.combatStatus?.targetPlayerId ?? null,
      targetObjectId: sharedPlayer.combatStatus?.targetObjectId ?? null,
      lastAttackAt: sharedPlayer.combatStatus?.lastAttackAt ?? null,
    },
    lastAttackAt: sharedPlayer.combatStatus?.lastAttackAt ?? null,
    pulse: Math.random() * Math.PI * 2,
    isLocal: false,
  };
};

const updateRenderPlayers = (renderState, sharedPlayers, delta, localPlayerId) => {
  const playersById = renderState.playersById;
  const seenIds = new Set();

  sharedPlayers.forEach((player) => {
    const existing = playersById.get(player.id) ?? createRenderPlayer(player);
    playersById.set(player.id, existing);
    seenIds.add(player.id);

    const palette = getPaletteForPlayer(player.id);
    const position = ensureVector(player.position, existing.position);
    const movementVector = ensureVector(player.movementVector, existing.movementVector);
    const health = ensureHealth(player.health);

    const smoothing = Math.min(1, delta * POSITION_SMOOTHING);

    existing.position = position;
    existing.renderPosition = {
      x: interpolate(existing.renderPosition.x, position.x, smoothing),
      y: interpolate(existing.renderPosition.y, position.y, smoothing),
    };
    existing.movementVector = movementVector;
    existing.speed = Math.sqrt(movementVector.x * movementVector.x + movementVector.y * movementVector.y);
    existing.orientation = Number.isFinite(player.orientation?.angle)
      ? player.orientation.angle
      : existing.orientation;
    existing.tilt = Number.isFinite(player.orientation?.tilt)
      ? player.orientation.tilt
      : existing.tilt;
    existing.health = health;
    existing.combatStatus = {
      state: player.combatStatus?.state ?? 'idle',
      targetPlayerId: player.combatStatus?.targetPlayerId ?? null,
      targetObjectId: player.combatStatus?.targetObjectId ?? null,
      lastAttackAt: player.combatStatus?.lastAttackAt ?? existing.combatStatus?.lastAttackAt ?? null,
    };
    existing.lastAttackAt = existing.combatStatus.lastAttackAt;
    existing.palette = palette;
    existing.isLocal = player.id === localPlayerId;
    existing.name = player.name;
    existing.score = Number.isFinite(player.score) ? player.score : existing.score ?? 0;
    existing.combo = Number.isFinite(player.combo) ? player.combo : existing.combo ?? 0;
    existing.pulse = (existing.pulse + delta * (1 + existing.speed * 0.2)) % (Math.PI * 2);
  });

  Array.from(playersById.keys()).forEach((id) => {
    if (!seenIds.has(id)) {
      playersById.delete(id);
    }
  });

  const playerList = Array.from(playersById.values());
  playerList.sort((a, b) => a.renderPosition.y - b.renderPosition.y);

  renderState.playerList = playerList;
  renderState.combatIndicators = playerList
    .filter((player) => player.combatStatus?.state === 'engaged' && player.combatStatus.targetPlayerId)
    .map((player) => ({
      id: player.id,
      targetPlayerId: player.combatStatus.targetPlayerId,
      lastAttackAt: player.combatStatus.lastAttackAt,
      position: player.renderPosition,
      palette: player.palette,
    }));

  return playerList.find((player) => player.isLocal) ?? null;
};

const toEntityMap = (entities = []) => {
  const map = new Map();
  entities.forEach((entity) => {
    if (entity?.id) {
      map.set(entity.id, entity);
    }
  });
  return map;
};

const mapMicroorganisms = (entities = [], previous = new Map()) =>
  entities.map((entity) => {
    const prior = previous.get(entity.id);
    const baseColor = SPECIES_COLORS[entity.species] ?? entity.color ?? DEFAULT_SPECIES_COLOR;
    const { color, coreColor, outerColor, shadowColor } = createMicroorganismPalette(baseColor);
    const maxHealth = Math.max(1, entity.health?.max ?? entity.health?.current ?? 1);
    const health = Math.max(0, Math.min(maxHealth, entity.health?.current ?? maxHealth));

    return {
      id: entity.id,
      x: entity.position?.x ?? 0,
      y: entity.position?.y ?? 0,
      vx: entity.movementVector?.x ?? 0,
      vy: entity.movementVector?.y ?? 0,
      size: Math.max(4, Math.sqrt(Math.max(1, entity.health?.max ?? 1)) * 2),
      color,
      coreColor,
      outerColor,
      shadowColor,
      health,
      maxHealth,
      boss: Boolean(entity?.boss || entity?.tier === 'boss' || entity?.classification === 'boss'),
      opacity: 0.6,
      animPhase: prior ? prior.animPhase ?? 0 : Math.random() * Math.PI * 2,
      depth: 0.5,
    };
  });

const mapOrganicMatter = (entities = []) =>
  entities.map((entity) => ({
    id: entity.id,
    x: entity.position?.x ?? 0,
    y: entity.position?.y ?? 0,
    quantity: entity.quantity ?? 0,
  }));

const mapObstacles = (entities = []) =>
  entities.map((entity) => ({
    id: entity.id,
    x: entity.position?.x ?? 0,
    y: entity.position?.y ?? 0,
    width: entity.size?.x ?? 40,
    height: entity.size?.y ?? 40,
    orientation: entity.orientation?.angle ?? 0,
    impassable: Boolean(entity.impassable),
  }));

const mapRoomObjects = (entities = []) =>
  entities.map((entity) => ({
    id: entity.id,
    x: entity.position?.x ?? 0,
    y: entity.position?.y ?? 0,
    type: entity.type,
    state: entity.state || {},
  }));

const updateWorldView = (renderState, sharedWorld) => {
  const previousWorld = renderState.worldView || {};
  const previousMicro = toEntityMap(previousWorld.microorganisms || []);

  renderState.worldView = {
    microorganisms: mapMicroorganisms(sharedWorld?.microorganisms, previousMicro),
    organicMatter: mapOrganicMatter(sharedWorld?.organicMatter),
    obstacles: mapObstacles(sharedWorld?.obstacles),
    roomObjects: mapRoomObjects(sharedWorld?.roomObjects),
  };
};

const buildHudSnapshot = (localPlayer, playerList, notifications, camera) => {
  const resourceBag = localPlayer?.resources || {};
  const xp = resourceBag.xp || localPlayer?.xp || { ...DEFAULT_RESOURCE_STUB };
  const geneticMaterial = resourceBag.geneticMaterial || { current: 0, total: 0, bonus: 0 };
  const characteristicPoints = resourceBag.characteristicPoints || {
    total: 0,
    available: 0,
    spent: 0,
    perLevel: [],
  };
  const evolutionSlots = resourceBag.evolutionSlots || {
    small: { used: 0, max: 0 },
    medium: { used: 0, max: 0 },
    large: { used: 0, max: 0 },
  };
  const reroll = resourceBag.reroll || { baseCost: 25, cost: 25, count: 0, pity: 0 };
  const dropPity = resourceBag.dropPity || { fragment: 0, stableGene: 0 };
  const geneFragments = {
    minor: 0,
    major: 0,
    apex: 0,
    ...(resourceBag.geneFragments || localPlayer?.geneFragments || {}),
  };
  const stableGenes = {
    minor: 0,
    major: 0,
    apex: 0,
    ...(resourceBag.stableGenes || localPlayer?.stableGenes || {}),
  };

  const opponents = playerList
    .filter((player) => !player.isLocal)
    .map((player) => ({
      id: player.id,
      name: player.name,
      health: player.health.current,
      maxHealth: player.health.max,
      palette: player.palette,
      combatState: player.combatStatus?.state ?? 'idle',
    }));

  return {
    energy: 0,
    level: 1,
    score: localPlayer?.score ?? 0,
    health: localPlayer?.health?.current ?? 0,
    maxHealth: localPlayer?.health?.max ?? 1,
    dashCharge: 100,
    combo: localPlayer?.combo ?? 0,
    maxCombo: localPlayer?.combo ?? 0,
    activePowerUps: [],
    bossActive: false,
    bossHealth: 0,
    bossMaxHealth: 0,
    skillList: [],
    hasMultipleSkills: false,
    currentSkill: null,
    notifications,
    evolutionMenu: {
      activeTier: 'small',
      options: { small: [], medium: [], large: [] },
    },
    currentForm: null,
    evolutionType: null,
    showEvolutionChoice: false,
    showMenu: false,
    gameOver: false,
    cameraZoom: camera?.zoom ?? 1,
    opponents,
    xp: { ...xp },
    geneticMaterial: { ...geneticMaterial },
    characteristicPoints: { ...characteristicPoints },
    geneFragments,
    stableGenes,
    evolutionSlots: {
      small: { ...(evolutionSlots.small || { used: 0, max: 0 }) },
      medium: { ...(evolutionSlots.medium || { used: 0, max: 0 }) },
      large: { ...(evolutionSlots.large || { used: 0, max: 0 }) },
    },
    reroll: { ...reroll },
    dropPity: { ...dropPity },
    recentRewards: { xp: 0, geneticMaterial: 0, fragments: 0, stableGenes: 0 },
  };
};

const collectCommands = (renderState, movementIntent, actionBuffer) => {
  const normalized = normalizeMovementIntent(movementIntent);
  const commands = { movement: null, attacks: [] };

  const lastIntent = renderState.lastMovementIntent || { ...normalized };
  const movementChanged =
    Math.abs(lastIntent.x - normalized.x) > 0.01 || Math.abs(lastIntent.y - normalized.y) > 0.01;

  if (normalized.active && movementChanged) {
    commands.movement = {
      vector: { x: normalized.x, y: normalized.y },
      speed: SPEED_SCALER,
      timestamp: Date.now(),
    };
    renderState.lastMovementIntent = { ...normalized };
  } else if (!normalized.active && movementChanged) {
    commands.movement = {
      vector: { x: 0, y: 0 },
      speed: 0,
      timestamp: Date.now(),
    };
    renderState.lastMovementIntent = { ...normalized };
  }

  if (Array.isArray(actionBuffer?.attacks) && actionBuffer.attacks.length > 0) {
    commands.attacks = actionBuffer.attacks.map((attack) => ({
      kind: attack.kind ?? 'basic',
      timestamp: attack.timestamp ?? Date.now(),
    }));
    actionBuffer.attacks.length = 0;
  }

  return commands;
};

export const updateGameState = ({
  renderState,
  sharedState,
  delta = 0,
  movementIntent,
  actionBuffer,
  helpers = {},
}) => {
  if (!renderState || !sharedState) {
    return { commands: { movement: null, attacks: [] }, hudSnapshot: null, localPlayerId: null };
  }

  const sharedPlayersCollection = sharedState.remotePlayers?.all;
  const sharedPlayers = Array.isArray(sharedPlayersCollection)
    ? sharedPlayersCollection
    : Object.values(sharedState.players || {});
  const localPlayerId = sharedState.playerId ?? null;

  const localRenderPlayer = updateRenderPlayers(renderState, sharedPlayers, delta, localPlayerId);
  updateCamera(renderState, localRenderPlayer, delta);
  updateWorldView(renderState, sharedState.world);

  if (typeof helpers.createEffect === 'function' && localRenderPlayer?.combatStatus?.state === 'engaged') {
    const now = Date.now();
    if (!localRenderPlayer.lastAttackVisual || now - localRenderPlayer.lastAttackVisual > 450) {
      helpers.createEffect(
        localRenderPlayer.renderPosition.x,
        localRenderPlayer.renderPosition.y,
        'pulse',
        localRenderPlayer.palette.base
      );
      localRenderPlayer.lastAttackVisual = now;
    }
  }

  const commands = collectCommands(renderState, movementIntent, actionBuffer);

  const hudSnapshot = buildHudSnapshot(
    localRenderPlayer,
    renderState.playerList,
    renderState.notifications,
    renderState.camera
  );

  applyProgressionEvents(hudSnapshot, sharedState.progression, {
    dropTables: helpers.dropTables ?? DROP_TABLES,
    rng: helpers.rng ?? Math.random,
    xpConfig: helpers.xpConfig ?? XP_DISTRIBUTION,
  });

  if (typeof helpers.playSound === 'function' && commands.attacks.length > 0) {
    helpers.playSound('attack');
  }

  return {
    commands,
    hudSnapshot,
    localPlayerId,
  };
};
