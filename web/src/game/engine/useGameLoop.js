import { WORLD_RADIUS, WORLD_SIZE } from '@micr-omega/shared';

import { useCallback, useEffect, useMemo, useRef } from 'react';

import { createSoundEffects } from '../audio/soundEffects';
import { createSkills } from '../config';
import { createParticle as generateParticle } from '../effects/particles';
import { createVisualEffect as generateVisualEffect } from '../effects/visualEffects';
import { updateStatusAuras } from '../effects/statusAuras';
import { addNotification as appendNotification } from '../ui/notifications';
import { renderFrame } from '../render/renderFrame';
import { updateGameState } from './updateGameState';
import useInputController from '../input/useInputController';
import { DEFAULT_JOYSTICK_STATE } from '../input/utils';
import { gameStore } from '../../store/gameStore';
import { createInitialState } from '../state/initialState';
import { pushDamagePopup } from '../state/damagePopups';
import {
  checkEvolution as checkEvolutionSystem,
  chooseEvolution as chooseEvolutionSystem,
  restartGame as restartGameSystem,
  cycleSkill as cycleSkillSystem,
  openEvolutionMenu as openEvolutionMenuSystem,
  requestEvolutionReroll as requestEvolutionRerollSystem,
  cancelEvolutionChoice as cancelEvolutionChoiceSystem,
  selectArchetype as selectArchetypeSystem,
} from '../systems';
import { spawnObstacle as createObstacleSpawn } from '../factories/obstacleFactory';
import { spawnNebula as createNebulaSpawn } from '../factories/nebulaFactory';
import { spawnPowerUp as createPowerUpSpawn } from '../factories/powerUpFactory';
import { spawnOrganicMatter as createOrganicMatterBatch } from '../factories/organicMatterFactory';
import {
  findNearestAttackableMicroorganismId,
  resolvePlayerPosition,
} from '../../utils/targeting';
import { featureToggles } from '../../config/featureToggles.js';

const DEFAULT_SETTINGS = {
  audioEnabled: true,
  visualDensity: 'medium',
  showTouchControls: false,
  showMinimap: featureToggles.minimap,
};

const EVOLUTION_STAT_KEYS = ['attack', 'defense', 'speed', 'range'];
const EVOLUTION_HISTORY_TIERS = ['small', 'medium', 'large', 'macro'];

const createEmptyEvolutionMenuOptions = () =>
  EVOLUTION_HISTORY_TIERS.reduce((acc, tier) => {
    acc[tier] = [];
    return acc;
  }, {});

const snapshotEvolutionState = (organism) => {
  const persistentPassives = organism?.persistentPassives || {};
  const bases = {};
  EVOLUTION_STAT_KEYS.forEach((stat) => {
    const key = `base${stat.charAt(0).toUpperCase()}${stat.slice(1)}`;
    const value = organism && Number.isFinite(organism[key]) ? Number(organism[key]) : null;
    bases[stat] = value;
  });

  const history = EVOLUTION_HISTORY_TIERS.reduce((acc, tier) => {
    acc[tier] = { ...(organism?.evolutionHistory?.[tier] || {}) };
    return acc;
  }, {});

  const traits = new Set(
    Array.isArray(organism?.traits)
      ? organism.traits
          .map((trait) => (typeof trait === 'string' ? trait.trim() : ''))
          .filter((trait) => trait.length > 0)
      : [],
  );

  return {
    passives: { ...persistentPassives },
    bases,
    history,
    traits,
  };
};

const diffEvolutionSnapshots = (before, after, evolutionId, hintedTier) => {
  if (!evolutionId) {
    return null;
  }

  const traitDeltas = [];
  after.traits.forEach((trait) => {
    if (!before.traits.has(trait)) {
      traitDeltas.push(trait);
    }
  });

  let resolvedTier = typeof hintedTier === 'string' && hintedTier ? hintedTier : null;
  let countDelta = 0;
  for (const tier of EVOLUTION_HISTORY_TIERS) {
    const prev = Number.isFinite(before.history?.[tier]?.[evolutionId])
      ? Number(before.history[tier][evolutionId])
      : 0;
    const next = Number.isFinite(after.history?.[tier]?.[evolutionId])
      ? Number(after.history[tier][evolutionId])
      : 0;
    const delta = next - prev;
    if (delta !== 0) {
      countDelta = delta;
      resolvedTier = tier;
      break;
    }
  }

  const additiveDelta = {};
  const multiplierDelta = {};
  const baseDelta = {};

  EVOLUTION_STAT_KEYS.forEach((stat) => {
    const bonusKey = `${stat}Bonus`;
    const prevBonus = Number.isFinite(before.passives?.[bonusKey]) ? Number(before.passives[bonusKey]) : 0;
    const nextBonus = Number.isFinite(after.passives?.[bonusKey]) ? Number(after.passives[bonusKey]) : 0;
    if (nextBonus !== prevBonus) {
      additiveDelta[stat] = nextBonus - prevBonus;
    }

    const multiplierKey = `${stat}Multiplier`;
    const prevMultiplier = Number.isFinite(before.passives?.[multiplierKey])
      ? Number(before.passives[multiplierKey])
      : 0;
    const nextMultiplier = Number.isFinite(after.passives?.[multiplierKey])
      ? Number(after.passives[multiplierKey])
      : 0;
    if (nextMultiplier !== prevMultiplier) {
      multiplierDelta[stat] = nextMultiplier - prevMultiplier;
    }

    const prevBase = Number.isFinite(before.bases?.[stat]) ? Number(before.bases[stat]) : null;
    const nextBase = Number.isFinite(after.bases?.[stat]) ? Number(after.bases[stat]) : null;
    if (prevBase !== null && nextBase !== null && nextBase !== prevBase) {
      baseDelta[stat] = nextBase - prevBase;
    }
  });

  const hasAdditive = Object.keys(additiveDelta).length > 0;
  const hasMultiplier = Object.keys(multiplierDelta).length > 0;
  const hasBase = Object.keys(baseDelta).length > 0;
  const hasTraits = traitDeltas.length > 0;
  const hasCount = countDelta !== 0;

  if (!hasAdditive && !hasMultiplier && !hasBase && !hasTraits && !hasCount) {
    return null;
  }

  const payload = { evolutionId };
  if (resolvedTier) {
    payload.tier = resolvedTier;
  }
  if (hasCount) {
    payload.countDelta = countDelta;
  }
  if (hasTraits) {
    payload.traitDeltas = traitDeltas;
  }
  if (hasAdditive) {
    payload.additiveDelta = additiveDelta;
  }
  if (hasMultiplier) {
    payload.multiplierDelta = multiplierDelta;
  }
  if (hasBase) {
    payload.baseDelta = baseDelta;
  }

  return payload;
};

const DENSITY_SCALE = {
  low: 0.6,
  medium: 1,
  high: 1.4,
};

const DAMAGE_PARTICLE_COOLDOWN_MS = 500;

const filterExpiredDamagePopups = (collection, now) => {
  if (!Array.isArray(collection) || collection.length === 0) {
    return [];
  }

  return collection.filter((popup) => {
    if (!popup || typeof popup !== 'object') {
      return false;
    }

    const createdAt = Number.isFinite(popup.createdAt) ? popup.createdAt : now;
    const expiresAt = Number.isFinite(popup.expiresAt)
      ? Math.max(popup.expiresAt, createdAt)
      : createdAt + Math.max(
          0.25,
          Number.isFinite(popup.lifetime) ? popup.lifetime : DEFAULT_POPUP_LIFETIME,
        ) * 1000;

    return expiresAt > now;
  });
};

const resolveDamageParticleKey = (entry) => {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const explicitId =
    typeof entry.id === 'string' || typeof entry.id === 'number'
      ? `id:${entry.id}`
      : typeof entry.entryId === 'string' || typeof entry.entryId === 'number'
        ? `entry:${entry.entryId}`
        : typeof entry.combatLogEntryId === 'string' || typeof entry.combatLogEntryId === 'number'
          ? `entry:${entry.combatLogEntryId}`
          : null;

  if (explicitId) {
    return explicitId;
  }

  const attacker = entry.attackerId ?? 'unknown-attacker';
  const targetRaw =
    entry.targetId ?? entry.targetObjectId ?? (entry.targetKind ? `${entry.targetKind}` : 'unknown-target');

  return `${attacker}->${targetRaw}`;
};

const pruneDamageParticleCache = (cache, cutoffTimestamp) => {
  if (!(cache instanceof Map) || !Number.isFinite(cutoffTimestamp)) {
    return;
  }

  for (const [key, value] of cache.entries()) {
    if (!Number.isFinite(value) || value <= cutoffTimestamp) {
      cache.delete(key);
    }
  }
};

const collectSharedDamagePopups = (sharedState, now) => {
  const hasRootCollection = Array.isArray(sharedState?.damagePopups);
  const hasWorldCollection = Array.isArray(sharedState?.world?.damagePopups);

  const filteredRoot = hasRootCollection
    ? filterExpiredDamagePopups(sharedState.damagePopups, now)
    : [];
  if (hasRootCollection) {
    sharedState.damagePopups = filteredRoot;
  }

  const filteredWorld = hasWorldCollection
    ? filterExpiredDamagePopups(sharedState.world.damagePopups, now)
    : [];
  if (hasWorldCollection) {
    sharedState.world.damagePopups = filteredWorld;
  }

  if (filteredRoot.length === 0) {
    return filteredWorld;
  }

  if (filteredWorld.length === 0) {
    return filteredRoot;
  }

  return [...filteredRoot, ...filteredWorld];
};

