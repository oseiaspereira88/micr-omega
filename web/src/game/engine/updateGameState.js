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
    return {
      id: entity.id,
      x: entity.position?.x ?? 0,
      y: entity.position?.y ?? 0,
      vx: entity.movementVector?.x ?? 0,
      vy: entity.movementVector?.y ?? 0,
      size: Math.max(4, Math.sqrt(Math.max(1, entity.health?.max ?? 1)) * 2),
      color: SPECIES_COLORS[entity.species] ?? DEFAULT_SPECIES_COLOR,
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
    availableTraits: [],
    availableForms: [],
    currentForm: null,
    formReapplyNotice: false,
    evolutionType: null,
    showEvolutionChoice: false,
    showMenu: false,
    gameOver: false,
    cameraZoom: camera?.zoom ?? 1,
    opponents,
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

  if (typeof helpers.playSound === 'function' && commands.attacks.length > 0) {
    helpers.playSound('attack');
  }

  return {
    commands,
    hudSnapshot,
    localPlayerId,
  };
};
