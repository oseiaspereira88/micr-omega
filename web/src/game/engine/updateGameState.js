import { aggregateDrops, calculateExperienceFromEvents, XP_DISTRIBUTION } from '@micr-omega/shared';
import { DROP_TABLES } from '../config/enemyTemplates';
import { archetypePalettes } from '../config/archetypePalettes';
import { HOSTILITY_MATRIX } from '../config/ecosystem';
import { resolveNpcCombat } from '../systems/ai';
import {
  AFFINITY_LABELS,
  AFFINITY_TYPES,
  ELEMENT_LABELS,
  ELEMENT_TYPES,
  ELEMENTAL_ADVANTAGE_MULTIPLIER,
  clampDamageMultiplier,
  createResistanceSnapshot,
  getElementalRpsMultiplier,
  resolveAffinityBonus,
  resolveResistanceMultiplier,
  resolveResistanceProfile,
} from '../../shared/combat';

const MOVEMENT_EPSILON = 0.05;
const POSITION_SMOOTHING = 7.5;
const CAMERA_SMOOTHING = 4;
const SPEED_SCALER = 60;
const BLINK_INTERVAL_MIN = 2.8;
const BLINK_INTERVAL_MAX = 5.4;
const BLINK_HOLD_DURATION = 0.08;
const LOCAL_BLINK_SPEED = { closing: 18, opening: 14 };
const REMOTE_BLINK_SPEED = { closing: 12, opening: 9 };
const LOOK_STRENGTH = { local: 0.6, remote: 0.42 };
const EXPRESSION_DECAY = {
  local: { attack: 2.6, hurt: 1.9 },
  remote: { attack: 1.7, hurt: 1.3 },
};
const EXPRESSION_CHARGE = { local: 4.8, remote: 3 };

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
const clamp01 = (value) => Math.min(1, Math.max(0, value ?? 0));
const randomBetween = (min, max) => min + Math.random() * (max - min);

const createEyeBlinkState = () => ({
  timer: randomBetween(BLINK_INTERVAL_MIN, BLINK_INTERVAL_MAX),
  hold: 0,
  openness: 1,
  state: 'open',
});

const createEyeLookState = () => ({
  x: 0,
  y: 0,
  targetX: 0,
  targetY: 0,
});

const createEyeExpressionState = () => ({
  attacking: 0,
  hurt: 0,
  attackTimer: 0,
  hurtTimer: 0,
  lastAttackAt: null,
});

