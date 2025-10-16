import { WORLD_RADIUS, WORLD_SIZE } from '@micr-omega/shared';

import { useCallback, useEffect, useMemo, useRef } from 'react';

import { createSoundEffects } from '../audio/soundEffects';
import { createSkills } from '../config';
import { createParticle as generateParticle } from '../effects/particles';
import { createVisualEffect as generateVisualEffect } from '../effects/visualEffects';
import { addNotification as appendNotification } from '../ui/notifications';
import { renderFrame } from '../render/renderFrame';
import { updateGameState } from './updateGameState';
import useInputController from '../input/useInputController';
import { DEFAULT_JOYSTICK_STATE } from '../input/utils';
import { gameStore } from '../../store/gameStore';
import { createInitialState } from '../state/initialState';
import {
  chooseEvolution as chooseEvolutionSystem,
  restartGame as restartGameSystem,
  cycleSkill as cycleSkillSystem,
  openEvolutionMenu as openEvolutionMenuSystem,
  requestEvolutionReroll as requestEvolutionRerollSystem,
  selectArchetype as selectArchetypeSystem,
} from '../systems';
import { spawnObstacle as createObstacleSpawn } from '../factories/obstacleFactory';
import { spawnNebula as createNebulaSpawn } from '../factories/nebulaFactory';
import { spawnPowerUp as createPowerUpSpawn } from '../factories/powerUpFactory';
import { spawnOrganicMatter as createOrganicMatterBatch } from '../factories/organicMatterFactory';
import {
  findNearestHostileMicroorganismId,
  resolvePlayerPosition,
} from '../../utils/targeting';

const DEFAULT_SETTINGS = {
  audioEnabled: true,
  visualDensity: 'medium',
  showTouchControls: false,
};

const EVOLUTION_STAT_KEYS = ['attack', 'defense', 'speed', 'range'];
const EVOLUTION_HISTORY_TIERS = ['small', 'medium', 'large'];

const snapshotEvolutionState = (organism) => {
  const persistentPassives = organism?.persistentPassives || {};
  const bases = {};
  EVOLUTION_STAT_KEYS.forEach((stat) => {
    const key = `base${stat.charAt(0).toUpperCase()}${stat.slice(1)}`;
    const value = organism && Number.isFinite(organism[key]) ? Number(organism[key]) : null;
    bases[stat] = value;
  });

  const history = {
    small: { ...(organism?.evolutionHistory?.small || {}) },
    medium: { ...(organism?.evolutionHistory?.medium || {}) },
    large: { ...(organism?.evolutionHistory?.large || {}) },
  };

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

  const densityScale = useMemo(
    () => DENSITY_SCALE[resolvedSettings.visualDensity] ?? DENSITY_SCALE.medium,
    [resolvedSettings.visualDensity]
  );

  const { playSound } = useMemo(() => createSoundEffects(() => audioCtxRef.current), []);
  const skills = useMemo(() => createSkills({ playSound }), [playSound]);

  const createParticle = useCallback((x, y, color, size = 3) => {
    const particle = generateParticle(x, y, color, size);
    if (!particle) return;

    const state = renderStateRef.current;
    state.particles.push(particle);
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

    const skillList = safeArray(state.skillList);
    const notifications = safeArray(state.notifications);
    const activePowerUps = safeArray(state.activePowerUps);
    const opponents = safeArray(state.enemies ?? state.opponents);
    const progressionQueue = safeArray(state.progressionQueue);

    const evolutionMenu =
      state.evolutionMenu ?? {
        activeTier: 'small',
        options: { small: [], medium: [], large: [] },
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

  const setCameraZoom = useCallback((zoomValue) => {
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
  }, []);

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
          options: { small: [], medium: [], large: [] },
        };

      if (currentMenu.activeTier === normalizedTier) {
        return;
      }

      const safeOptions = currentMenu.options ?? { small: [], medium: [], large: [] };

      state.evolutionMenu = {
        ...currentMenu,
        activeTier: normalizedTier,
        options: {
          small: Array.isArray(safeOptions.small) ? safeOptions.small : [],
          medium: Array.isArray(safeOptions.medium) ? safeOptions.medium : [],
          large: Array.isArray(safeOptions.large) ? safeOptions.large : [],
        },
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

      const targetId = findNearestHostileMicroorganismId({
        playerPosition,
        renderMicroorganisms: renderState?.worldView?.microorganisms,
        sharedMicroorganisms: sharedMicroorganisms.length > 0 ? sharedMicroorganisms : undefined,
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

      if (combatSnapshot?.state) {
        payload.state = combatSnapshot.state;
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

  useEffect(() => {
    if (!resolvedSettings.audioEnabled) {
      if (audioCtxRef.current && typeof audioCtxRef.current.close === 'function') {
        audioCtxRef.current.close();
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
        audioCtxRef.current.close();
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
      const width = window.innerWidth;
      const height = window.innerHeight - 40;

      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const displayWidth = Math.round(width * dpr);
      const displayHeight = Math.round(height * dpr);

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

      const frameResult = renderFrame(
        ctx,
        {
          background: renderState.background,
          worldView: renderState.worldView,
          players: renderState.playerList,
          combatIndicators: renderState.combatIndicators,
          effects: renderState.effects,
          particles: renderState.particles,
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
    restartGame: restartGameHandler,
    selectArchetype,
    setCameraZoom,
    setActiveEvolutionTier,
  };
};

export default useGameLoop;