const DEFAULT_POPUP_LIFETIME = 1;
const POPUP_RISE_DISTANCE = 28;

const HIT_OUTCOMES = new Set(['hit', 'defeated']);

const isHitOutcome = (outcome) => HIT_OUTCOMES.has(outcome);

const ensureRenderPopupStructures = (renderState) => {
  if (!renderState) {
    return { list: [], index: new Map() };
  }

  if (!Array.isArray(renderState.damagePopups)) {
    renderState.damagePopups = [];
  }

  if (!(renderState.damagePopupIndex instanceof Map)) {
    renderState.damagePopupIndex = new Map();
  }

  return { list: renderState.damagePopups, index: renderState.damagePopupIndex };
};

const syncDamagePopups = (renderState, sharedState, deltaSeconds) => {
  if (!renderState) return;

  const { list, index } = ensureRenderPopupStructures(renderState);
  const now = Date.now();
  const incoming = collectSharedDamagePopups(sharedState, now);

  incoming.forEach((rawPopup) => {
    if (!rawPopup || typeof rawPopup !== 'object') {
      return;
    }

    const explicitId = typeof rawPopup.id === 'string' && rawPopup.id ? rawPopup.id : null;
    const createdAt = Number.isFinite(rawPopup.createdAt) ? rawPopup.createdAt : now;
    const positionSource = rawPopup.position || {};
    const popupX = Number.isFinite(positionSource.x)
      ? positionSource.x
      : Number.isFinite(rawPopup.x)
        ? rawPopup.x
        : 0;
    const popupY = Number.isFinite(positionSource.y)
      ? positionSource.y
      : Number.isFinite(rawPopup.y)
        ? rawPopup.y
        : 0;
    const value = Number.isFinite(rawPopup.value) ? rawPopup.value : 0;
    const fallbackParts = [Number(createdAt) || 0, Math.round(popupX), Math.round(popupY), Math.round(value)];
    const fallbackId = fallbackParts.join('-');
    const id = explicitId || fallbackId;

    if (!index.has(id)) {
      const expiresAt = Number.isFinite(rawPopup.expiresAt)
        ? Math.max(rawPopup.expiresAt, createdAt)
        : createdAt + Math.max(
            0.25,
            Number.isFinite(rawPopup.lifetime) ? rawPopup.lifetime : DEFAULT_POPUP_LIFETIME,
          ) * 1000;
      const lifetime = expiresAt > createdAt ? (expiresAt - createdAt) / 1000 : DEFAULT_POPUP_LIFETIME;
      const entry = {
        id,
        x: Number.isFinite(popupX) ? popupX : 0,
        y: Number.isFinite(popupY) ? popupY : 0,
        value: Number.isFinite(value) ? Math.round(value) : 0,
        variant:
          typeof rawPopup.variant === 'string' && rawPopup.variant.length > 0
            ? rawPopup.variant
            : 'normal',
        lifetime,
        elapsed: 0,
        offset: 0,
        opacity: 1,
      };
      index.set(id, entry);
      list.push(entry);
    }
  });

  for (let i = list.length - 1; i >= 0; i -= 1) {
    const popup = list[i];
    const lifetime = Math.max(0.25, Number.isFinite(popup.lifetime) ? popup.lifetime : DEFAULT_POPUP_LIFETIME);
    popup.elapsed = (popup.elapsed ?? 0) + deltaSeconds;
    const progress = lifetime > 0 ? Math.min(1, popup.elapsed / lifetime) : 1;
    popup.offset = progress * POPUP_RISE_DISTANCE;
    popup.opacity = Math.max(0, 1 - progress);

    if (popup.elapsed >= lifetime) {
      list.splice(i, 1);
      index.delete(popup.id);
    }
  }
};

const resolvePlayerFromRenderState = (renderState, playerId) => {
  if (!playerId) return null;
  if (renderState?.playersById instanceof Map && renderState.playersById.has(playerId)) {
    return renderState.playersById.get(playerId);
  }
  if (Array.isArray(renderState?.playerList)) {
    return renderState.playerList.find((player) => player?.id === playerId) ?? null;
  }
  return null;
};

const resolveEntityPosition = (entity) => {
  if (!entity || typeof entity !== 'object') {
    return null;
  }

  const candidate = entity.renderPosition || entity.position || entity;
  const x = Number.isFinite(candidate?.x) ? candidate.x : null;
  const y = Number.isFinite(candidate?.y) ? candidate.y : null;
  if (x === null || y === null) {
    return null;
  }

  return { x, y };
};

const resolveEntityColor = (entity) => {
  if (!entity || typeof entity !== 'object') {
    return null;
  }

  if (entity.palette && typeof entity.palette.base === 'string') {
    return entity.palette.base;
  }

  if (typeof entity.color === 'string') {
    return entity.color;
  }

  if (typeof entity.fillColor === 'string') {
    return entity.fillColor;
  }

  return null;
};

const findWorldEntityById = (collection, id) => {
  if (!id || !Array.isArray(collection)) {
    return null;
  }

  return collection.find((entry) => entry?.id === id) ?? null;
};

const resolveCombatLogTargetPosition = (renderState, entry, localContext) => {
  if (!renderState || !entry) {
    return null;
  }

  const targetKind = entry.targetKind;
  const worldView = renderState.worldView || {};

  if (targetKind === 'player') {
    const targetId = entry.targetId || entry.targetObjectId;
    const targetPlayer = resolvePlayerFromRenderState(renderState, targetId);
    if (targetPlayer) {
      const position = resolveEntityPosition(targetPlayer);
      if (position) {
        return { ...position, color: resolveEntityColor(targetPlayer) };
      }
    }

    if (targetId && localContext?.localPlayer && targetId === localContext.localPlayer.id) {
      const fallbackPosition = resolveEntityPosition(localContext.localPlayer);
      if (fallbackPosition) {
        return { ...fallbackPosition, color: resolveEntityColor(localContext.localPlayer) };
      }
    }

    return null;
  }

  if (targetKind === 'microorganism') {
    const targetId = entry.targetObjectId || entry.targetId;
    const entity = findWorldEntityById(worldView.microorganisms, targetId);
    if (entity) {
      const position = resolveEntityPosition(entity);
      if (position) {
        return { ...position, color: resolveEntityColor(entity) };
      }
    }
    return null;
  }

  if (targetKind === 'organic_matter') {
    const targetId = entry.targetObjectId || entry.targetId;
    const entity = findWorldEntityById(worldView.organicMatter, targetId);
    if (entity) {
      const position = resolveEntityPosition(entity);
      if (position) {
        return { ...position, color: resolveEntityColor(entity) };
      }
    }
    return null;
  }

  if (targetKind === 'obstacle') {
    const targetId = entry.targetObjectId || entry.targetId;
    const entity = findWorldEntityById(worldView.obstacles, targetId);
    if (entity) {
      const position = resolveEntityPosition(entity);
      if (position) {
        return { ...position, color: resolveEntityColor(entity) };
      }
    }
    return null;
  }

  return null;
};

const resolvePopupVariant = (entry, { isLocalAttacker, isLocalTarget }) => {
  if (!entry) {
    return 'normal';
  }

  if (isLocalAttacker) {
    return entry.outcome === 'defeated' ? 'critical' : 'advantage';
  }

  if (entry.outcome === 'defeated' && isLocalTarget) {
    return 'critical';
  }

  return 'normal';
};