const expandShorthandHex = (value) =>
  value
    .replace(/^#/, '')
    .split('')
    .map((char) => char + char)
    .join('');

const normalizeHexColor = (value) => {
  if (typeof value !== 'string') return DEFAULT_SPECIES_COLOR;
  const trimmed = value.trim();
  if (!trimmed) return DEFAULT_SPECIES_COLOR;
  if (/^#?[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  }
  if (/^#?[0-9a-fA-F]{3}$/.test(trimmed)) {
    return `#${expandShorthandHex(trimmed)}`;
  }
  return DEFAULT_SPECIES_COLOR;
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

const DEFAULT_RESOURCE_STUB = {
  current: 0,
  next: 120,
  total: 0,
  level: 1,
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

const sumModifiers = (modifiers = []) =>
  (Array.isArray(modifiers) ? modifiers : [])
    .map((value) => (Number.isFinite(value) ? value : 0))
    .reduce((total, value) => total + value, 0);

const MAX_HUD_NOTIFICATIONS = 5;

const cloneNotifications = (items = []) =>
  (Array.isArray(items) ? items : [])
    .slice(-MAX_HUD_NOTIFICATIONS)
    .map((entry) => ({ ...(typeof entry === 'object' ? entry : { text: entry }) }));

const safeNumber = (value, fallback) => (Number.isFinite(value) ? value : fallback);

const mergeNumericRecord = (defaults, ...sources) => {
  const result = { ...defaults };
  sources.forEach((source) => {
    if (!source || typeof source !== 'object') return;
    Object.entries(source).forEach(([key, value]) => {
      if (Number.isFinite(value)) {
        result[key] = value;
      }
    });
  });
  return result;
};

const mergeEvolutionSlots = (...sources) => {
  const keys = ['small', 'medium', 'large'];
  const result = Object.fromEntries(keys.map((key) => [key, { used: 0, max: 0 }]));
  sources.forEach((source) => {
    if (!source || typeof source !== 'object') return;
    keys.forEach((key) => {
      const slot = source[key];
      if (!slot || typeof slot !== 'object') return;
      if (Number.isFinite(slot.used)) {
        result[key].used = slot.used;
      }
      if (Number.isFinite(slot.max)) {
        result[key].max = slot.max;
      }
    });
  });
  return result;
};

export const calculateDamageWithResistances = ({
  baseDamage = 0,
  targetDefense = 0,
  penetration = 0,
  damageReductionCap = 0.7,
  stability = 1,
  attackerElement,
  attackElement,
  attackerAffinity = AFFINITY_TYPES.NEUTRAL,
  targetElement,
  targetResistances = {},
  situationalModifiers = [],
  combo = {},
  hooks = {},
} = {}) => {
  const inputBase = Number.isFinite(baseDamage) ? Math.max(0, baseDamage) : 0;
  const defenseValue = Number.isFinite(targetDefense) ? Math.max(0, targetDefense) : 0;
  const penetrationValue = Number.isFinite(penetration) ? Math.max(0, penetration) : 0;
  const cappedMitigation = Math.max(0, defenseValue - penetrationValue);
  const stabilityFactor = Math.max(0.4, Number.isFinite(stability) ? stability : 1);
  const reductionCap = Math.max(0.2, Math.min(0.9, Number.isFinite(damageReductionCap) ? damageReductionCap : 0.7));
  const mitigatedBase = Math.max(
    inputBase * (1 - reductionCap * stabilityFactor),
    inputBase - cappedMitigation
  );
  const normalizedBase = Math.max(0, mitigatedBase);
  const effectiveAttackElement = attackElement ?? attackerElement;
  const { multiplier: rpsMultiplier, relation } = getElementalRpsMultiplier(
    effectiveAttackElement,
    targetElement
  );

  const affinityBonus = resolveAffinityBonus({
    attackerElement,
    attackElement: effectiveAttackElement,
    affinity: attackerAffinity,
    relation,
  });
  const affinityMultiplier = clampDamageMultiplier(1 + affinityBonus);
  const resistanceMultiplier = resolveResistanceMultiplier(
    targetResistances,
    effectiveAttackElement
  );
  const situationalBonus = sumModifiers(situationalModifiers);
  const situationalMultiplier = clampDamageMultiplier(1 + situationalBonus);

  const comboSourceBonus = Number.isFinite(combo?.bonus)
    ? combo.bonus
    : Number.isFinite(combo?.multiplier)
    ? combo.multiplier - 1
    : 0;
  const comboApplied = combo?.apply !== false;
  const reportedComboMultiplier = clampDamageMultiplier(1 + comboSourceBonus);
  const comboMultiplier = comboApplied ? Math.max(1, reportedComboMultiplier) : 1;

  if (typeof hooks.onComboApplied === 'function') {
    hooks.onComboApplied({
      value: combo?.value ?? 0,
      bonus: comboSourceBonus,
      multiplier: reportedComboMultiplier,
      applied: comboApplied,
    });
  }

  const totalMultiplier =
    clampDamageMultiplier(rpsMultiplier) *
    affinityMultiplier *
    resistanceMultiplier *
    situationalMultiplier *
    comboMultiplier;

  const damage = Math.max(0, Math.round(normalizedBase * totalMultiplier));

  return {
    damage,
    baseDamage: normalizedBase,
    multiplier: totalMultiplier,
    relation,
    breakdown: {
      rps: rpsMultiplier,
      affinity: affinityMultiplier,
      resistance: resistanceMultiplier,
      situational: situationalMultiplier,
      combo: comboApplied ? comboMultiplier : 1,
    },
    comboApplied,
  };
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

const normalizePaletteDefinition = (palette) => {
  if (!palette || typeof palette !== 'object') {
    return null;
  }

  const base = normalizeHexColor(palette.base ?? palette.color ?? palette.primary ?? DEFAULT_SPECIES_COLOR);
  const accent = normalizeHexColor(palette.accent ?? adjustHexColor(base, -48));
  const label = normalizeHexColor(palette.label ?? '#ffffff');
  const secondary = normalizeHexColor(palette.secondary ?? adjustHexColor(base, 32));
  const tertiary = normalizeHexColor(palette.tertiary ?? adjustHexColor(base, -24));

  return { base, accent, label, secondary, tertiary };
};

const applyPaletteVariation = (palette, playerId) => {
  if (!palette) return null;
  const hash = hashId(playerId ?? '');
  const variant = hash % 4;
  if (variant === 0) {
    return { ...palette };
  }

  const delta = variant === 1 ? 12 : variant === 2 ? -12 : 18;
  const accentDelta = Math.round(delta * 0.7);
  const secondaryDelta = Math.round(delta * 0.5);
  const tertiaryDelta = Math.round(delta * -0.4);

  return {
    ...palette,
    base: adjustHexColor(palette.base, delta),
    accent: adjustHexColor(palette.accent, accentDelta),
    secondary: adjustHexColor(palette.secondary, secondaryDelta),
    tertiary: adjustHexColor(palette.tertiary, tertiaryDelta),
  };
};

const getPaletteForPlayer = (playerId, appearance) => {
  if (appearance?.palette) {
    return { ...appearance.palette };
  }

  const index = hashId(playerId) % PLAYER_PALETTE.length;
  const normalized = normalizePaletteDefinition(PLAYER_PALETTE[index]);
  return normalized ? { ...normalized } : { ...PLAYER_PALETTE[index] };
};

const resolvePlayerForms = (appearance, sharedPlayer, existing = {}) => {
  const formCandidates = [
    appearance?.form,
    sharedPlayer?.currentForm,
    sharedPlayer?.form,
    existing.form,
  ];
  const form = formCandidates.find((value) => typeof value === 'string' && value) ?? null;

  const hybridCandidates = [
    Array.isArray(appearance?.hybridForms) ? appearance.hybridForms : null,
    Array.isArray(sharedPlayer?.hybridForms) ? sharedPlayer.hybridForms : null,
    Array.isArray(existing.hybridForms) ? existing.hybridForms : null,
  ];

  let hybridForms = null;
  for (const candidate of hybridCandidates) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      hybridForms = candidate.filter((value) => typeof value === 'string' && value);
      break;
    }
  }

  if (form) {
    if (!hybridForms) {
      hybridForms = [form];
    } else if (!hybridForms.includes(form)) {
      hybridForms = [...hybridForms, form];
    }
  }

  if (!hybridForms) {
    hybridForms = [];
  }

  hybridForms = Array.from(new Set(hybridForms));

  return { form, hybridForms };
};

const ensureAppearanceMap = (renderState) => {
  if (!renderState.playerAppearanceById || !(renderState.playerAppearanceById instanceof Map)) {
    renderState.playerAppearanceById = new Map();
  }
  return renderState.playerAppearanceById;
};

const mergeAppearanceEntry = (player, existing = {}, fallbackHud = null) => {
  if (!player) {
    return existing;
  }

  const archetypeCandidates = [
    typeof player?.selectedArchetype === 'string' ? player.selectedArchetype : null,
    typeof player?.archetype === 'string' ? player.archetype : null,
    typeof player?.archetypeKey === 'string' ? player.archetypeKey : null,
    typeof player?.archetype?.key === 'string' ? player.archetype.key : null,
    typeof fallbackHud?.selectedArchetype === 'string' ? fallbackHud.selectedArchetype : null,
    typeof existing?.archetype === 'string' ? existing.archetype : null,
  ];
  const archetypeKey = archetypeCandidates.find((value) => typeof value === 'string' && value) ?? null;
  const archetypeDefinition = archetypeKey ? archetypePalettes[archetypeKey] ?? null : null;

  const formCandidates = [
    typeof player?.currentForm === 'string' ? player.currentForm : null,
    typeof player?.form === 'string' ? player.form : null,
    typeof fallbackHud?.currentForm === 'string' ? fallbackHud.currentForm : null,
    archetypeDefinition?.form ?? null,
    existing?.form ?? null,
  ];
  const form = formCandidates.find((value) => typeof value === 'string' && value) ?? null;

  const hybridCandidates = [
    Array.isArray(player?.hybridForms) ? player.hybridForms : null,
    Array.isArray(archetypeDefinition?.hybridForms) ? archetypeDefinition.hybridForms : null,
    Array.isArray(existing?.hybridForms) ? existing.hybridForms : null,
  ];
  let hybridForms = null;
  for (const candidate of hybridCandidates) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      hybridForms = candidate.filter((value) => typeof value === 'string' && value);
      break;
    }
  }
  if (form) {
    if (!hybridForms) {
      hybridForms = [form];
    } else if (!hybridForms.includes(form)) {
      hybridForms = [...hybridForms, form];
    }
  }
  if (!hybridForms) {
    hybridForms = [];
  }
  hybridForms = Array.from(new Set(hybridForms));

  const paletteSource = (() => {
    if (player?.palette && typeof player.palette === 'object') {
      return { palette: player.palette, source: 'player' };
    }
    if (archetypeDefinition?.palette) {
      return { palette: archetypeDefinition.palette, source: 'archetype' };
    }
    if (existing?.basePalette) {
      return { palette: existing.basePalette, source: existing.source ?? (existing.archetype ? 'archetype' : 'existing') };
    }
    if (existing?.palette) {
      return { palette: existing.palette, source: existing.source ?? 'existing' };
    }
    return { palette: null, source: existing?.source ?? null };
  })();

  const basePalette = paletteSource.palette
    ? normalizePaletteDefinition(paletteSource.palette)
    : existing?.basePalette ?? null;

  const id = typeof player?.id === 'string' ? player.id : existing?.id ?? '';
  const shouldVary =
    paletteSource.source === 'archetype' ||
    (paletteSource.source === 'existing' && existing?.source === 'archetype');

  const palette = basePalette
    ? shouldVary
      ? applyPaletteVariation(basePalette, id)
      : { ...basePalette }
    : existing?.palette ?? null;

  const resolvedId = id || existing?.id || null;
  const resolvedSource = shouldVary
    ? 'archetype'
    : paletteSource.source ?? existing?.source ?? null;

  return {
    id: resolvedId,
    archetype: archetypeKey ?? existing?.archetype ?? null,
    form: form ?? existing?.form ?? null,
    hybridForms,
    basePalette: basePalette ?? existing?.basePalette ?? null,
    palette: palette ?? existing?.palette ?? null,
    source: resolvedSource,
  };
};

const updateAppearanceMapFromShared = (renderState, sharedPlayers, localPlayerId, previousHud) => {
  const appearanceMap = ensureAppearanceMap(renderState);
  const seenIds = new Set();

  sharedPlayers.forEach((player) => {
    if (!player || typeof player.id !== 'string') return;
    const existing = appearanceMap.get(player.id) ?? { id: player.id };
    const fallbackHud = player.id === localPlayerId ? previousHud : null;
    const merged = mergeAppearanceEntry(player, existing, fallbackHud);
    appearanceMap.set(player.id, merged);
    seenIds.add(player.id);
  });

  Array.from(appearanceMap.keys()).forEach((id) => {
    if (!seenIds.has(id)) {
      appearanceMap.delete(id);
    }
  });

  return appearanceMap;
};

const updateAppearanceMapFromHud = (renderState, hudSnapshot, localPlayerId) => {
  if (!localPlayerId || !hudSnapshot) return;
  const appearanceMap = ensureAppearanceMap(renderState);
  const existing = appearanceMap.get(localPlayerId) ?? { id: localPlayerId };
  const pseudoPlayer = {
    id: localPlayerId,
    selectedArchetype: hudSnapshot.selectedArchetype,
    currentForm: hudSnapshot.currentForm,
  };
  const merged = mergeAppearanceEntry(pseudoPlayer, existing, hudSnapshot);
  appearanceMap.set(localPlayerId, merged);
};

const ensureVector = (value, fallback = { x: 0, y: 0 }) => {
  if (!value || typeof value !== 'object') return { ...fallback };
  const x = Number.isFinite(value.x) ? value.x : fallback.x;
  const y = Number.isFinite(value.y) ? value.y : fallback.y;
  return { x, y };
};

export const ensureHealth = (health) => {
  if (!health || typeof health !== 'object') {
    return { current: 0, max: 1 };
  }

  const rawCurrent = Number.isFinite(health.current) ? health.current : 0;
  const safeMax = Number.isFinite(health.max) && health.max > 0 ? Math.max(1, health.max) : Math.max(1, rawCurrent);
  const clampedCurrent = Math.min(Math.max(rawCurrent, 0), safeMax);
  return { current: clampedCurrent, max: safeMax };
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

  if (!camera.initialized) {
    camera.x = targetX;
    camera.y = targetY;
    camera.initialized = true;
    return;
  }

  camera.x = interpolate(camera.x, targetX, smoothing);
  camera.y = interpolate(camera.y, targetY, smoothing);
};

const updateEyeBlink = (previous, delta, { isLocal = false, forceBlink = false } = {}) => {
  const blink = previous && typeof previous === 'object' ? previous : createEyeBlinkState();
  const speedProfile = isLocal ? LOCAL_BLINK_SPEED : REMOTE_BLINK_SPEED;
  if (!Number.isFinite(blink.timer)) {
    blink.timer = randomBetween(BLINK_INTERVAL_MIN, BLINK_INTERVAL_MAX);
  }
  if (!Number.isFinite(blink.openness)) {
    blink.openness = 1;
  }
  if (forceBlink && blink.state !== 'closing' && blink.state !== 'closed') {
    blink.state = 'closing';
  }

  switch (blink.state) {
    case 'closing': {
      blink.openness = Math.max(0, blink.openness - delta * speedProfile.closing);
      if (blink.openness <= 0.05) {
        blink.openness = 0;
        blink.state = 'closed';
        blink.hold = BLINK_HOLD_DURATION;
      }
      break;
    }
    case 'closed': {
      blink.hold = Math.max(0, (blink.hold ?? 0) - delta);
      if (blink.hold <= 0) {
        blink.state = 'opening';
      }
      break;
    }
    case 'opening': {
      blink.openness = Math.min(1, blink.openness + delta * speedProfile.opening);
      if (blink.openness >= 0.995) {
        blink.openness = 1;
        blink.state = 'open';
        blink.timer = randomBetween(BLINK_INTERVAL_MIN, BLINK_INTERVAL_MAX);
      }
      break;
    }
    default: {
      blink.timer -= delta;
      if (blink.timer <= 0) {
        blink.state = 'closing';
      }
      break;
    }
  }

  return blink;
};

const updateEyeLook = (
  previous,
  delta,
  { isLocal = false, orientation = 0, movementVector = { x: 0, y: 0 } } = {}
) => {
  const look = previous && typeof previous === 'object' ? previous : createEyeLookState();
  const smoothing = Math.min(1, delta * (isLocal ? 12 : 6));
  const targetStrength = isLocal ? LOOK_STRENGTH.local : LOOK_STRENGTH.remote;

  const mvX = Number.isFinite(movementVector.x) ? movementVector.x : 0;
  const mvY = Number.isFinite(movementVector.y) ? movementVector.y : 0;
  const magnitude = Math.sqrt(mvX * mvX + mvY * mvY);
  const hasMovement = magnitude > MOVEMENT_EPSILON;

  let targetX = look.targetX ?? 0;
  let targetY = look.targetY ?? 0;

  if (isLocal && Number.isFinite(orientation)) {
    targetX = Math.cos(orientation) * targetStrength;
    targetY = Math.sin(orientation) * targetStrength;
  } else if (hasMovement) {
    targetX = (mvX / magnitude) * targetStrength;
    targetY = (mvY / magnitude) * targetStrength;
  } else if (Number.isFinite(orientation)) {
    targetX = Math.cos(orientation) * targetStrength;
    targetY = Math.sin(orientation) * targetStrength;
  } else {
    const relax = smoothing * (isLocal ? 0.6 : 0.12);
    targetX = interpolate(targetX, 0, relax);
    targetY = interpolate(targetY, 0, relax);
  }

  look.targetX = targetX;
  look.targetY = targetY;
  look.x = interpolate(look.x ?? 0, targetX, smoothing);
  look.y = interpolate(look.y ?? 0, targetY, smoothing);

  return look;
};

const AGGRESSIVE_COMBAT_STATES = new Set(['engaged', 'attacking', 'charging']);

const updateEyeExpression = (
  previous,
  delta,
  { isLocal = false, combatStatus = {}, tookDamage = false, lastAttackAt = null } = {}
) => {
  const expression = previous && typeof previous === 'object' ? previous : createEyeExpressionState();
  const decayProfile = isLocal ? EXPRESSION_DECAY.local : EXPRESSION_DECAY.remote;
  const chargeRate = isLocal ? EXPRESSION_CHARGE.local : EXPRESSION_CHARGE.remote;

  const attackTimestamp = Number.isFinite(lastAttackAt) ? lastAttackAt : null;
  if (attackTimestamp !== null && attackTimestamp !== expression.lastAttackAt) {
    expression.lastAttackAt = attackTimestamp;
    expression.attackTimer = Math.min(1, Math.max(expression.attackTimer, isLocal ? 0.9 : 0.7));
  }

  const isAggressive = combatStatus && AGGRESSIVE_COMBAT_STATES.has(combatStatus.state);
  if (isAggressive) {
    expression.attackTimer = Math.min(1, expression.attackTimer + delta * chargeRate);
  } else {
    expression.attackTimer = Math.max(0, expression.attackTimer - delta * decayProfile.attack);
  }

  if (tookDamage) {
    expression.hurtTimer = Math.min(1, Math.max(expression.hurtTimer, isLocal ? 1 : 0.85));
  }

  expression.hurtTimer = Math.max(0, expression.hurtTimer - delta * decayProfile.hurt);

  const smoothing = Math.min(1, delta * (isLocal ? 10 : 6));
  const targetAttack = clamp01(expression.attackTimer);
  const targetHurt = clamp01(expression.hurtTimer);

  expression.attacking = interpolate(expression.attacking ?? 0, targetAttack, smoothing);
  expression.hurt = interpolate(expression.hurt ?? 0, targetHurt, smoothing);

  return expression;
};

const createRenderPlayer = (sharedPlayer, appearance) => {
  const palette = getPaletteForPlayer(sharedPlayer.id, appearance);
  const position = ensureVector(sharedPlayer.position);
  const movementVector = ensureVector(sharedPlayer.movementVector);
  const health = ensureHealth(sharedPlayer.health);
  const forms = resolvePlayerForms(appearance, sharedPlayer);

  return {
    id: sharedPlayer.id,
    name: sharedPlayer.name,
    score: Number.isFinite(sharedPlayer.score) ? sharedPlayer.score : 0,
    combo: Number.isFinite(sharedPlayer.combo) ? sharedPlayer.combo : 1,
    palette,
    form: forms.form,
    hybridForms: forms.hybridForms,
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
    element:
      sharedPlayer.element ??
      sharedPlayer.combatAttributes?.element ??
      ELEMENT_TYPES.BIO,
    affinity:
      sharedPlayer.affinity ??
      sharedPlayer.combatAttributes?.affinity ??
      AFFINITY_TYPES.NEUTRAL,
    resistances: createResistanceSnapshot(
      sharedPlayer.combatAttributes?.resistances ?? sharedPlayer.resistances
    ),
    eyeBlink: createEyeBlinkState(),
    eyeLook: createEyeLookState(),
    eyeExpression: createEyeExpressionState(),
  };
};

const updateRenderPlayers = (renderState, sharedPlayers, delta, localPlayerId) => {
  const playersById = renderState.playersById;
  const appearanceMap = ensureAppearanceMap(renderState);
  const seenIds = new Set();

  sharedPlayers.forEach((player) => {
    const appearance = appearanceMap.get(player.id);
    const existing = playersById.get(player.id) ?? createRenderPlayer(player, appearance);
    playersById.set(player.id, existing);
    seenIds.add(player.id);

    const palette = getPaletteForPlayer(player.id, appearance);
    const position = ensureVector(player.position, existing.position);
    const movementVector = ensureVector(player.movementVector, existing.movementVector);
    const health = ensureHealth(player.health);
    const previousHealth = existing.health;

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
    const forms = resolvePlayerForms(appearance, player, existing);
    existing.form = forms.form;
    existing.hybridForms = forms.hybridForms;
    const isLocal = player.id === localPlayerId;
    existing.isLocal = isLocal;
    existing.name = player.name;
    existing.score = Number.isFinite(player.score) ? player.score : existing.score ?? 0;
    const fallbackCombo = existing.combo ?? 1;
    existing.combo = Number.isFinite(player.combo) ? player.combo : fallbackCombo;
    existing.element =
      player.element ??
      player.combatAttributes?.element ??
      existing.element ??
      ELEMENT_TYPES.BIO;
    existing.affinity =
      player.affinity ??
      player.combatAttributes?.affinity ??
      existing.affinity ??
      AFFINITY_TYPES.NEUTRAL;
    const resistanceProfile =
      player.combatAttributes?.resistances ?? player.resistances ?? null;
    if (resistanceProfile) {
      existing.resistances = createResistanceSnapshot(resistanceProfile);
    } else if (!existing.resistances) {
      existing.resistances = createResistanceSnapshot();
    }

    const tookDamage =
      previousHealth &&
      Number.isFinite(previousHealth.current) &&
      Number.isFinite(health.current) &&
      health.current < previousHealth.current - 0.01;

    existing.eyeBlink = updateEyeBlink(existing.eyeBlink, delta, {
      isLocal,
      forceBlink: tookDamage,
    });
    existing.eyeLook = updateEyeLook(existing.eyeLook, delta, {
      isLocal,
      orientation: existing.orientation,
      movementVector,
    });
    existing.eyeExpression = updateEyeExpression(existing.eyeExpression, delta, {
      isLocal,
      combatStatus: existing.combatStatus,
      tookDamage,
      lastAttackAt: existing.combatStatus.lastAttackAt,
    });

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
      scars: Array.isArray(entity.scars) ? entity.scars.map((scar) => ({ ...scar })) : [],
      decision: entity.ai?.lastDecision ?? null,
      targetId: entity.ai?.targetId ?? null,
      evolutionLevel: entity.evolutionLevel ?? 1,
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

const buildHudSnapshot = (
  localPlayer,
  playerList,
  notifications,
  camera,
  previousHud = {}
) => {
  const safePreviousHud = previousHud ?? {};
  const resourceBag = localPlayer?.resources || {};

  const xp = mergeNumericRecord(
    DEFAULT_RESOURCE_STUB,
    safePreviousHud?.xp,
    resourceBag.xp,
    localPlayer?.xp
  );
  xp.current = safeNumber(xp.current, 0);
  xp.next = safeNumber(xp.next, DEFAULT_RESOURCE_STUB.next);
  xp.total = safeNumber(xp.total, 0);
  xp.level = safeNumber(xp.level, DEFAULT_RESOURCE_STUB.level);

  const geneticMaterial = mergeNumericRecord(
    { current: 0, total: 0, bonus: 0 },
    safePreviousHud?.geneticMaterial,
    resourceBag.geneticMaterial
  );

  const characteristicPointsSource =
    resourceBag.characteristicPoints ?? safePreviousHud?.characteristicPoints ?? {};
  const characteristicPoints = {
    total: safeNumber(characteristicPointsSource.total, 0),
    available: safeNumber(characteristicPointsSource.available, 0),
    spent: safeNumber(characteristicPointsSource.spent, 0),
    perLevel: Array.isArray(resourceBag.characteristicPoints?.perLevel)
      ? [...resourceBag.characteristicPoints.perLevel]
      : Array.isArray(safePreviousHud?.characteristicPoints?.perLevel)
      ? [...safePreviousHud.characteristicPoints.perLevel]
      : [],
  };

  const evolutionSlots = mergeEvolutionSlots(
    safePreviousHud.evolutionSlots,
    resourceBag.evolutionSlots,
    localPlayer?.evolutionSlots
  );

  const reroll = mergeNumericRecord(
    { baseCost: 25, cost: 25, count: 0, pity: 0 },
    safePreviousHud.reroll,
    resourceBag.reroll
  );

  const dropPity = mergeNumericRecord(
    { fragment: 0, stableGene: 0 },
    safePreviousHud.dropPity,
    resourceBag.dropPity
  );

  const geneFragments = mergeNumericRecord(
    { minor: 0, major: 0, apex: 0 },
    safePreviousHud.geneFragments,
    resourceBag.geneFragments,
    localPlayer?.geneFragments
  );

  const stableGenes = mergeNumericRecord(
    { minor: 0, major: 0, apex: 0 },
    safePreviousHud.stableGenes,
    resourceBag.stableGenes,
    localPlayer?.stableGenes
  );

  const element =
    localPlayer?.element ?? safePreviousHud.element ?? ELEMENT_TYPES.BIO;
  const affinity =
    localPlayer?.affinity ?? safePreviousHud.affinity ?? AFFINITY_TYPES.NEUTRAL;
  const resistances = createResistanceSnapshot(
    localPlayer?.resistances ?? safePreviousHud.resistances ?? {}
  );
  const statusEffects = Array.isArray(localPlayer?.statusEffects)
    ? localPlayer.statusEffects.map((effect) =>
        typeof effect === 'object' ? { ...effect } : effect
      )
    : Array.isArray(safePreviousHud.statusEffects)
    ? safePreviousHud.statusEffects.map((effect) =>
        typeof effect === 'object' ? { ...effect } : effect
      )
    : [];

  const opponents = playerList
    .filter((player) => !player.isLocal)
    .map((player) => {
      const opponentElement = player.element ?? ELEMENT_TYPES.BIO;
      const opponentAffinity = player.affinity ?? AFFINITY_TYPES.NEUTRAL;

      return {
        id: player.id,
        name: player.name,
        health: player.health.current,
        maxHealth: player.health.max,
        palette: player.palette,
        combatState: player.combatStatus?.state ?? 'idle',
        element: opponentElement,
        affinity: opponentAffinity,
        resistances: createResistanceSnapshot(player.resistances),
        elementLabel: ELEMENT_LABELS[opponentElement] ?? opponentElement,
        affinityLabel: AFFINITY_LABELS[opponentAffinity] ?? opponentAffinity,
      };
    });

  const notificationsSnapshot = cloneNotifications(notifications);

  const energy = safeNumber(
    resourceBag.energy ?? localPlayer?.energy,
    safeNumber(safePreviousHud.energy, 0)
  );
  const dashCharge = safeNumber(
    resourceBag.dashCharge ?? localPlayer?.dashCharge,
    safeNumber(safePreviousHud.dashCharge, 100)
  );
  const score = safeNumber(
    localPlayer?.score,
    safeNumber(safePreviousHud.score, 0)
  );
  const currentCombo = Number.isFinite(localPlayer?.combo)
    ? Math.max(0, localPlayer.combo)
    : Math.max(0, safePreviousHud.combo ?? 0);
  const maxCombo = Math.max(
    Number.isFinite(safePreviousHud.maxCombo) ? safePreviousHud.maxCombo : currentCombo,
    currentCombo
  );

  const activePowerUpsSource = Array.isArray(localPlayer?.activePowerUps)
    ? localPlayer.activePowerUps
    : Array.isArray(safePreviousHud.activePowerUps)
    ? safePreviousHud.activePowerUps
    : [];
  const activePowerUps = activePowerUpsSource.map((powerUp) =>
    typeof powerUp === 'object' ? { ...powerUp } : powerUp
  );

  const skillListSource = Array.isArray(localPlayer?.skillList)
    ? localPlayer.skillList
    : Array.isArray(safePreviousHud.skillList)
    ? safePreviousHud.skillList
    : [];
  const skillList = skillListSource.map((skill) =>
    typeof skill === 'object' ? { ...skill } : skill
  );

  const hasMultipleSkills =
    typeof localPlayer?.hasMultipleSkills === 'boolean'
      ? localPlayer.hasMultipleSkills
      : Boolean(safePreviousHud.hasMultipleSkills);
  const currentSkill =
    localPlayer?.currentSkill ?? safePreviousHud.currentSkill ?? null;

  const bossActive =
    typeof localPlayer?.bossActive === 'boolean'
      ? localPlayer.bossActive
      : typeof safePreviousHud.bossActive === 'boolean'
      ? safePreviousHud.bossActive
      : false;
  const bossHealth = safeNumber(
    localPlayer?.bossHealth,
    safeNumber(safePreviousHud.bossHealth, 0)
  );
  const bossMaxHealth = safeNumber(
    localPlayer?.bossMaxHealth,
    safeNumber(safePreviousHud.bossMaxHealth, bossHealth || 0)
  );

  const evolutionMenuSource =
    localPlayer?.evolutionMenu ??
    resourceBag.evolutionMenu ??
    safePreviousHud.evolutionMenu ?? {
      activeTier: 'small',
      options: { small: [], medium: [], large: [], macro: [] },
    };
  const previousEvolutionMenu =
    safePreviousHud.evolutionMenu ?? evolutionMenuSource ?? {};
  const previousActiveTier = previousEvolutionMenu.activeTier;
  const activeTier =
    evolutionMenuSource.activeTier ??
    (previousActiveTier === 'macro' ? 'macro' : previousActiveTier) ??
    'small';
  const evolutionMenu = {
    activeTier,
    options: {
      small: Array.isArray(evolutionMenuSource.options?.small)
        ? [...evolutionMenuSource.options.small]
        : Array.isArray(previousEvolutionMenu.options?.small)
        ? [...previousEvolutionMenu.options.small]
        : [],
      medium: Array.isArray(evolutionMenuSource.options?.medium)
        ? [...evolutionMenuSource.options.medium]
        : Array.isArray(previousEvolutionMenu.options?.medium)
        ? [...previousEvolutionMenu.options.medium]
        : [],
      large: Array.isArray(evolutionMenuSource.options?.large)
        ? [...evolutionMenuSource.options.large]
        : Array.isArray(previousEvolutionMenu.options?.large)
        ? [...previousEvolutionMenu.options.large]
        : [],
      macro: Array.isArray(evolutionMenuSource.options?.macro)
        ? [...evolutionMenuSource.options.macro]
        : Array.isArray(previousEvolutionMenu.options?.macro)
        ? [...previousEvolutionMenu.options.macro]
        : [],
    },
  };

  const currentForm =
    localPlayer?.currentForm ?? safePreviousHud.currentForm ?? null;
  const evolutionType =
    localPlayer?.evolutionType ?? safePreviousHud.evolutionType ?? null;
  const showEvolutionChoice =
    typeof localPlayer?.showEvolutionChoice === 'boolean'
      ? localPlayer.showEvolutionChoice
      : typeof safePreviousHud.showEvolutionChoice === 'boolean'
      ? safePreviousHud.showEvolutionChoice
      : false;
  const showMenu =
    typeof localPlayer?.showMenu === 'boolean'
      ? localPlayer.showMenu
      : typeof safePreviousHud.showMenu === 'boolean'
      ? safePreviousHud.showMenu
      : false;
  const gameOver =
    typeof localPlayer?.gameOver === 'boolean'
      ? localPlayer.gameOver
      : typeof safePreviousHud.gameOver === 'boolean'
      ? safePreviousHud.gameOver
      : false;

  const cameraZoom = safeNumber(
    camera?.zoom,
    safeNumber(safePreviousHud.cameraZoom, 1)
  );

  const recentRewards = safePreviousHud.recentRewards
    ? { ...safePreviousHud.recentRewards }
    : { xp: 0, geneticMaterial: 0, fragments: 0, stableGenes: 0 };

  const healthCurrent = safeNumber(
    localPlayer?.health?.current,
    safeNumber(safePreviousHud.health, 0)
  );
  const healthMax = safeNumber(
    localPlayer?.health?.max,
    safeNumber(safePreviousHud.maxHealth, 1)
  );

  const level = safeNumber(
    resourceBag.level ?? localPlayer?.level ?? xp.level,
    safeNumber(safePreviousHud.level, xp.level)
  );

  const snapshot = {
    energy,
    level,
    score,
    health: healthCurrent,
    maxHealth: Math.max(1, healthMax),
    dashCharge,
    combo: currentCombo,
    maxCombo,
    activePowerUps,
    bossActive,
    bossHealth,
    bossMaxHealth,
    skillList,
    hasMultipleSkills,
    currentSkill,
    notifications: notificationsSnapshot,
    evolutionMenu,
    currentForm,
    evolutionType,
    showEvolutionChoice,
    showMenu,
    gameOver,
    cameraZoom,
    opponents,
    xp,
    geneticMaterial,
    characteristicPoints,
    geneFragments,
    stableGenes,
    evolutionSlots,
    reroll,
    dropPity,
    recentRewards,
    element,
    affinity,
    resistances,
    statusEffects,
    elementLabel: ELEMENT_LABELS[element] ?? element,
    affinityLabel: AFFINITY_LABELS[affinity] ?? affinity,
  };

  if (safePreviousHud.archetypeSelection) {
    snapshot.archetypeSelection = {
      ...safePreviousHud.archetypeSelection,
      options: safePreviousHud.archetypeSelection.options
        ? { ...safePreviousHud.archetypeSelection.options }
        : safePreviousHud.archetypeSelection.options,
    };
  }

  if (safePreviousHud.selectedArchetype) {
    snapshot.selectedArchetype = safePreviousHud.selectedArchetype;
  }

  return snapshot;
};

const collectCommands = (renderState, movementIntent, actionBuffer) => {
  const normalized = normalizeMovementIntent(movementIntent);
  const commands = { movement: null, attacks: [] };

  const lastIntent = renderState.lastMovementIntent || { ...normalized };
  const lastAngle = Number.isFinite(renderState.lastMovementAngle)
    ? renderState.lastMovementAngle
    : null;
  const movementChanged =
    Math.abs(lastIntent.x - normalized.x) > 0.01 || Math.abs(lastIntent.y - normalized.y) > 0.01;

  if (normalized.active && movementChanged) {
    const angle = Math.atan2(normalized.y, normalized.x);
    commands.movement = {
      vector: { x: normalized.x, y: normalized.y },
      speed: SPEED_SCALER,
      timestamp: Date.now(),
      orientation: { angle },
    };
    renderState.lastMovementIntent = { ...normalized };
    renderState.lastMovementAngle = angle;
  } else if (!normalized.active && movementChanged) {
    const angle = Number.isFinite(lastAngle) ? lastAngle : 0;
    commands.movement = {
      vector: { x: 0, y: 0 },
      speed: 0,
      timestamp: Date.now(),
      orientation: { angle },
    };
    renderState.lastMovementIntent = { ...normalized };
    renderState.lastMovementAngle = angle;
  }

  if (Array.isArray(actionBuffer?.attacks) && actionBuffer.attacks.length > 0) {
    commands.attacks = actionBuffer.attacks.map((attack) => {
      const normalized = {
        kind: typeof attack?.kind === 'string' && attack.kind ? attack.kind : 'basic',
        timestamp: Number.isFinite(attack?.timestamp) ? attack.timestamp : Date.now(),
      };

      if (typeof attack?.targetPlayerId === 'string' && attack.targetPlayerId) {
        normalized.targetPlayerId = attack.targetPlayerId;
      }

      if (typeof attack?.targetObjectId === 'string' && attack.targetObjectId) {
        normalized.targetObjectId = attack.targetObjectId;
      }

      if (typeof attack?.state === 'string' && attack.state) {
        normalized.state = attack.state;
      }

      if (Number.isFinite(attack?.damage)) {
        normalized.damage = attack.damage;
      }

      if (attack?.resultingHealth && typeof attack.resultingHealth === 'object') {
        normalized.resultingHealth = { ...attack.resultingHealth };
      }

      return normalized;
    });
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
  const previousHudSnapshot = renderState.hudSnapshot ?? null;

  updateAppearanceMapFromShared(renderState, sharedPlayers, localPlayerId, previousHudSnapshot);

  const localRenderPlayer = updateRenderPlayers(renderState, sharedPlayers, delta, localPlayerId);
  updateCamera(renderState, localRenderPlayer, delta);
  const aiMemory = renderState.aiMemory || { threatManagers: {} };
  const aiResult = resolveNpcCombat(sharedState.world, {
    delta,
    rng: helpers.rng ?? Math.random,
    now: helpers.now ?? Date.now(),
    dropTables: helpers.dropTables ?? DROP_TABLES,
    hostilityMatrix: helpers.hostilityMatrix ?? HOSTILITY_MATRIX,
    temperamentProfiles: helpers.temperamentProfiles,
    memory: aiMemory,
    biome: sharedState.world?.biome ?? 'default',
  });
  renderState.aiMemory = aiResult?.memory ?? { threatManagers: {} };
  const worldSnapshot = aiResult?.world ?? sharedState.world;
  updateWorldView(renderState, worldSnapshot);
  if (aiResult?.events?.length && typeof helpers.onNpcEvents === 'function') {
    helpers.onNpcEvents(aiResult.events, worldSnapshot);
  }
  if (aiResult?.drops?.length && typeof helpers.onNpcDrops === 'function') {
    helpers.onNpcDrops(aiResult.drops, worldSnapshot);
  }

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

  if (
    localRenderPlayer &&
    commands.movement?.orientation &&
    Number.isFinite(commands.movement.orientation.angle)
  ) {
    const angle = commands.movement.orientation.angle;
    localRenderPlayer.orientation = angle;
    const localEntry = renderState.playersById?.get(localRenderPlayer.id);
    if (localEntry) {
      localEntry.orientation = angle;
    }
  }

  const hudSnapshot = buildHudSnapshot(
    localRenderPlayer,
    renderState.playerList,
    renderState.notifications,
    renderState.camera,
    renderState.hudSnapshot
  );
  if (renderState.localArchetypeSelection) {
    hudSnapshot.archetypeSelection = {
      ...renderState.localArchetypeSelection,
    };
    if (renderState.localSelectedArchetype) {
      hudSnapshot.selectedArchetype = renderState.localSelectedArchetype;
    }
  }

  if (!renderState.progressionSequences) {
    renderState.progressionSequences = new Map();
  }

  const localProgressionStream =
    localPlayerId && sharedState.progression?.players
      ? sharedState.progression.players[localPlayerId] ?? null
      : null;

  if (localPlayerId && localProgressionStream) {
    const currentSequence = Number.isFinite(localProgressionStream.sequence)
      ? localProgressionStream.sequence
      : 0;
    const lastSequence = renderState.progressionSequences.get(localPlayerId) ?? 0;
    if (currentSequence > lastSequence) {
      applyProgressionEvents(hudSnapshot, localProgressionStream, {
        dropTables: helpers.dropTables ?? DROP_TABLES,
        rng: helpers.rng ?? Math.random,
        xpConfig: helpers.xpConfig ?? XP_DISTRIBUTION,
      });
      renderState.progressionSequences.set(localPlayerId, currentSequence);
    }
  }

  renderState.hudSnapshot = hudSnapshot;
  updateAppearanceMapFromHud(renderState, hudSnapshot, localPlayerId);

  if (typeof helpers.playSound === 'function' && commands.attacks.length > 0) {
    helpers.playSound('attack');
  }

  return {
    commands,
    hudSnapshot,
    localPlayerId,
  };
};

export { aggregateDrops, calculateExperienceFromEvents, XP_DISTRIBUTION };
