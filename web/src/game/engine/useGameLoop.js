import { useCallback, useEffect, useMemo, useRef } from 'react';

import { createInitialState } from '../state/initialState';
import {
  forms,
  createSkills,
  evolutionaryTraits,
  organicMatterTypes,
  enemyTemplates,
  obstacleTypes,
  nebulaTypes,
  createPowerUpTypes,
} from '../config';
import { spawnObstacle as createObstacleEntity } from '../factories/obstacleFactory';
import { spawnNebula as createNebulaEntity } from '../factories/nebulaFactory';
import {
  spawnPowerUp as createPowerUpEntity,
  dropPowerUps as calculatePowerUpDrops,
} from '../factories/powerUpFactory';
import { spawnOrganicMatter as createOrganicMatterEntities } from '../factories/organicMatterFactory';
import { createSoundEffects } from '../audio/soundEffects';
import { createParticle as generateParticle } from '../effects/particles';
import { createVisualEffect as generateVisualEffect } from '../effects/visualEffects';
import { addNotification as appendNotification } from '../ui/notifications';
import {
  spawnEnemy as createEnemyEntity,
  spawnBoss as createBossEntity,
} from '../factories/enemyFactory';
import { renderFrame } from '../render/renderFrame';
import { updateGameState } from './updateGameState';
import {
  performDash as performDashSystem,
  performAttack as performAttackSystem,
  useSkill as useSkillSystem,
  cycleSkill as cycleSkillSystem,
  checkEvolution as checkEvolutionSystem,
  openEvolutionMenu as openEvolutionMenuSystem,
  chooseTrait as chooseTraitSystem,
  chooseForm as chooseFormSystem,
  restartGame as restartGameSystem,
} from '../systems';
import useInputController from '../input/useInputController';
import { DEFAULT_JOYSTICK_STATE } from '../input/utils';
import { gameStore } from '../../store/gameStore';

const DEFAULT_SETTINGS = {
  audioEnabled: true,
  visualDensity: 'medium',
  showTouchControls: false,
};

const DENSITY_SCALE = {
  low: 0.6,
  medium: 1,
  high: 1.4,
};

const useCountScaler = (densityScale = 1) => {
  const remainderRef = useRef(0);

  useEffect(() => {
    remainderRef.current = 0;
  }, [densityScale]);

  return useCallback(
    (baseCount = 1) => {
      if (!densityScale || baseCount <= 0) {
        remainderRef.current = 0;
        return 0;
      }

      const desired = baseCount * densityScale + remainderRef.current;
      const count = Math.floor(desired);
      remainderRef.current = desired - count;

      if (count === 0 && desired > 0) {
        return 0;
      }

      return count;
    },
    [densityScale]
  );
};