const processLocalCombatLogFeedback = (renderState, sharedState, localPlayerId, helpers = {}) => {
  if (!renderState || !sharedState || !localPlayerId) {
    return;
  }

  const combatLog = Array.isArray(sharedState.combatLog) ? sharedState.combatLog : [];
  if (!combatLog.length) {
    renderState.lastCombatLogEntry = null;
    renderState.lastCombatLogLength = 0;
    return;
  }

  const previousLength = Number.isFinite(renderState.lastCombatLogLength)
    ? renderState.lastCombatLogLength
    : 0;
  let cursor = renderState.lastCombatLogEntry ?? null;

  if (combatLog.length < previousLength) {
    cursor = null;
  } else if (cursor) {
    const latestTimestamp = Number.isFinite(combatLog[combatLog.length - 1]?.timestamp)
      ? combatLog[combatLog.length - 1].timestamp
      : null;
    if (latestTimestamp !== null && latestTimestamp < cursor.timestamp) {
      cursor = null;
    }
  }

  const localPlayer = resolvePlayerFromRenderState(renderState, localPlayerId);
  const localPosition = resolveEntityPosition(localPlayer);
  const localColor = resolveEntityColor(localPlayer) || '#ff5f73';

  let particleCooldowns =
    renderState.lastDamageParticleByTarget instanceof Map
      ? renderState.lastDamageParticleByTarget
      : null;

  if (!particleCooldowns) {
    particleCooldowns = new Map();
    renderState.lastDamageParticleByTarget = particleCooldowns;
  }

  let lastProcessedEntry = cursor;
  let groupTimestamp = null;
  let groupSequence = -1;

  for (let i = 0; i < combatLog.length; i += 1) {
    const entry = combatLog[i];
    if (!entry || typeof entry !== 'object') {
      continue;
    }

    const timestamp = Number.isFinite(entry.timestamp) ? entry.timestamp : null;
    if (timestamp === null) {
      continue;
    }

    if (Number.isFinite(timestamp)) {
      pruneDamageParticleCache(particleCooldowns, timestamp - DAMAGE_PARTICLE_COOLDOWN_MS);
    }

    if (groupTimestamp === timestamp) {
      groupSequence += 1;
    } else {
      groupTimestamp = timestamp;
      groupSequence = 0;
    }

    if (cursor) {
      if (timestamp < cursor.timestamp) {
        continue;
      }
      if (timestamp === cursor.timestamp && groupSequence <= cursor.sequence) {
        continue;
      }
    }

    const isLocalAttacker = entry.attackerId === localPlayerId;
    const isLocalTarget = entry.targetId === localPlayerId;
    if (!isLocalAttacker && !isLocalTarget) {
      lastProcessedEntry = { timestamp, sequence: groupSequence };
      continue;
    }

    if (!isHitOutcome(entry.outcome)) {
      lastProcessedEntry = { timestamp, sequence: groupSequence };
      continue;
    }

    const rawDamage = Number.isFinite(entry.damage) ? Math.round(entry.damage) : 0;
    if (rawDamage <= 0) {
      lastProcessedEntry = { timestamp, sequence: groupSequence };
      continue;
    }

    const targetPosition = resolveCombatLogTargetPosition(renderState, entry, { localPlayer });
    const popupPosition = targetPosition || localPosition;
    if (!popupPosition) {
      lastProcessedEntry = { timestamp, sequence: groupSequence };
      continue;
    }

    ensureRenderPopupStructures(renderState);
    const popup = pushDamagePopup(renderState, {
      x: popupPosition.x,
      y: popupPosition.y,
      value: rawDamage,
      variant: resolvePopupVariant(entry, { isLocalAttacker, isLocalTarget }),
    });

    if (popup) {
      if (Array.isArray(renderState.damagePopups) && !renderState.damagePopups.includes(popup)) {
        renderState.damagePopups.push(popup);
      }
      if (renderState.damagePopupIndex instanceof Map) {
        renderState.damagePopupIndex.set(popup.id, popup);
      }
    }

    const particleColor =
      targetPosition?.color || (isLocalTarget ? localColor : null) || localColor;

    let shouldCreateParticle = true;
    let particleCooldownKey = null;

    if (Number.isFinite(timestamp)) {
      particleCooldownKey = resolveDamageParticleKey(entry);
      if (particleCooldownKey) {
        const lastSpawn = particleCooldowns.get(particleCooldownKey);
        if (Number.isFinite(lastSpawn) && timestamp - lastSpawn < DAMAGE_PARTICLE_COOLDOWN_MS) {
          shouldCreateParticle = false;
        }
      }
    }

    if (shouldCreateParticle && particleColor && typeof helpers.createParticle === 'function') {
      helpers.createParticle(
        popupPosition.x,
        popupPosition.y,
        particleColor,
        isLocalAttacker ? 4 : 3,
      );

      if (particleCooldownKey) {
        particleCooldowns.set(particleCooldownKey, timestamp);
      }
    }

    lastProcessedEntry = { timestamp, sequence: groupSequence };
  }

  if (lastProcessedEntry) {
    renderState.lastCombatLogEntry = lastProcessedEntry;
  }
  renderState.lastCombatLogLength = combatLog.length;
};