const useGameLoop = ({ canvasRef, dispatch, settings }) => {
  const audioCtxRef = useRef(null);
  const audioWarningLoggedRef = useRef(false);
  const animationFrameRef = useRef(null);
  const stateRef = useRef(createInitialState());
  const movementIntentRef = useRef({ ...DEFAULT_JOYSTICK_STATE });
  const inputResetRef = useRef((state) => {
    const targetState = state ?? stateRef.current;
    if (targetState.joystick) {
      targetState.joystick = { ...DEFAULT_JOYSTICK_STATE };
    }
    movementIntentRef.current = { ...DEFAULT_JOYSTICK_STATE };
  });
  const dispatchRef = useRef(dispatch);

  useEffect(() => {
    dispatchRef.current = dispatch;
  }, [dispatch]);

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

  const obstacleCountScaler = useCountScaler(densityScale);
  const nebulaCountScaler = useCountScaler(densityScale);
  const powerUpCountScaler = useCountScaler(densityScale);
  const organicMatterCountScaler = useCountScaler(densityScale);
  const enemyCountScaler = useCountScaler(densityScale);

  const { playSound } = useMemo(
    () => createSoundEffects(() => audioCtxRef.current),
    []
  );

  const powerUpTypes = useMemo(() => createPowerUpTypes(), []);
  const skills = useMemo(
    () => createSkills({
      playSound,
    }),
    [playSound]
  );

  const syncState = useCallback(() => {
    const state = stateRef.current;
    const organism = state.organism;
    const currentSkillKey = organism.skills[organism.currentSkillIndex];
    const currentSkillDef = currentSkillKey ? skills[currentSkillKey] : null;

    dispatchRef.current({
      type: 'SYNC_STATE',
      payload: {
        energy: state.energy,
        health: state.health,
        maxHealth: state.maxHealth,
        level: state.level,
        score: state.score,
        dashCharge: organism.dashCharge,
        canEvolve: state.canEvolve,
        showEvolutionChoice: state.showEvolutionChoice,
        showMenu: state.showMenu,
        gameOver: state.gameOver,
        combo: state.combo,
        maxCombo: state.maxCombo,
        activePowerUps: state.activePowerUps.map((p) => ({
          type: p.type,
          name: p.name,
          icon: p.icon,
          color: p.color,
          remaining: p.remaining,
          duration: p.duration,
        })),
        bossActive: Boolean(state.boss?.active),
        bossHealth: state.boss?.health || 0,
        bossMaxHealth: state.boss?.maxHealth || 0,
        currentSkill: currentSkillDef
          ? {
              key: currentSkillKey,
              name: currentSkillDef.name,
              icon: currentSkillDef.icon,
              cost: currentSkillDef.cost,
              cooldown: organism.skillCooldowns[currentSkillKey] || 0,
              maxCooldown: (currentSkillDef.cooldown || 0) / 1000,
            }
          : null,
        skillList: organism.skills.map((key) => ({
          key,
          icon: skills[key].icon,
          name: skills[key].name,
          cooldown: organism.skillCooldowns[key] || 0,
          maxCooldown: (skills[key].cooldown || 0) / 1000,
          isActive: key === currentSkillKey,
        })),
        hasMultipleSkills: organism.skills.length > 1,
        notifications: state.notifications.map((notification) => ({
          id: notification.id,
          text: notification.text,
        })),
        availableTraits: state.availableTraits || [],
        availableForms: state.availableForms || [],
        evolutionType: state.evolutionType || null,
        cameraZoom: state.camera?.zoom ?? 1,
      },
    });
  }, [skills]);

  const setCameraZoom = useCallback((zoomValue) => {
    const state = stateRef.current;
    if (!state?.camera) return;

    const minZoom = 0.6;
    const maxZoom = 1.2;
    const parsed = Number.parseFloat(zoomValue);
    const safeValue = Number.isFinite(parsed) ? parsed : 1;
    const clamped = Math.min(maxZoom, Math.max(minZoom, safeValue));

    if (Math.abs((state.camera.zoom ?? 1) - clamped) < 0.0001) {
      return;
    }

    state.camera.zoom = clamped;
    state.uiSyncTimer = 0;
  }, []);

  const resetControls = useCallback((state) => {
    inputResetRef.current(state);
  }, []);

  const spawnObstacle = useCallback(
    (state, count = 1) => {
      const targetState = state ?? stateRef.current;
      const spawnCount = obstacleCountScaler(count);
      let lastObstacle = null;

      for (let i = 0; i < spawnCount; i++) {
        const obstacle = createObstacleEntity({
          worldSize: targetState.worldSize,
          types: obstacleTypes,
          rng: Math.random,
        });

        if (obstacle) {
          targetState.obstacles.push(obstacle);
          lastObstacle = obstacle;
        }
      }

      return lastObstacle;
    },
    [obstacleCountScaler]
  );

  const spawnNebula = useCallback(
    (state, forcedType, count = 1) => {
      const targetState = state ?? stateRef.current;
      const spawnCount = nebulaCountScaler(count);
      let lastNebula = null;

      for (let i = 0; i < spawnCount; i++) {
        const nebula = createNebulaEntity({
          worldSize: targetState.worldSize,
          types: nebulaTypes,
          forcedType,
          rng: Math.random,
        });

        if (nebula) {
          targetState.nebulas.push(nebula);
          lastNebula = nebula;
        }
      }

      return lastNebula;
    },
    [nebulaCountScaler]
  );

  const spawnPowerUp = useCallback(
    (state, x, y, forcedType, count = 1) => {
      const targetState = state ?? stateRef.current;
      const hasPosition = typeof x === 'number' && typeof y === 'number';
      const spawnCount = powerUpCountScaler(count);
      let lastPowerUp = null;

      for (let i = 0; i < spawnCount; i++) {
        const powerUp = createPowerUpEntity({
          worldSize: targetState.worldSize,
          types: powerUpTypes,
          forcedType,
          rng: Math.random,
          position: hasPosition ? { x, y } : undefined,
        });

        if (powerUp) {
          targetState.powerUps.push(powerUp);
          lastPowerUp = powerUp;
        }
      }

      return lastPowerUp;
    },
    [powerUpCountScaler, powerUpTypes]
  );

  const dropPowerUps = useCallback((state, enemy) => {
    if (!enemy) return [];

    const drops = calculatePowerUpDrops(enemy, {
      types: powerUpTypes,
      rng: Math.random,
    });

    drops.forEach((powerUp) => {
      if (powerUp) {
        state.powerUps.push(powerUp);
      }
    });

    return drops;
  }, [powerUpTypes]);

  const createParticle = useCallback((state, x, y, color, size = 3) => {
    const particle = generateParticle(x, y, color, size);
    if (particle) {
      state.particles.push(particle);
    }
  }, []);

  const createEffect = useCallback((state, x, y, type, color) => {
    const effect = generateVisualEffect(x, y, type, color);
    if (effect) {
      state.effects.push(effect);
    }
  }, []);

  const addNotification = useCallback((state, text) => {
    state.notifications = appendNotification(state.notifications, text);
  }, []);

  const pickRandomUnique = useCallback((array, count) => {
    if (!array?.length || count <= 0) return [];
    const pool = [...array];
    const result = [];

    while (pool.length > 0 && result.length < count) {
      const index = Math.floor(Math.random() * pool.length);
      result.push(pool.splice(index, 1)[0]);
    }

    return result;
  }, []);

  const spawnOrganicMatter = useCallback(
    (state, count = 1) => {
      const targetState = state ?? stateRef.current;
      const spawnCount = organicMatterCountScaler(count);
      if (spawnCount <= 0) {
        return [];
      }

      const organicItems = createOrganicMatterEntities({
        count: spawnCount,
        worldSize: targetState.worldSize,
        types: organicMatterTypes,
        rng: Math.random,
      });

      organicItems.forEach((item) => {
        if (item) {
          targetState.organicMatter.push(item);
        }
      });

      return organicItems;
    },
    [organicMatterCountScaler]
  );

  const getAveragePlayerLevel = useCallback(() => {
    const storeState = gameStore.getState();
    const { players = {}, playerId = null } = storeState;
    const levels = [];

    Object.values(players).forEach((player) => {
      const level = typeof player.level === 'number' ? player.level : null;
      if (level !== null && Number.isFinite(level)) {
        levels.push(level);
      }
    });

    const localLevel = stateRef.current?.level;
    if (
      typeof localLevel === 'number' &&
      Number.isFinite(localLevel) &&
      (levels.length === 0 ||
        !playerId ||
        typeof players[playerId]?.level !== 'number' ||
        !Number.isFinite(players[playerId].level))
    ) {
      levels.push(localLevel);
    }

    if (levels.length === 0) {
      return 1;
    }

    const total = levels.reduce((sum, level) => sum + level, 0);
    return total / levels.length;
  }, []);

  const getSystemHelpers = useCallback(() => ({
    playSound,
    createEffect,
    createParticle,
    addNotification,
    dropPowerUps,
    syncState,
    skills,
    pickRandomUnique,
    forms,
    evolutionaryTraits,
    spawnObstacle,
    spawnNebula,
    spawnPowerUp,
    spawnOrganicMatter,
    resetControls,
    createInitialState,
    getAveragePlayerLevel,
  }), [
    playSound,
    createEffect,
    createParticle,
    addNotification,
    dropPowerUps,
    syncState,
    skills,
    pickRandomUnique,
    spawnObstacle,
    spawnNebula,
    spawnPowerUp,
    spawnOrganicMatter,
    resetControls,
    getAveragePlayerLevel,
  ]);

  const applyPowerUp = useCallback((typeKey) => {
    const state = stateRef.current;
    const type = powerUpTypes[typeKey];

    if (!type) return;

    if (type.instant) {
      type.apply?.(state);
      playSound(type.sound || 'powerup');
      state.uiSyncTimer = 0;
      syncState();
      return;
    }

    const existing = state.activePowerUps.find((p) => p.type === typeKey);

    if (existing) {
      existing.remaining = type.duration;
      existing.duration = type.duration;
    } else {
      state.activePowerUps.push({
        type: typeKey,
        name: type.name,
        icon: type.icon,
        color: type.color,
        remaining: type.duration,
        duration: type.duration,
      });
    }

    if (type.message) {
      addNotification(state, type.message);
    } else {
      addNotification(state, `✨ ${type.name}!`);
    }

    if (typeKey === 'invincibility') {
      state.organism.invulnerableFromPowerUp = true;
      state.organism.hasShieldPowerUp = true;
    }

    playSound(type.sound || 'powerup');
    state.uiSyncTimer = 0;
    syncState();
  }, [addNotification, playSound, powerUpTypes, syncState]);

  const performDash = useCallback(() => {
    const state = stateRef.current;
    performDashSystem(state, getSystemHelpers());
  }, [getSystemHelpers]);

  const spawnEnemy = useCallback(() => {
    const state = stateRef.current;
    const spawnCount = enemyCountScaler(1);
    let lastEnemy = null;

    for (let i = 0; i < spawnCount; i++) {
      const enemy = createEnemyEntity({
        level: state.level,
        organismPosition: { x: state.organism.x, y: state.organism.y },
        templates: enemyTemplates,
        rng: Math.random,
      });

      if (enemy) {
        state.enemies.push(enemy);
        lastEnemy = enemy;
      }
    }

    return lastEnemy;
  }, [enemyCountScaler]);

  const spawnBoss = useCallback(() => {
    const state = stateRef.current;
    if (state.boss?.active) return null;

    const result = createBossEntity({
      level: state.level,
      organismPosition: { x: state.organism.x, y: state.organism.y },
      rng: Math.random,
    });

    if (!result) return null;

    const { boss, bossState } = result;

    state.enemies.push(boss);
    state.boss = bossState;

    addNotification(state, '⚠️ Mega-organismo detectado!');
    playSound('boss');
    state.uiSyncTimer = 0;

    return boss;
  }, [addNotification, playSound]);

  const performAttack = useCallback(() => {
    const state = stateRef.current;
    performAttackSystem(state, getSystemHelpers());
  }, [getSystemHelpers]);

  const useSkill = useCallback(() => {
    const state = stateRef.current;
    useSkillSystem(state, getSystemHelpers());
  }, [getSystemHelpers]);

  const cycleSkill = useCallback((direction = 1) => {
    const state = stateRef.current;
    cycleSkillSystem(state, getSystemHelpers(), direction);
  }, [getSystemHelpers]);

  const checkEvolution = useCallback(() => {
    const state = stateRef.current;
    checkEvolutionSystem(state, getSystemHelpers());
  }, [getSystemHelpers]);

  const openEvolutionMenu = useCallback(() => {
    const state = stateRef.current;
    openEvolutionMenuSystem(state, getSystemHelpers());
  }, [getSystemHelpers]);

  const chooseTrait = useCallback((traitKey) => {
    const state = stateRef.current;
    chooseTraitSystem(state, getSystemHelpers(), traitKey);
  }, [getSystemHelpers]);

  const chooseForm = useCallback((formKey) => {
    const state = stateRef.current;
    chooseFormSystem(state, getSystemHelpers(), formKey);
  }, [getSystemHelpers]);

  const restartGame = useCallback(() => {
    const state = stateRef.current;
    restartGameSystem(state, getSystemHelpers());
  }, [getSystemHelpers]);

  const { joystick, actions: inputActions } = useInputController({
    onMovementIntent: (intent) => {
      movementIntentRef.current = intent;
    },
    onAttack: performAttack,
    onDash: performDash,
    onUseSkill: useSkill,
    onCycleSkill: cycleSkill,
    onOpenEvolutionMenu: openEvolutionMenu,
    onActionButtonChange: (isPressed) => {
      stateRef.current.actionButton = isPressed;
    },
  });

  const inputResetControls = inputActions.resetControls;

  useEffect(() => {
    inputResetRef.current = inputResetControls;
  }, [inputResetControls]);

  useEffect(() => {
    if (!resolvedSettings.audioEnabled) {
      if (audioCtxRef.current && typeof audioCtxRef.current.close === 'function') {
        audioCtxRef.current.close();
      }
      audioCtxRef.current = null;
      return;
    }

    const AudioContextCtor =
      typeof window !== 'undefined' &&
      (window.AudioContext || window.webkitAudioContext);

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

  useEffect(() => () => {
    if (audioCtxRef.current && typeof audioCtxRef.current.close === 'function') {
      audioCtxRef.current.close();
    }
  }, []);

  useEffect(() => {
    const state = stateRef.current;

    state.floatingParticles = [];
    state.glowParticles = [];
    state.microorganisms = [];
    state.lightRays = [];
    state.backgroundLayers = [];
    state.obstacles = state.obstacles || [];
    state.nebulas = state.nebulas || [];
    state.powerUps = state.powerUps || [];
    state.organicMatter = state.organicMatter || [];

    state.obstacles.length = 0;
    state.nebulas.length = 0;
    state.powerUps.length = 0;
    state.organicMatter.length = 0;

    const floatingCount = Math.max(150, Math.round(500 * densityScale));
    for (let i = 0; i < floatingCount; i++) {
      state.floatingParticles.push({
        x: Math.random() * 4000,
        y: Math.random() * 4000,
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
    for (let i = 0; i < glowCount; i++) {
      state.glowParticles.push({
        x: Math.random() * 4000,
        y: Math.random() * 4000,
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

    const microorganismCount = Math.max(30, Math.round(80 * densityScale));
    for (let i = 0; i < microorganismCount; i++) {
      state.microorganisms.push({
        x: Math.random() * 4000,
        y: Math.random() * 4000,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 6 + 3,
        opacity: Math.random() * 0.3 + 0.1,
        color: ['rgba(100, 200, 255, ', 'rgba(100, 255, 200, ', 'rgba(255, 200, 100, '][
          Math.floor(Math.random() * 3)
        ],
        animPhase: Math.random() * Math.PI * 2,
        depth: 0.3 + Math.random() * 0.4,
      });
    }

    const lightRayCount = Math.max(3, Math.round(5 * densityScale));
    for (let i = 0; i < lightRayCount; i++) {
      state.lightRays.push({
        x: Math.random() * 4000,
        y: -200,
        angle: (Math.random() - 0.5) * 0.3,
        width: Math.random() * 100 + 50,
        opacity: Math.random() * 0.1 + 0.05,
        length: 1000 + Math.random() * 500,
        speed: Math.random() * 0.1 + 0.05,
      });
    }

    for (let i = 0; i < 3; i++) {
      state.backgroundLayers.push({
        x: Math.random() * 4000,
        y: Math.random() * 4000,
        size: Math.random() * 300 + 200,
        opacity: Math.random() * 0.05 + 0.02,
        color: i === 0 ? '#0a3a4a' : i === 1 ? '#1a2a3a' : '#2a1a3a',
        depth: 0.2 + i * 0.15,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }

    for (let i = 0; i < 30; i++) {
      spawnObstacle(state);
    }

    for (let i = 0; i < 18; i++) {
      spawnNebula(state, i % 4 === 0 ? 'solid' : 'gas');
    }

    for (let i = 0; i < 4; i++) {
      spawnPowerUp(state);
    }

    spawnOrganicMatter(state, 25);
  }, [densityScale, spawnNebula, spawnObstacle, spawnOrganicMatter, spawnPowerUp]);

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

    let lastTime = Date.now();

    const animate = () => {
      const now = Date.now();
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      const state = stateRef.current;
      const dpr = window.devicePixelRatio || 1;
      const canvasWidth = canvas.clientWidth || canvas.width / dpr;
      const canvasHeight = canvas.clientHeight || canvas.height / dpr;
      const ctxWidth = canvasWidth;
      const ctxHeight = canvasHeight;

      const camera = state.camera;

      const moveIntent = movementIntentRef.current;

      updateGameState({
        state,
        delta,
        movementIntent: moveIntent,
        helpers: getSystemHelpers(),
        spawnEnemy,
        spawnBoss,
        spawnOrganicMatter,
        applyPowerUp,
      });

      ctx.clearRect(0, 0, ctxWidth, ctxHeight);

      const cameraOffsetX = camera.x - ctxWidth / 2;
      const cameraOffsetY = camera.y - ctxHeight / 2;

      camera.offsetX = cameraOffsetX;
      camera.offsetY = cameraOffsetY;
      camera.viewport = {
        width: ctxWidth,
        height: ctxHeight,
      };

      renderFrame(ctx, state, camera, {
        canvas,
        delta,
        viewport: {
          width: ctxWidth,
          height: ctxHeight,
        },
      });

      state.pulsePhase += 0.04;

      state.uiSyncTimer -= delta;
      if (state.uiSyncTimer <= 0) {
        syncState();
        state.uiSyncTimer = 0.2;
      }

      checkEvolution();

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', updateCanvasSize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [canvasRef, applyPowerUp, checkEvolution, createEffect, createParticle, dropPowerUps, getSystemHelpers, playSound, spawnBoss, spawnEnemy, spawnOrganicMatter, syncState]);

  return {
    joystick,
    inputActions,
    chooseTrait,
    chooseForm,
    restartGame,
    setCameraZoom,
  };
};

export default useGameLoop;