const createInitialRenderState = () => ({
  camera: {
    x: 0,
    y: 0,
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    viewport: {
      width: 0,
      height: 0,
    },
    initialized: false,
  },
  pulsePhase: 0,
  effects: [],
  particles: [],
  notifications: [],
  background: {
    backgroundLayers: [],
    lightRays: [],
    microorganisms: [],
    glowParticles: [],
    floatingParticles: [],
  },
  worldView: {
    microorganisms: [],
    organicMatter: [],
    obstacles: [],
    roomObjects: [],
  },
  playersById: new Map(),
  playerAppearanceById: new Map(),
  playerList: [],
  selectedArchetype: null,
  localArchetypeSelection: null,
  localSelectedArchetype: null,
  combatIndicators: [],
  damagePopups: [],
  damagePopupIndex: new Map(),
  lastDamageParticleByTarget: new Map(),
  lastCombatLogEntry: null,
  lastCombatLogLength: 0,
  pendingInputs: {
    movement: null,
    attacks: [],
  },
  hudSnapshot: null,
  lastMovementIntent: { ...DEFAULT_JOYSTICK_STATE },
  lastMovementAngle: 0,
  progressionSequences: new Map(),
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const MAX_FRAME_DELTA_SECONDS = 0.1;
const MAX_FRAME_DELTA_MS = MAX_FRAME_DELTA_SECONDS * 1000;

const resolveTimestamp = (timestamp) => {
  if (typeof timestamp === 'number') {
    return timestamp;
  }

  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }

  return Date.now();
};

const useGameLoop = ({ canvasRef, dispatch, settings }) => {
  const audioCtxRef = useRef(null);
  const audioWarningLoggedRef = useRef(false);
  const animationFrameRef = useRef(null);
  const renderStateRef = useRef(createInitialRenderState());
  const sharedStateRef = useRef(gameStore.getState());
  const movementIntentRef = useRef({ ...DEFAULT_JOYSTICK_STATE });
  const actionBufferRef = useRef({ attacks: [] });
  const dispatchRef = useRef(dispatch);
  const commandCallbackRef = useRef(settings?.onCommandBatch ?? null);
  const evolutionCallbackRef = useRef(settings?.onEvolutionDelta ?? null);

  useEffect(() => {
    dispatchRef.current = dispatch;
  }, [dispatch]);

  useEffect(() => {
    commandCallbackRef.current = settings?.onCommandBatch ?? null;
    evolutionCallbackRef.current = settings?.onEvolutionDelta ?? null;
  }, [settings]);

  useEffect(() => {
    sharedStateRef.current = gameStore.getState();
    const unsubscribe = gameStore.subscribe(() => {
      sharedStateRef.current = gameStore.getState();
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  const resolvedSettings = useMemo(
    () => ({
      ...DEFAULT_SETTINGS,
      ...(settings || {}),
    }),
    [settings]
  );

  const renderSettingsRef = useRef(resolvedSettings);

  useEffect(() => {
    renderSettingsRef.current = resolvedSettings;
  }, [resolvedSettings]);

  const densityScale = useMemo(
    () => DENSITY_SCALE[resolvedSettings.visualDensity] ?? DENSITY_SCALE.medium,
    [resolvedSettings.visualDensity]
  );

  const soundEffects = useMemo(() => createSoundEffects(() => audioCtxRef.current), []);

  const resumeAudioContextIfSuspended = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || typeof ctx.state !== 'string' || ctx.state !== 'suspended') {
      return;
    }

    try {
      const resumeResult = ctx.resume?.();
      if (resumeResult && typeof resumeResult.catch === 'function') {
        resumeResult.catch((error) => {
          if (!audioWarningLoggedRef.current) {
            console.warn('Failed to resume Web Audio context; audio may be unavailable.', error);
            audioWarningLoggedRef.current = true;
          }
        });
      }
    } catch (error) {
      if (!audioWarningLoggedRef.current) {
        console.warn('Failed to resume Web Audio context; audio may be unavailable.', error);
        audioWarningLoggedRef.current = true;
      }
    }
  }, []);

  const playSound = useCallback(
    (...args) => {
      resumeAudioContextIfSuspended();
      if (typeof soundEffects?.playSound !== 'function') {
        return undefined;
      }
      return soundEffects.playSound(...args);
    },
    [resumeAudioContextIfSuspended, soundEffects]
  );

  const skills = useMemo(() => createSkills({ playSound }), [playSound]);

  const createParticle = useCallback((arg1, arg2, arg3, arg4, arg5) => {
    let state = renderStateRef.current;
    if (!state) return;

    let payload = arg1;
    let x = arg1;
    let y = arg2;
    let colorOrOptions = arg3;
    let size = arg4;

    if (arg1 && typeof arg1 === 'object' && Array.isArray(arg1.particles)) {
      state = arg1;
      payload = arg2;
      x = arg2;
      y = arg3;
      colorOrOptions = arg4;
      size = arg5;
    }

    const normalizeParticles = (value) => {
      if (!value) return [];
      if (Array.isArray(value)) {
        return value.filter(
          (particle) =>
            particle &&
            typeof particle === 'object' &&
            Number.isFinite(particle.x) &&
            Number.isFinite(particle.y) &&
            Number.isFinite(particle.life),
        );
      }
      if (typeof value === 'function') {
        return normalizeParticles(value());
      }
      if (
        value &&
        typeof value === 'object' &&
        Number.isFinite(value.x) &&
        Number.isFinite(value.y) &&
        Number.isFinite(value.life)
      ) {
        return [value];
      }
      return [];
    };

    let particles = normalizeParticles(payload);

    if (!particles.length && Number.isFinite(x) && Number.isFinite(y)) {
      particles = normalizeParticles(generateParticle(x, y, colorOrOptions, size));
    }

    if (
      !particles.length &&
      payload &&
      typeof payload === 'object' &&
      Number.isFinite(payload.x) &&
      Number.isFinite(payload.y)
    ) {
      const { x: px, y: py, ...options } = payload;
      particles = normalizeParticles(generateParticle(px, py, options));
    }

    if (!particles.length) {
      return;
    }

    particles.forEach((particle) => {
      if (particle) {
        state.particles.push(particle);
      }
    });
  }, []);

  const createEffect = useCallback((x, y, type, color) => {
    const effect = generateVisualEffect(x, y, type, color);
    if (!effect) return;

    const state = renderStateRef.current;
    state.effects.push(effect);
  }, []);

  const pushNotification = useCallback((text) => {
    if (!text) return;

    const state = renderStateRef.current;
    state.notifications = appendNotification(state.notifications, text);
  }, []);

  const updateLocalSkillState = useCallback(
    (state) => {
      if (!state) return;

      const organism = state.organism;
      if (!organism) {
        state.skillList = [];
        state.currentSkill = null;
        state.hasMultipleSkills = false;
        return;
      }

      const rawSkillKeys = Array.isArray(organism.skills) ? organism.skills : [];
      const skillKeys = rawSkillKeys
        .map((key) => {
          if (typeof key === 'string') return key;
          if (key === null || key === undefined) return null;
          return String(key);
        })
        .filter((key) => typeof key === 'string' && key.length > 0);

      const totalSkills = skillKeys.length;
      if (totalSkills === 0) {
        state.skillList = [];
        state.currentSkill = null;
        state.hasMultipleSkills = false;
        return;
      }

      const cooldowns =
        organism.skillCooldowns && typeof organism.skillCooldowns === 'object'
          ? organism.skillCooldowns
          : {};

      const rawIndex = Number.isFinite(organism.currentSkillIndex)
        ? Math.trunc(organism.currentSkillIndex)
        : 0;
      const normalizedIndex = ((rawIndex % totalSkills) + totalSkills) % totalSkills;
      if (normalizedIndex !== rawIndex) {
        organism.currentSkillIndex = normalizedIndex;
      }

      const list = skillKeys.map((skillKey, index) => {
        const definition = skills?.[skillKey];
        const cooldownSeconds = Number.isFinite(cooldowns?.[skillKey])
          ? Math.max(0, cooldowns[skillKey])
          : 0;
        const maxCooldownSeconds = definition && Number.isFinite(definition.cooldown)
          ? Math.max(0, definition.cooldown / 1000)
          : 0;

        const baseDefinition = definition
          ? { ...definition }
          : {
              name: skillKey,
              icon: '❔',
              type: 'active',
              element: null,
              applies: [],
              cost: {},
            };

        return {
          ...baseDefinition,
          key: skillKey,
          cooldown: cooldownSeconds,
          maxCooldown: maxCooldownSeconds,
          isActive: index === normalizedIndex,
        };
      });

      state.skillList = list;
      state.hasMultipleSkills = list.length > 1;

      const activeSkill = list[normalizedIndex] ? { ...list[normalizedIndex] } : null;
      state.currentSkill = activeSkill;
    },
    [skills]
  );

  const syncHudState = useCallback((state) => {
    if (!state) return;

    updateLocalSkillState(state);

    const safeArray = (value) => (Array.isArray(value) ? value : []);

    const boss = state.boss ?? null;
    const bossHealth = boss?.health?.current ?? boss?.health ?? state.bossHealth ?? 0;
    const bossMaxHealth = boss?.health?.max ?? boss?.maxHealth ?? state.bossMaxHealth ?? 0;
    const bossName = (() => {
      const rawName = typeof boss?.name === 'string'
        ? boss.name
        : typeof state.bossName === 'string'
        ? state.bossName
        : typeof boss?.label === 'string'
        ? boss.label
        : undefined;

      if (typeof rawName === 'string') {
        const trimmed = rawName.trim();
        if (trimmed.length > 0) {
          return trimmed;
        }
      }

      return undefined;
    })();

    const skillList = safeArray(state.skillList);
    const notifications = safeArray(state.notifications);
    const activePowerUps = safeArray(state.activePowerUps);
    const opponents = safeArray(state.enemies ?? state.opponents);
    const progressionQueue = safeArray(state.progressionQueue);

    const rawEvolutionMenu = state.evolutionMenu ?? {};
    const normalizedActiveTierRaw =
      typeof rawEvolutionMenu.activeTier === 'string'
        ? rawEvolutionMenu.activeTier.trim().toLowerCase()
        : 'small';
    const normalizedActiveTier = EVOLUTION_HISTORY_TIERS.includes(normalizedActiveTierRaw)
      ? normalizedActiveTierRaw
      : 'small';

    const normalizedOptions = createEmptyEvolutionMenuOptions();
    const rawOptions = rawEvolutionMenu.options ?? {};
    EVOLUTION_HISTORY_TIERS.forEach((tier) => {
      const optionList = rawOptions?.[tier];
      normalizedOptions[tier] = Array.isArray(optionList) ? optionList : [];
    });

    const evolutionMenu = {
      ...rawEvolutionMenu,
      activeTier: normalizedActiveTier,
      options: normalizedOptions,
    };

    dispatchRef.current?.({
      type: 'SYNC_STATE',
      payload: {
        energy: state.energy ?? 0,
        health: state.health ?? 0,
        maxHealth: state.maxHealth ?? state.health ?? 0,
        level: state.level ?? 1,
        score: state.score ?? 0,
        dashCharge: state.dashCharge ?? 100,
        canEvolve: Boolean(state.canEvolve),
        showEvolutionChoice: Boolean(state.showEvolutionChoice),
        archetypeSelection: state.archetypeSelection ?? {
          pending: true,
          options: [],
        },
        selectedArchetype: state.selectedArchetype ?? null,
        showMenu: Boolean(state.showMenu),
        gameOver: Boolean(state.gameOver),
        combo: state.combo ?? 0,
        maxCombo: state.maxCombo ?? 0,
        activePowerUps,
        bossActive: Boolean(boss),
        bossHealth,
        bossMaxHealth,
        bossName,
        currentSkill: state.currentSkill ?? null,
        skillList,
        hasMultipleSkills:
          typeof state.hasMultipleSkills === 'boolean'
            ? state.hasMultipleSkills
            : skillList.length > 1,
        notifications,
        evolutionMenu,
        currentForm: state.currentForm ?? null,
        evolutionType: state.evolutionType ?? null,
        cameraZoom: state.camera?.zoom ?? state.cameraZoom ?? 1,
        opponents,
        resources: state.resources ?? null,
        xp: state.xp ?? null,
        characteristicPoints: state.characteristicPoints ?? null,
        geneticMaterial: state.geneticMaterial ?? null,
        geneFragments: state.geneFragments ?? null,
        stableGenes: state.stableGenes ?? null,
        evolutionSlots: state.evolutionSlots ?? null,
        reroll: state.reroll ?? null,
        dropPity: state.dropPity ?? null,
        progressionQueue,
        recentRewards: state.recentRewards ?? null,
        evolutionContext: state.evolutionContext ?? null,
        element: state.element ?? null,
        affinity: state.affinity ?? null,
        elementLabel: state.elementLabel ?? null,
        affinityLabel: state.affinityLabel ?? null,
        resistances: state.resistances ?? null,
      },
    });
  }, [dispatchRef, updateLocalSkillState]);

  const setCameraZoom = useCallback(
    (zoomValue) => {
      const state = renderStateRef.current;
      const camera = state?.camera;
      if (!camera) return;

      const minZoom = 0.6;
      const maxZoom = 1.2;
      const parsed = Number.parseFloat(zoomValue);
      const safeValue = Number.isFinite(parsed) ? parsed : 1;
      const clamped = clamp(safeValue, minZoom, maxZoom);

      if (Math.abs((camera.zoom ?? 1) - clamped) < 0.0001) {
        return;
      }

      camera.zoom = clamped;
      syncHudState(state);
    },
    [syncHudState]
  );

  const setActiveEvolutionTier = useCallback(
    (tierKey) => {
      if (typeof tierKey !== 'string') return;

      const normalizedTier = tierKey.trim().toLowerCase();
      if (!EVOLUTION_HISTORY_TIERS.includes(normalizedTier)) {
        return;
      }

      const state = renderStateRef.current;
      if (!state) return;

      const currentMenu =
        state.evolutionMenu ?? {
          activeTier: 'small',
          options: createEmptyEvolutionMenuOptions(),
        };

      if (currentMenu.activeTier === normalizedTier) {
        return;
      }

      const safeOptions = { ...createEmptyEvolutionMenuOptions(), ...(currentMenu.options ?? {}) };

      state.evolutionMenu = {
        ...currentMenu,
        activeTier: normalizedTier,
        options: EVOLUTION_HISTORY_TIERS.reduce((acc, tier) => {
          acc[tier] = Array.isArray(safeOptions[tier]) ? safeOptions[tier] : [];
          return acc;
        }, {}),
      };

      syncHudState(state);
    },
    [syncHudState]
  );

  const selectArchetype = useCallback(
    (key) => {
      if (!key) return;
      const normalized = typeof key === 'string' ? key.trim() : '';
      if (!normalized) return;

      const state = renderStateRef.current;
      if (!state) return;

      const helpers = {
        createEffect,
        createParticle,
        addNotification: (targetState, text) => {
          if (!text) return;
          if (targetState && targetState !== renderStateRef.current) {
            targetState.notifications = appendNotification(targetState.notifications, text);
          }
          pushNotification(text);
        },
        syncState: syncHudState,
      };

      const result = selectArchetypeSystem(state, helpers, normalized) || state;

      if (result.archetypeSelection) {
        state.localArchetypeSelection = { ...result.archetypeSelection };
      } else {
        state.localArchetypeSelection = null;
      }
      state.localSelectedArchetype = result.selectedArchetype ?? normalized;
      state.selectedArchetype = result.selectedArchetype ?? normalized;
      state.hudSnapshot = {
        ...(state.hudSnapshot || {}),
        energy: result.energy,
        health: result.health,
        maxHealth: result.maxHealth,
        level: result.level,
        element: result.element,
        affinity: result.affinity,
        resistances: result.resistances,
        elementLabel: result.elementLabel,
        affinityLabel: result.affinityLabel,
        archetypeSelection: result.archetypeSelection,
        selectedArchetype: result.selectedArchetype ?? normalized,
      };

      syncHudState(state);

      if (typeof resolvedSettings.onArchetypeSelect === 'function') {
        const organism = result.organism || state.organism || null;
        const resolveStat = (value) => (Number.isFinite(value) ? Number(value) : undefined);
        const combatAttributes = organism
          ? {
              attack: resolveStat(organism.attack),
              defense: resolveStat(organism.defense),
              speed: resolveStat(organism.speed),
              range: resolveStat(organism.range ?? organism.attackRange),
            }
          : undefined;

        const snapshot = {
          energy: resolveStat(result.energy),
          health: resolveStat(result.health),
          maxHealth: resolveStat(result.maxHealth),
          element: result.element ?? null,
          affinity: result.affinity ?? null,
          resistances: result.resistances ?? null,
          selectedArchetype: result.selectedArchetype ?? normalized,
          combatAttributes,
        };

        resolvedSettings.onArchetypeSelect(normalized, snapshot);
      }
    },
    [
      createEffect,
      createParticle,
      pushNotification,
      resolvedSettings,
      syncHudState,
    ]
  );

  const initializeBackground = useCallback(() => {
    const state = renderStateRef.current;
    if (!state) return;

    const { background, camera } = state;
    if (!background || !camera) return;

    const sharedState = sharedStateRef.current;

    const zoom = Number.isFinite(camera.zoom) ? camera.zoom : 1;
    const viewportWidth = Number.isFinite(camera.viewport?.width)
      ? camera.viewport.width
      : typeof window !== 'undefined'
      ? window.innerWidth
      : 1280;
    const viewportHeight = Number.isFinite(camera.viewport?.height)
      ? camera.viewport.height
      : typeof window !== 'undefined'
      ? Math.max(0, window.innerHeight - 40)
      : 720;

    const halfWidth = viewportWidth > 0 ? viewportWidth / (zoom * 2) : WORLD_RADIUS;
    const halfHeight = viewportHeight > 0 ? viewportHeight / (zoom * 2) : WORLD_RADIUS;
    const spawnRadiusX = Math.max(halfWidth * 1.6, 480);
    const spawnRadiusY = Math.max(halfHeight * 1.6, 360);

    const wrapCoordinate = (value) => {
      if (!Number.isFinite(value)) return 0;
      let result = value % WORLD_SIZE;
      if (result < 0) {
        result += WORLD_SIZE;
      }
      return result;
    };

    const randomOffset = (radius) => (Math.random() - 0.5) * 2 * radius;

    const localPlayerId = sharedState?.playerId ?? null;
    const renderPlayer =
      localPlayerId && typeof state.playersById?.get === 'function'
        ? state.playersById.get(localPlayerId)
        : null;
    const sharedLocalPlayer = localPlayerId
      ? sharedState?.players?.[localPlayerId] ?? sharedState?.remotePlayers?.byId?.[localPlayerId] ?? null
      : null;

    const resolveAxis = (axis) => {
      const renderValue = Number.isFinite(renderPlayer?.renderPosition?.[axis])
        ? renderPlayer.renderPosition[axis]
        : null;
      if (renderValue !== null) return renderValue;

      const sharedValue = Number.isFinite(sharedLocalPlayer?.position?.[axis])
        ? sharedLocalPlayer.position[axis]
        : null;
      if (sharedValue !== null) return sharedValue;

      const cameraValue = Number.isFinite(camera?.[axis]) ? camera[axis] : null;
      if (cameraValue !== null) return cameraValue;

      return WORLD_RADIUS;
    };

    const anchorX = resolveAxis('x');
    const anchorY = resolveAxis('y');

    const createAnchoredPosition = (radiusMultiplier = 1, customOffset) => {
      const offsetX = Number.isFinite(customOffset?.x)
        ? customOffset.x
        : randomOffset(spawnRadiusX * radiusMultiplier);
      const offsetY = Number.isFinite(customOffset?.y)
        ? customOffset.y
        : randomOffset(spawnRadiusY * radiusMultiplier);
      const x = wrapCoordinate(anchorX + offsetX);
      const y = wrapCoordinate(anchorY + offsetY);
      return {
        x,
        y,
        spawnOffsetX: offsetX,
        spawnOffsetY: offsetY,
        anchorX,
        anchorY,
      };
    };

    const createAnchoredValue = (radiusMultiplier = 1) =>
      wrapCoordinate(anchorX + randomOffset(spawnRadiusX * radiusMultiplier));
    const createAnchoredValueY = (radiusMultiplier = 1) =>
      wrapCoordinate(anchorY + randomOffset(spawnRadiusY * radiusMultiplier));

    background.floatingParticles = [];
    background.glowParticles = [];
    background.microorganisms = [];
    background.lightRays = [];
    background.backgroundLayers = [];

    const floatingCount = Math.max(150, Math.round(500 * densityScale));
    for (let i = 0; i < floatingCount; i += 1) {
      const position = createAnchoredPosition(1.1);
      background.floatingParticles.push({
        ...position,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        size: Math.random() * 3 + 0.5,
        opacity: Math.random() * 0.5 + 0.1,
        depth: Math.random(),
        hue: Math.random() * 60 + 180,
        pulsePhase: Math.random() * Math.PI * 2,
        pulseSpeed: 0.5 + Math.random() * 1.5,
      });
    }

    const glowCount = Math.max(60, Math.round(150 * densityScale));
    for (let i = 0; i < glowCount; i += 1) {
      const position = createAnchoredPosition(1.05);
      background.glowParticles.push({
        ...position,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        size: Math.random() * 4 + 2,
        opacity: Math.random() * 0.8 + 0.2,
        depth: Math.random(),
        color: ['rgba(0, 255, 200, ', 'rgba(100, 200, 255, ', 'rgba(200, 100, 255, '][
          Math.floor(Math.random() * 3)
        ],
        pulsePhase: Math.random() * Math.PI * 2,
        glowIntensity: Math.random() * 20 + 10,
      });
    }

    const microorganismCount = Math.max(24, Math.round(60 * densityScale));
    for (let i = 0; i < microorganismCount; i += 1) {
      const baseSize = Math.random() * 6 + 3;
      const baseOpacity = Math.random() * 0.3 + 0.1;
      const heading = Math.random() * Math.PI * 2;
      const baseSpeed = 0.1 + Math.random() * 0.25;
      const homeX = createAnchoredValue(1.6);
      const homeY = createAnchoredValueY(1.6);
      const vortexRadius = 120 + Math.random() * 160;
      const vortexAngle = Math.random() * Math.PI * 2;
      const vortexX = wrapCoordinate(homeX + Math.cos(vortexAngle) * vortexRadius);
      const vortexY = wrapCoordinate(homeY + Math.sin(vortexAngle) * vortexRadius);
      const position = createAnchoredPosition(1.4);

      background.microorganisms.push({
        ...position,
        vx: Math.cos(heading) * baseSpeed,
        vy: Math.sin(heading) * baseSpeed,
        heading,
        targetHeading: heading,
        turnRate: 0.04 + Math.random() * 0.04,
        headingTimer: 90 + Math.random() * 180,
        headingInterval: 90 + Math.random() * 180,
        headingVariance: Math.PI * (0.2 + Math.random() * 0.3),
        speed: baseSpeed,
        targetSpeed: baseSpeed,
        baseSpeed,
        speedTimer: 120 + Math.random() * 200,
        speedInterval: 120 + Math.random() * 200,
        speedLerp: 0.05 + Math.random() * 0.05,
        noiseOffset: Math.random() * 1000,
        noiseSpeed: 0.0005 + Math.random() * 0.001,
        noiseHeadingScale: 0.1 + Math.random() * 0.2,
        noiseSpeedScale: 0.2 + Math.random() * 0.3,
        vortexX,
        vortexY,
        swirlStrength: 0.01 + Math.random() * 0.04,
        swirlSpeed: 0.005 + Math.random() * 0.01,
        swirlPhase: Math.random() * Math.PI * 2,
        homeX,
        homeY,
        edgeMargin: 150 + Math.random() * 80,
        scalePhase: Math.random() * Math.PI * 2,
        scaleSpeed: 0.015 + Math.random() * 0.03,
        scaleTurnInfluence: 0.3 + Math.random() * 0.5,
        currentScale: 1,
        currentOpacity: baseOpacity,
        updateStride: 1 + Math.floor(Math.random() * 3),
        updateFrame: Math.floor(Math.random() * 3),
        size: baseSize,
        opacity: baseOpacity,
        color: ['rgba(100, 200, 255, ', 'rgba(100, 255, 200, ', 'rgba(255, 200, 100, '][
          Math.floor(Math.random() * 3)
        ],
        animPhase: Math.random() * Math.PI * 2,
        depth: 0.3 + Math.random() * 0.4,
      });
    }

    const lightRayCount = Math.max(3, Math.round(5 * densityScale));
    for (let i = 0; i < lightRayCount; i += 1) {
      const offset = {
        x: randomOffset(spawnRadiusX * 1.2),
        y: -spawnRadiusY * 0.8 - 200 + Math.random() * 150,
      };
      const position = createAnchoredPosition(1, offset);
      background.lightRays.push({
        ...position,
        angle: (Math.random() - 0.5) * 0.3,
        width: Math.random() * 100 + 50,
        opacity: Math.random() * 0.1 + 0.05,
        length: 1000 + Math.random() * 500,
        speed: Math.random() * 0.1 + 0.05,
      });
    }

    for (let i = 0; i < 3; i += 1) {
      const position = createAnchoredPosition(1.8);
      background.backgroundLayers.push({
        ...position,
        size: Math.random() * 300 + 200,
        opacity: Math.random() * 0.05 + 0.02,
        color: i === 0 ? '#0a3a4a' : i === 1 ? '#1a2a3a' : '#2a1a3a',
        depth: 0.2 + i * 0.15,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }

    background.spawnAnchor = { x: anchorX, y: anchorY };
    background.spawnBounds = { radiusX: spawnRadiusX, radiusY: spawnRadiusY };
  }, [densityScale]);

  const cycleSkillHandler = useCallback(
    (direction = 1) => {
      const state = renderStateRef.current;
      if (!state) return;

      const helpers = {
        skills,
        addNotification: (targetState, text) => {
          if (!text) return;
          if (targetState && targetState !== renderStateRef.current) {
            targetState.notifications = appendNotification(targetState.notifications, text);
          }
          pushNotification(text);
        },
        syncState: syncHudState,
      };

      cycleSkillSystem(state, helpers, direction);
    },
    [skills, syncHudState, pushNotification]
  );

  const openEvolutionMenuHandler = useCallback(() => {
    const state = renderStateRef.current;
    if (!state) return;

    const helpers = {
      addNotification: (targetState, text) => {
        if (!text) return;
        if (targetState && targetState !== renderStateRef.current) {
          targetState.notifications = appendNotification(targetState.notifications, text);
        }
        pushNotification(text);
      },
      playSound,
      syncState: syncHudState,
    };

    openEvolutionMenuSystem(state, helpers);
    syncHudState(state);
  }, [playSound, pushNotification, syncHudState]);

  const captureLocalCombatSnapshot = useCallback(() => {
    const sharedState = sharedStateRef.current;
    const renderState = renderStateRef.current;

    const fallback = { targetPlayerId: null, targetObjectId: null, state: null };

    if (!sharedState) {
      return fallback;
    }

    const localPlayerId = sharedState.playerId;
    if (!localPlayerId) {
      return fallback;
    }

    const applyStatus = (status, accumulator) => {
      if (!status || typeof status !== 'object') {
        return;
      }

      if (!accumulator.state && typeof status.state === 'string' && status.state) {
        accumulator.state = status.state;
      }

      const isActiveState = status.state === 'engaged' || status.state === 'cooldown';

      if (isActiveState) {
        if (!accumulator.targetPlayerId && typeof status.targetPlayerId === 'string' && status.targetPlayerId) {
          accumulator.targetPlayerId = status.targetPlayerId;
        }

        if (!accumulator.targetObjectId && typeof status.targetObjectId === 'string' && status.targetObjectId) {
          accumulator.targetObjectId = status.targetObjectId;
        }
      }
    };

    const accumulator = { ...fallback };

    const playersById = renderState?.playersById;
    if (playersById && typeof playersById.get === 'function') {
      const renderPlayer = playersById.get(localPlayerId);
      if (renderPlayer?.combatStatus) {
        applyStatus(renderPlayer.combatStatus, accumulator);
      }
    }

    const sharedPlayers = sharedState.players ?? null;
    const sharedLocalPlayer = sharedPlayers?.[localPlayerId] ?? null;
    if (sharedLocalPlayer?.combatStatus) {
      applyStatus(sharedLocalPlayer.combatStatus, accumulator);
    }

    const remotePlayersById = sharedState.remotePlayers?.byId ?? null;
    const remoteLocalPlayer = remotePlayersById?.[localPlayerId] ?? null;
    if (remoteLocalPlayer?.combatStatus) {
      applyStatus(remoteLocalPlayer.combatStatus, accumulator);
    }

    if (!accumulator.targetPlayerId && !accumulator.targetObjectId) {
      const renderPlayer = playersById?.get?.(localPlayerId) ?? null;
      const playerPosition = resolvePlayerPosition({
        renderPlayer,
        sharedPlayer: sharedLocalPlayer ?? remoteLocalPlayer ?? null,
      });

      const sharedMicroorganisms = [
        ...(Array.isArray(sharedState?.world?.microorganisms)
          ? sharedState.world.microorganisms
          : []),
        ...(Array.isArray(sharedState?.microorganisms?.all)
          ? sharedState.microorganisms.all
          : []),
      ];

      const targetId = findNearestAttackableMicroorganismId({
        playerPosition,
        renderMicroorganisms: renderState?.worldView?.microorganisms,
        sharedMicroorganisms: sharedMicroorganisms.length > 0 ? sharedMicroorganisms : undefined,
        aggressionPreference: [["hostile"], ["neutral"]],
      });

      if (targetId) {
        accumulator.targetObjectId = targetId;
      }
    }

    return accumulator;
  }, []);

  const queueAttackCommand = useCallback(
    (kind) => {
      const timestamp = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const combatSnapshot = captureLocalCombatSnapshot();

      const payload = {
        kind,
        timestamp,
      };

      if (combatSnapshot?.targetPlayerId) {
        payload.targetPlayerId = combatSnapshot.targetPlayerId;
      }

      if (combatSnapshot?.targetObjectId) {
        payload.targetObjectId = combatSnapshot.targetObjectId;
      }

      const rawState = typeof combatSnapshot?.state === 'string' ? combatSnapshot.state : null;
      const normalizedState = rawState === 'engaged' ? rawState : null;

      if (normalizedState) {
        payload.state = normalizedState;
      }

      actionBufferRef.current.attacks.push(payload);
    },
    [captureLocalCombatSnapshot]
  );

  const { joystick, actions: inputActions } = useInputController({
    onMovementIntent: (intent) => {
      movementIntentRef.current = intent;
    },
    onAttack: () => {
      queueAttackCommand('basic');
    },
    onDash: () => {
      queueAttackCommand('dash');
    },
    onUseSkill: () => {
      queueAttackCommand('skill');
    },
    onCycleSkill: cycleSkillHandler,
    onOpenEvolutionMenu: openEvolutionMenuHandler,
    onActionButtonChange: () => {},
  });

  useEffect(() => {
    initializeBackground();
  }, [initializeBackground]);

  const restartGameHandler = useCallback(() => {
    const preservedArchetype = renderStateRef.current?.selectedArchetype ?? null;
    const createEntityId = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    const ensureArray = (value) => (Array.isArray(value) ? value : []);

    const resetControls = () => {
      movementIntentRef.current = { ...DEFAULT_JOYSTICK_STATE };
      actionBufferRef.current = { attacks: [] };
      renderStateRef.current.pendingInputs = { movement: null, attacks: [] };
      renderStateRef.current.lastMovementIntent = { ...DEFAULT_JOYSTICK_STATE };
      renderStateRef.current.lastMovementAngle = 0;
    };

    const spawnObstacle = (state) => {
      if (!state) return;
      const obstacle = createObstacleSpawn({ worldSize: state.worldSize ?? WORLD_SIZE });
      if (!obstacle) return;

      const normalized = {
        ...obstacle,
        id: obstacle.id ?? createEntityId('obstacle'),
        position: {
          x: obstacle.x ?? obstacle.position?.x ?? 0,
          y: obstacle.y ?? obstacle.position?.y ?? 0,
        },
        size: {
          x: obstacle.size ?? obstacle.size?.x ?? 60,
          y: obstacle.size ?? obstacle.size?.y ?? 60,
        },
        orientation: {
          angle: obstacle.rotation ?? obstacle.orientation?.angle ?? 0,
        },
        impassable: obstacle.impassable ?? true,
      };

      state.obstacles = [...ensureArray(state.obstacles), normalized];
    };

    const spawnNebula = (state) => {
      if (!state) return;
      const nebula = createNebulaSpawn({ worldSize: state.worldSize ?? WORLD_SIZE });
      if (!nebula) return;

      state.nebulas = [...ensureArray(state.nebulas), nebula];
    };

    const spawnPowerUp = (state) => {
      if (!state) return;
      const powerUp = createPowerUpSpawn({ worldSize: state.worldSize ?? WORLD_SIZE });
      if (!powerUp) return;

      const normalized = {
        ...powerUp,
        position: {
          x: powerUp.x ?? powerUp.position?.x ?? 0,
          y: powerUp.y ?? powerUp.position?.y ?? 0,
        },
      };

      state.powerUps = [...ensureArray(state.powerUps), normalized];
    };

    const spawnOrganicMatter = (state) => {
      if (!state) return;
      const batch = createOrganicMatterBatch({
        count: Math.max(6, Math.round(10 * densityScale)),
        worldSize: state.worldSize ?? WORLD_SIZE,
      });
      if (!batch?.length) return;

      const normalized = batch.map((item) => ({
        ...item,
        id: item.id ?? createEntityId('organic'),
        position: {
          x: item.x ?? item.position?.x ?? 0,
          y: item.y ?? item.position?.y ?? 0,
        },
        quantity:
          Number.isFinite(item.quantity)
            ? item.quantity
            : Math.max(1, Math.round(item.energy ?? item.health ?? 0)),
      }));

      state.organicMatter = [...ensureArray(state.organicMatter), ...normalized];
    };

    renderStateRef.current = createInitialRenderState();
    if (preservedArchetype) {
      renderStateRef.current.selectedArchetype = preservedArchetype;
      renderStateRef.current.localSelectedArchetype = preservedArchetype;
    }
    initializeBackground();
    resetControls();

    restartGameSystem(renderStateRef.current, {
      createEffect,
      createParticle,
      syncState: syncHudState,
      resetControls,
      spawnObstacle,
      spawnNebula,
      spawnPowerUp,
      spawnOrganicMatter,
      createInitialState,
    });

    renderStateRef.current.hudSnapshot = null;
    syncHudState(renderStateRef.current);
  }, [createEffect, createParticle, densityScale, initializeBackground, syncHudState]);

  const chooseEvolutionHandler = useCallback(
    (evolutionKey, tier) => {
      if (!evolutionKey) return;

      const state = renderStateRef.current;
      if (!state) return;

      const beforeSnapshot = snapshotEvolutionState(state.organism);
      const helpers = {
        createEffect,
        createParticle,
        addNotification: (targetState, text) => {
          if (!text) return;
          if (targetState && targetState !== renderStateRef.current) {
            targetState.notifications = appendNotification(targetState.notifications, text);
          }
          pushNotification(text);
        },
        playSound,
        syncState: syncHudState,
      };

      chooseEvolutionSystem(state, helpers, evolutionKey, tier);
      const afterSnapshot = snapshotEvolutionState(state.organism);
      const evolutionDelta = diffEvolutionSnapshots(beforeSnapshot, afterSnapshot, evolutionKey, tier);
      if (evolutionDelta && evolutionCallbackRef.current) {
        evolutionCallbackRef.current(evolutionDelta);
      }
      syncHudState(state);
    },
    [createEffect, createParticle, playSound, pushNotification, syncHudState]
  );

  const requestEvolutionRerollHandler = useCallback(() => {
    const state = renderStateRef.current;
    if (!state) return;

    const helpers = {
      addNotification: (targetState, text) => {
        if (!text) return;
        if (targetState && targetState !== renderStateRef.current) {
          targetState.notifications = appendNotification(targetState.notifications, text);
        }
        pushNotification(text);
      },
      playSound,
      syncState: syncHudState,
    };

    requestEvolutionRerollSystem(state, helpers);
    syncHudState(state);
  }, [playSound, pushNotification, syncHudState]);

  const cancelEvolutionChoiceHandler = useCallback(() => {
    const state = renderStateRef.current;
    if (!state) return;

    const helpers = {
      syncState: syncHudState,
    };

    cancelEvolutionChoiceSystem(state, helpers);
    syncHudState(state);
  }, [syncHudState]);

  useEffect(() => {
    if (!resolvedSettings.audioEnabled) {
      if (audioCtxRef.current && typeof audioCtxRef.current.close === 'function') {
        void audioCtxRef.current.close()?.catch((error) => {
          if (!audioWarningLoggedRef.current) {
            console.warn('Failed to close Web Audio context; audio resources may remain allocated.', error);
            audioWarningLoggedRef.current = true;
          }
        });
      }
      audioCtxRef.current = null;
      return;
    }

    const AudioContextCtor =
      typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);

    if (!AudioContextCtor) {
      audioCtxRef.current = null;
      if (!audioWarningLoggedRef.current) {
        console.warn('Web Audio API unavailable; game audio disabled.');
        audioWarningLoggedRef.current = true;
      }
      return;
    }

    if (audioCtxRef.current) {
      return;
    }

    try {
      audioCtxRef.current = new AudioContextCtor();
    } catch (error) {
      audioCtxRef.current = null;
      if (!audioWarningLoggedRef.current) {
        console.warn('Failed to initialize Web Audio API; game audio disabled.', error);
        audioWarningLoggedRef.current = true;
      }
    }
  }, [resolvedSettings.audioEnabled]);

  useEffect(
    () => () => {
      if (audioCtxRef.current && typeof audioCtxRef.current.close === 'function') {
        void audioCtxRef.current.close()?.catch((error) => {
          if (!audioWarningLoggedRef.current) {
            console.warn('Failed to close Web Audio context; audio resources may remain allocated.', error);
            audioWarningLoggedRef.current = true;
          }
        });
      }
    },
    []
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.warn('Canvas 2D context not available; aborting game loop setup.');
      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
      };
    }

    const updateCanvasSize = () => {
      const dpr = window.devicePixelRatio || 1;
      const parentElement = canvas.parentElement;
      let width;
      let height;

      if (parentElement && typeof parentElement.getBoundingClientRect === 'function') {
        const { width: parentWidth, height: parentHeight } = parentElement.getBoundingClientRect();
        width = parentWidth;
        height = parentHeight;
      } else {
        width = window.innerWidth;
        height = window.innerHeight;
      }

      const resolvedWidth = Math.max(0, width);
      const resolvedHeight = Math.max(0, height);

      canvas.style.width = `${resolvedWidth}px`;
      canvas.style.height = `${resolvedHeight}px`;

      const displayWidth = Math.round(resolvedWidth * dpr);
      const displayHeight = Math.round(resolvedHeight * dpr);

      if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;

        if (typeof ctx.resetTransform === 'function') {
          ctx.resetTransform();
        } else {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
        }

        ctx.scale(dpr, dpr);
      }
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);

    let lastTime = null;

    const animate = (timestamp) => {
      const now = resolveTimestamp(timestamp);

      if (lastTime === null) {
        lastTime = now;
      }

      let deltaMs = now - lastTime;
      if (!Number.isFinite(deltaMs) || deltaMs < 0) {
        deltaMs = 0;
      }

      const clampedDeltaMs = Math.min(deltaMs, MAX_FRAME_DELTA_MS);
      const delta = clampedDeltaMs / 1000;

      // Always reset to the current RAF timestamp so we don't accumulate large catch-up steps
      // when the tab resumes after being paused or throttled.
      lastTime = now;

      const canvasWidth = canvas.clientWidth || canvas.width / (window.devicePixelRatio || 1);
      const canvasHeight = canvas.clientHeight || canvas.height / (window.devicePixelRatio || 1);

      const renderState = renderStateRef.current;
      const sharedState = sharedStateRef.current;
      const camera = renderState.camera;

      const updateResult = updateGameState({
        renderState,
        sharedState,
        delta,
        movementIntent: movementIntentRef.current,
        actionBuffer: actionBufferRef.current,
        helpers: {
          createEffect,
          createParticle,
          addNotification: pushNotification,
          playSound,
        },
      });

      const state = renderStateRef.current;
      updateStatusAuras(state, delta, {
        events: sharedState?.statusEffects,
        createParticle,
        now,
      });
      syncDamagePopups(state, sharedState, delta);
      processLocalCombatLogFeedback(state, sharedState, updateResult.localPlayerId, {
        createParticle,
      });
      const hudSnapshot = updateResult?.hudSnapshot ?? null;
      let shouldSyncProgression = false;

      if (state && hudSnapshot) {
        const previousXp = state.xp || null;
        const xpSnapshot = hudSnapshot.xp && typeof hudSnapshot.xp === 'object' ? hudSnapshot.xp : null;
        if (xpSnapshot) {
          const xpPayload = { ...xpSnapshot };
          state.xp = xpPayload;

          const syncTargetResources = (target) => {
            if (!target || typeof target !== 'object') {
              return;
            }

            if (!target.resources || typeof target.resources !== 'object') {
              target.resources = {};
            }

            target.resources.xp = xpPayload;
          };

          if (!state.resources || typeof state.resources !== 'object') {
            state.resources = {};
          }
          state.resources.xp = xpPayload;

          if (state.organism && typeof state.organism === 'object') {
            syncTargetResources(state.organism);
          }

          const localRenderPlayer =
            updateResult.localPlayerId && state.playersById && typeof state.playersById.get === 'function'
              ? state.playersById.get(updateResult.localPlayerId)
              : null;
          syncTargetResources(localRenderPlayer);

          if (Array.isArray(state.playerList) && state.playerList.length > 0 && updateResult.localPlayerId) {
            const listEntry = state.playerList.find((player) => player?.id === updateResult.localPlayerId);
            syncTargetResources(listEntry);
          }

          if (!previousXp) {
            shouldSyncProgression = true;
          } else if (
            xpPayload.current !== previousXp.current ||
            xpPayload.total !== previousXp.total ||
            xpPayload.next !== previousXp.next
          ) {
            shouldSyncProgression = true;
          }

          if (!shouldSyncProgression && xpPayload.next > 0 && xpPayload.current >= xpPayload.next) {
            shouldSyncProgression = true;
          }
        }

        const pendingLevel = Number.isFinite(state.pendingEvolutionLevel)
          ? state.pendingEvolutionLevel
          : null;
        const confirmedLevel = Number.isFinite(state.confirmedLevel)
          ? state.confirmedLevel
          : Number.isFinite(state.level)
          ? state.level
          : 1;

        if (Number.isFinite(hudSnapshot.level)) {
          const snapshotLevel = hudSnapshot.level;
          state.confirmedLevel = Math.max(confirmedLevel, snapshotLevel);

          if (pendingLevel && snapshotLevel < pendingLevel) {
            hudSnapshot.level = pendingLevel;
          } else if (snapshotLevel !== state.level) {
            state.level = snapshotLevel;
            if (pendingLevel && snapshotLevel >= pendingLevel) {
              state.pendingEvolutionLevel = null;
            }
            shouldSyncProgression = true;
          } else if (pendingLevel && snapshotLevel >= pendingLevel) {
            state.pendingEvolutionLevel = null;
          }
        } else if (pendingLevel) {
          hudSnapshot.level = pendingLevel;
        }

        if (hudSnapshot.reroll && typeof hudSnapshot.reroll === 'object') {
          state.reroll = state.reroll && typeof state.reroll === 'object' ? state.reroll : {};
          Object.assign(state.reroll, hudSnapshot.reroll);
        }
      }

      if (state && shouldSyncProgression) {
        const helpers = {
          addNotification: (targetState, text) => {
            if (!text) return;
            if (targetState && targetState !== renderStateRef.current) {
              targetState.notifications = appendNotification(targetState.notifications, text);
            }
            pushNotification(text);
          },
        };

        checkEvolutionSystem(state, helpers);
        if (hudSnapshot) {
          if (state.xp && typeof state.xp === 'object') {
            if (!hudSnapshot.xp || typeof hudSnapshot.xp !== 'object') {
              hudSnapshot.xp = { ...state.xp };
            } else {
              Object.assign(hudSnapshot.xp, state.xp);
            }

            if (!hudSnapshot.resourceBag || typeof hudSnapshot.resourceBag !== 'object') {
              hudSnapshot.resourceBag = {};
            }
            const bagXp =
              hudSnapshot.resourceBag.xp && typeof hudSnapshot.resourceBag.xp === 'object'
                ? hudSnapshot.resourceBag.xp
                : (hudSnapshot.resourceBag.xp = {});
            Object.assign(bagXp, state.xp);
          }
          if (typeof hudSnapshot.level === 'number') {
            hudSnapshot.level = state.level;
          }
          hudSnapshot.confirmedLevel = Number.isFinite(state.confirmedLevel)
            ? state.confirmedLevel
            : state.level;
          if (state.xp && typeof state.xp === 'object') {
            const xpClone = { ...state.xp };
            if (Array.isArray(state.xp.thresholds)) {
              xpClone.thresholds = [...state.xp.thresholds];
            }
            hudSnapshot.xp = xpClone;
          }
          const existingBag =
            hudSnapshot.resourceBag && typeof hudSnapshot.resourceBag === 'object'
              ? { ...hudSnapshot.resourceBag }
              : {};
          hudSnapshot.resourceBag = {
            ...existingBag,
            level: state.level,
          };
          if (hudSnapshot.reroll && state.reroll && typeof state.reroll === 'object') {
            Object.assign(hudSnapshot.reroll, state.reroll);
          }
          if (Array.isArray(state.notifications)) {
            hudSnapshot.notifications = state.notifications.map((notification) => {
              if (!notification || typeof notification !== 'object') {
                return notification;
              }
              return { ...notification };
            });
          }
        }
        syncHudState(state);
      }

      if (state && hudSnapshot) {
        const pendingLevel = Number.isFinite(state.pendingEvolutionLevel)
          ? state.pendingEvolutionLevel
          : null;

        if (pendingLevel) {
          if (!Number.isFinite(hudSnapshot.level) || hudSnapshot.level < pendingLevel) {
            hudSnapshot.level = pendingLevel;
          }
        }

        if (typeof hudSnapshot.confirmedLevel !== 'number') {
          hudSnapshot.confirmedLevel = Number.isFinite(state.confirmedLevel)
            ? state.confirmedLevel
            : Number.isFinite(state.level)
            ? state.level
            : pendingLevel ?? 1;
        }

        if (!hudSnapshot.resourceBag || typeof hudSnapshot.resourceBag !== 'object') {
          hudSnapshot.resourceBag = { level: Number.isFinite(state.level) ? state.level : pendingLevel ?? 1 };
        } else if (
          !Number.isFinite(hudSnapshot.resourceBag.level) ||
          hudSnapshot.resourceBag.level < (Number.isFinite(state.level) ? state.level : pendingLevel ?? 1)
        ) {
          hudSnapshot.resourceBag = {
            ...hudSnapshot.resourceBag,
            level: Number.isFinite(state.level) ? state.level : pendingLevel ?? 1,
          };
        }

        hudSnapshot.showEvolutionChoice = Boolean(state.showEvolutionChoice);
      }

      renderState.pendingInputs = updateResult.commands;
      if (updateResult.commands && commandCallbackRef.current) {
        commandCallbackRef.current(updateResult.commands);
      }

      const background = renderState.background;
      if (background) {
        const tracker = background.lifeTracker || { wasAlive: false, seenPlayer: false };
        const localPlayer = updateResult.localPlayerId
          ? renderState.playersById.get(updateResult.localPlayerId)
          : null;
        const isAlive = !!localPlayer && Number.isFinite(localPlayer?.health?.current)
          ? localPlayer.health.current > 0
          : !!localPlayer;

        const shouldReinitialize = isAlive && (!tracker.seenPlayer || !tracker.wasAlive);
        if (shouldReinitialize) {
          initializeBackground();
        }

        background.lifeTracker = {
          wasAlive: isAlive,
          seenPlayer: tracker.seenPlayer || !!localPlayer,
        };
      }

      if (updateResult.hudSnapshot) {
        dispatchRef.current({
          type: 'SYNC_STATE',
          payload: updateResult.hudSnapshot,
        });
      }

      ctx.clearRect(0, 0, canvasWidth, canvasHeight);

      const cameraOffsetX = camera.x - canvasWidth / 2;
      const cameraOffsetY = camera.y - canvasHeight / 2;

      camera.offsetX = cameraOffsetX;
      camera.offsetY = cameraOffsetY;
      camera.viewport = {
        width: canvasWidth,
        height: canvasHeight,
      };

      const settingsSnapshot = renderSettingsRef.current;

      const frameResult = renderFrame(
        ctx,
        {
          background: renderState.background,
          worldView: renderState.worldView,
          players: renderState.playerList,
          combatIndicators: renderState.combatIndicators,
          effects: renderState.effects,
          particles: renderState.particles,
          damagePopups: renderState.damagePopups,
          localPlayerId: updateResult.localPlayerId,
          pulsePhase: renderState.pulsePhase,
        },
        camera,
        {
          canvas,
          delta,
          viewport: {
            width: canvasWidth,
            height: canvasHeight,
          },
          settings: settingsSnapshot,
        }
      );

      if (frameResult) {
        renderState.effects = frameResult.effects;
        renderState.particles = frameResult.particles;
      }

      renderState.pulsePhase += delta * 4;

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate(resolveTimestamp());

    return () => {
      window.removeEventListener('resize', updateCanvasSize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [canvasRef, createEffect, createParticle, playSound, pushNotification]);

  return {
    joystick,
    inputActions,
    chooseEvolution: chooseEvolutionHandler,
    requestEvolutionReroll: requestEvolutionRerollHandler,
    cancelEvolutionChoice: cancelEvolutionChoiceHandler,
    restartGame: restartGameHandler,
    selectArchetype,
    setCameraZoom,
    setActiveEvolutionTier,
  };
};

export default useGameLoop;
