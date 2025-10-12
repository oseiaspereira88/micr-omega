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

const useGameLoop = ({ canvasRef, dispatch }) => {
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
      },
    });
  }, [skills]);

  const resetControls = useCallback((state) => {
    inputResetRef.current(state);
  }, []);

  const spawnObstacle = useCallback(
    (state) => {
      const targetState = state ?? stateRef.current;
      const obstacle = createObstacleEntity({
        worldSize: targetState.worldSize,
        types: obstacleTypes,
        rng: Math.random,
      });

      if (obstacle) {
        targetState.obstacles.push(obstacle);
      }

      return obstacle;
    },
    []
  );

  const spawnNebula = useCallback(
    (state, forcedType) => {
      const targetState = state ?? stateRef.current;
      const nebula = createNebulaEntity({
        worldSize: targetState.worldSize,
        types: nebulaTypes,
        forcedType,
        rng: Math.random,
      });

      if (nebula) {
        targetState.nebulas.push(nebula);
      }

      return nebula;
    },
    []
  );

  const spawnPowerUp = useCallback(
    (state, x, y, forcedType) => {
      const targetState = state ?? stateRef.current;
      const hasPosition = typeof x === 'number' && typeof y === 'number';
      const powerUp = createPowerUpEntity({
        worldSize: targetState.worldSize,
        types: powerUpTypes,
        forcedType,
        rng: Math.random,
        position: hasPosition ? { x, y } : undefined,
      });

      if (powerUp) {
        targetState.powerUps.push(powerUp);
      }

      return powerUp;
    },
    [powerUpTypes]
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
    (state, count) => {
      const targetState = state ?? stateRef.current;
      const organicItems = createOrganicMatterEntities({
        count,
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
    []
  );

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
    const enemy = createEnemyEntity({
      level: state.level,
      organismPosition: { x: state.organism.x, y: state.organism.y },
      templates: enemyTemplates,
      rng: Math.random,
    });

    if (enemy) {
      state.enemies.push(enemy);
    }

    return enemy;
  }, []);

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
    const AudioContextCtor =
      typeof window !== 'undefined' &&
      (window.AudioContext || window.webkitAudioContext);

    if (audioCtxRef.current) {
      return undefined;
    }

    if (!AudioContextCtor) {
      audioCtxRef.current = null;
      if (!audioWarningLoggedRef.current) {
        console.warn('Web Audio API unavailable; game audio disabled.');
        audioWarningLoggedRef.current = true;
      }
    } else {
      try {
        audioCtxRef.current = new AudioContextCtor();
      } catch (error) {
        audioCtxRef.current = null;
        if (!audioWarningLoggedRef.current) {
          console.warn('Failed to initialize Web Audio API; game audio disabled.', error);
          audioWarningLoggedRef.current = true;
        }
      }
    }

    const state = stateRef.current;

    for (let i = 0; i < 500; i++) {
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

    for (let i = 0; i < 150; i++) {
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

    for (let i = 0; i < 80; i++) {
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

    for (let i = 0; i < 5; i++) {
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

    return () => {
      if (audioCtxRef.current && typeof audioCtxRef.current.close === 'function') {
        audioCtxRef.current.close();
      }
    };
  }, [spawnNebula, spawnObstacle, spawnOrganicMatter, spawnPowerUp]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext('2d');

    const updateCanvasSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight - 40;
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);

    let lastTime = Date.now();

    const animate = () => {
      const now = Date.now();
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      const state = stateRef.current;
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const ctxWidth = canvasWidth;
      const ctxHeight = canvasHeight;

      const camera = state.camera;
      const organism = state.organism;

      const moveIntent = movementIntentRef.current;
      state.joystick = moveIntent;

      if (!state.gameOver) {
        const speed = organism.speed * delta;
        if (moveIntent.x || moveIntent.y) {
          const length = Math.sqrt(moveIntent.x * moveIntent.x + moveIntent.y * moveIntent.y);
          const normX = moveIntent.x / (length || 1);
          const normY = moveIntent.y / (length || 1);

          organism.vx += normX * speed * 0.6;
          organism.vy += normY * speed * 0.6;

          organism.rotation = Math.atan2(normY, normX);
        } else {
          organism.vx *= 0.94;
          organism.vy *= 0.94;
        }

        organism.x += organism.vx;
        organism.y += organism.vy;

        organism.x = Math.max(organism.size, Math.min(state.worldSize - organism.size, organism.x));
        organism.y = Math.max(organism.size, Math.min(state.worldSize - organism.size, organism.y));

        camera.x += ((organism.x - camera.x) * 0.08) * delta * 60;
        camera.y += ((organism.y - camera.y) * 0.08) * delta * 60;

        state.gameTime += delta;

        if (state.gameTime - state.lastSpawnTime > state.spawnInterval / 1000) {
          spawnEnemy();
          state.lastSpawnTime = state.gameTime;
          state.spawnInterval = Math.max(800, state.spawnInterval - 20);

          if (state.level % 5 === 0 && !state.bossPending) {
            state.bossPending = true;
            spawnBoss();
          }
        }

        state.effects = state.effects.filter((effect) => {
          effect.life -= delta;
          return effect.life > 0;
        });
      }

      ctx.clearRect(0, 0, ctxWidth, ctxHeight);

      const cameraOffsetX = camera.x - ctxWidth / 2;
      const cameraOffsetY = camera.y - ctxHeight / 2;

      camera.offsetX = cameraOffsetX;
      camera.offsetY = cameraOffsetY;
      camera.viewport = {
        width: ctxWidth,
        height: ctxHeight,
      };

      const drawWorld = () => {
        const width = ctxWidth;
        const height = ctxHeight;
        const offsetX = cameraOffsetX;
        const offsetY = cameraOffsetY;
        const state = stateRef.current;
        const ctx = canvas.getContext('2d');

        const pulse = Math.sin(state.pulsePhase) * 0.05 + 1;

        state.backgroundLayers.forEach((layer) => {
          const screenX = (layer.x - offsetX * layer.depth) % (state.worldSize + layer.size) - layer.size;
          const screenY = (layer.y - offsetY * layer.depth) % (state.worldSize + layer.size) - layer.size;

          ctx.save();
          ctx.translate(screenX, screenY);
          ctx.globalAlpha = layer.opacity;
          ctx.fillStyle = layer.color;
          ctx.beginPath();
          ctx.arc(0, 0, layer.size * pulse, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });

        state.floatingParticles.forEach((particle) => {
          particle.x += particle.vx;
          particle.y += particle.vy;

          if (particle.x < 0) particle.x += state.worldSize;
          if (particle.x > state.worldSize) particle.x -= state.worldSize;
          if (particle.y < 0) particle.y += state.worldSize;
          if (particle.y > state.worldSize) particle.y -= state.worldSize;

          const screenX = particle.x - offsetX * particle.depth;
          const screenY = particle.y - offsetY * particle.depth;

          if (screenX > -50 && screenX < width + 50 && screenY > -50 && screenY < height + 50) {
            const hueVariation = Math.sin(state.gameTime * 0.2 + particle.pulsePhase) * 20;
            const hue = (particle.hue + hueVariation) % 360;
            ctx.fillStyle = `hsla(${hue}, 70%, 50%, ${particle.opacity})`;
            ctx.beginPath();
            ctx.arc(screenX, screenY, particle.size, 0, Math.PI * 2);
            ctx.fill();
          }
        });

        state.glowParticles.forEach((particle) => {
          particle.x += particle.vx;
          particle.y += particle.vy;

          if (particle.x < 0) particle.x += state.worldSize;
          if (particle.x > state.worldSize) particle.x -= state.worldSize;
          if (particle.y < 0) particle.y += state.worldSize;
          if (particle.y > state.worldSize) particle.y -= state.worldSize;

          const screenX = particle.x - offsetX * particle.depth;
          const screenY = particle.y - offsetY * particle.depth;

          if (screenX > -100 && screenX < width + 100 && screenY > -100 && screenY < height + 100) {
            ctx.save();
            ctx.translate(screenX, screenY);
            const pulse = Math.sin(particle.pulsePhase) * 0.2 + 1;
            ctx.fillStyle = `${particle.color}${0.6 * pulse})`;
            ctx.shadowBlur = 30 * particle.glowIntensity;
            ctx.shadowColor = `${particle.color}1)`;
            ctx.beginPath();
            ctx.arc(0, 0, particle.size * pulse, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.restore();
          }

          particle.pulsePhase += particle.glowIntensity * delta * 0.02;
        });

        state.lightRays.forEach((ray) => {
          ray.y += ray.speed;
          if (ray.y > state.worldSize + 200) ray.y = -200;

          const screenX = ray.x - offsetX * 0.4;
          const screenY = ray.y - offsetY * 0.3;

          ctx.save();
          ctx.translate(screenX, screenY);
          ctx.rotate(ray.angle);
          ctx.globalAlpha = ray.opacity;
          const gradient = ctx.createLinearGradient(0, 0, ray.width, ray.length);
          gradient.addColorStop(0, 'rgba(0, 200, 255, 0)');
          gradient.addColorStop(0.5, 'rgba(0, 200, 255, 0.1)');
          gradient.addColorStop(1, 'rgba(0, 200, 255, 0)');
          ctx.fillStyle = gradient;
          ctx.fillRect(-ray.width / 2, 0, ray.width, ray.length);
          ctx.restore();
        });

        state.microorganisms.forEach((micro) => {
          micro.x += micro.vx;
          micro.y += micro.vy;

          if (micro.x < 0) micro.x += state.worldSize;
          if (micro.x > state.worldSize) micro.x -= state.worldSize;
          if (micro.y < 0) micro.y += state.worldSize;
          if (micro.y > state.worldSize) micro.y -= state.worldSize;

          const screenX = micro.x - offsetX * micro.depth;
          const screenY = micro.y - offsetY * micro.depth;

          if (screenX > -100 && screenX < width + 100 && screenY > -100 && screenY < height + 100) {
            ctx.save();
            ctx.translate(screenX, screenY);
            ctx.rotate(Math.sin(state.gameTime * micro.depth + micro.animPhase) * 0.2);
            ctx.globalAlpha = micro.opacity;
            ctx.fillStyle = `${micro.color}0.2)`;
            ctx.beginPath();
            ctx.ellipse(0, 0, micro.size * 2, micro.size, Math.PI / 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = micro.opacity * 0.5;
            ctx.fillStyle = `${micro.color}0.6)`;
            ctx.beginPath();
            ctx.arc(0, 0, micro.size * 0.6, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        });

        state.nebulas = state.nebulas.filter((nebula) => {
          const nebulaColorBase =
            nebula.color ?? nebulaTypes[nebula.type]?.color ?? 'rgba(20, 56, 81, ';
          const nebulaEffectColor =
            nebula.glow ?? nebulaTypes[nebula.type]?.glow ?? `${nebulaColorBase}0.6)`;
          const dx = nebula.x - organism.x;
          const dy = nebula.y - organism.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < nebula.radius + organism.size && !nebula.dispelled) {
            nebula.dispelled = true;
            nebula.dispelProgress = 0;
            nebula.rotationSpeed *= 3;
            nebula.turbulence *= 2;
            addNotification(state, '🌫️ Nebulosa bioenergética dispersa!');
            createEffect(state, nebula.x, nebula.y, 'nebula', nebulaEffectColor);
            state.uiSyncTimer = Math.min(state.uiSyncTimer, 0.05);
          }

          const screenX = nebula.x - offsetX;
          const screenY = nebula.y - offsetY;

          if (screenX < -nebula.radius * 2 || screenX > width + nebula.radius * 2) return true;
          if (screenY < -nebula.radius * 2 || screenY > height + nebula.radius * 2) return true;

          nebula.rotation += nebula.rotationSpeed * delta;
          nebula.pulsePhase += delta;

          ctx.save();
          ctx.translate(screenX, screenY);
          ctx.rotate(nebula.rotation);

          const gradient = ctx.createRadialGradient(0, 0, nebula.radius * 0.2, 0, 0, nebula.radius);
          gradient.addColorStop(0, `${nebulaColorBase}0.3)`);
          gradient.addColorStop(0.7, `${nebulaColorBase}0.15)`);
          gradient.addColorStop(1, 'rgba(10, 30, 60, 0)');
          ctx.fillStyle = gradient;
          ctx.globalAlpha = nebula.dispelled
            ? Math.max(0, 1 - nebula.dispelProgress)
            : 1;

          const layers = 8;
          for (let i = 0; i < layers; i++) {
            const turbulence = Math.sin(nebula.pulsePhase * nebula.turbulence + i) * nebula.turbulence * 10;
            const radius = nebula.radius * (0.6 + i * 0.05 + turbulence * 0.002);
            ctx.beginPath();
            ctx.ellipse(0, 0, radius, radius * 0.8, (i / layers) * Math.PI, 0, Math.PI * 2);
            ctx.fill();
          }

          if (nebula.dispelled) {
            nebula.dispelProgress += delta * 0.5;
            if (nebula.dispelProgress >= 1) return false;
          }

          ctx.restore();
          return true;
        });

        state.obstacles = state.obstacles.filter((obs) => {
          obs.x += obs.vx;
          obs.y += obs.vy;
          obs.rotation += obs.rotationSpeed * delta;

          if (obs.x < -200 || obs.x > state.worldSize + 200) return false;
          if (obs.y < -200 || obs.y > state.worldSize + 200) return false;

          const screenX = obs.x - offsetX;
          const screenY = obs.y - offsetY;

          if (
            screenX < -obs.size * 2 ||
            screenX > width + obs.size * 2 ||
            screenY < -obs.size * 2 ||
            screenY > height + obs.size * 2
          ) {
            return true;
          }

          const dx = obs.x - organism.x;
          const dy = obs.y - organism.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < obs.size + organism.size) {
            organism.vx -= (dx / dist) * 10;
            organism.vy -= (dy / dist) * 10;
            createEffect(state, obs.x, obs.y, 'impact', obs.color);
            obs.color = obs.hitColor;
            obs.hitPulse = 1;
            obs.rotationSpeed *= -1;
            playSound('impact');
          }

          ctx.save();
          ctx.translate(screenX, screenY);
          ctx.rotate(obs.rotation);

          const gradient = ctx.createLinearGradient(-obs.size, -obs.size, obs.size, obs.size);
          gradient.addColorStop(0, obs.color);
          gradient.addColorStop(0.5, obs.coreColor);
          gradient.addColorStop(1, obs.color);
          ctx.fillStyle = gradient;
          ctx.globalAlpha = obs.opacity;

          const pulse = Math.sin(state.gameTime * obs.pulseSpeed) * 0.2 + 1;
          ctx.beginPath();
          ctx.moveTo(0, -obs.size * pulse);
          ctx.lineTo(obs.size * 0.8 * pulse, 0);
          ctx.lineTo(0, obs.size * pulse);
          ctx.lineTo(-obs.size * 0.8 * pulse, 0);
          ctx.closePath();
          ctx.fill();

          ctx.beginPath();
          ctx.arc(0, 0, obs.size * 0.4 * pulse, 0, Math.PI * 2);
          ctx.fillStyle = obs.coreColor;
          ctx.fill();

          if (obs.hitPulse > 0) {
            ctx.beginPath();
            ctx.arc(0, 0, obs.size * 0.6 * obs.hitPulse, 0, Math.PI * 2);
            ctx.strokeStyle = obs.hitColor;
            ctx.lineWidth = 3;
            ctx.globalAlpha = obs.hitPulse;
            ctx.stroke();
            obs.hitPulse *= 0.85;
          }

          ctx.globalAlpha = 1;
          ctx.restore();

          return true;
        });

        state.powerUps = state.powerUps.filter((power) => {
          power.pulse += delta * 3;

          const dx = power.x - organism.x;
          const dy = power.y - organism.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < organism.size + 24) {
            applyPowerUp(power.type);
            return false;
          }

          const screenX = power.x - offsetX;
          const screenY = power.y - offsetY;

          if (
            screenX > -120 &&
            screenX < width + 120 &&
            screenY > -120 &&
            screenY < height + 120
          ) {
            ctx.save();
            ctx.translate(screenX, screenY);
            const glow = Math.sin(power.pulse) * 0.25 + 0.75;
            ctx.fillStyle = power.color;
            ctx.globalAlpha = 0.8;
            ctx.shadowBlur = 20;
            ctx.shadowColor = power.color;
            ctx.beginPath();
            ctx.arc(0, 0, 18 + Math.sin(power.pulse * 0.5) * 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 16px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(power.icon, 0, 6);
            ctx.restore();
          }

          return true;
        });

        state.organicMatter = state.organicMatter.filter((matter) => {
          matter.x += matter.vx;
          matter.y += matter.vy;
          matter.rotation += matter.rotationSpeed * delta;
          matter.pulsePhase += delta * 2;

          const dx = matter.x - organism.x;
          const dy = matter.y - organism.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < matter.size + organism.size) {
            state.energy += matter.energy;
            state.health = Math.min(state.maxHealth, state.health + matter.health);
            state.score += matter.energy;
            playSound('collect');
            addNotification(state, `+${matter.energy} ⚡`);
            for (let i = 0; i < 5; i++) {
              createParticle(state, matter.x, matter.y, matter.color, 3);
            }
            return false;
          }

          const screenX = matter.x - offsetX;
          const screenY = matter.y - offsetY;

          if (screenX > -100 && screenX < width + 100) {
            ctx.save();
            ctx.translate(screenX, screenY);
            ctx.rotate(matter.rotation);

            const pulse = Math.sin(matter.pulsePhase) * 0.1 + 1;

            ctx.shadowBlur = 20 * matter.glowIntensity;
            ctx.shadowColor = matter.color;
            ctx.fillStyle = matter.color;
            ctx.globalAlpha = 0.85;

            ctx.beginPath();
            ctx.arc(0, 0, matter.size * pulse, 0, Math.PI * 2);
            ctx.fill();

            ctx.globalAlpha = 1;
            ctx.shadowBlur = 0;
            ctx.restore();
          }

          return true;
        });

        if (state.organicMatter.length < 30 && Math.random() < 0.05) {
          spawnOrganicMatter(state, 1);
        }

        state.effects.forEach((effect) => {
          effect.life -= delta;
          if (effect.life <= 0) {
            return;
          }

          const screenX = effect.x - offsetX;
          const screenY = effect.y - offsetY;

          ctx.save();
          ctx.translate(screenX, screenY);

          if (effect.type === 'dash') {
            ctx.globalAlpha = effect.life;
            ctx.strokeStyle = effect.color;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(0, 0, effect.radius * (1 - effect.life), 0, Math.PI * 2);
            ctx.stroke();
          } else if (effect.type === 'hit') {
            ctx.globalAlpha = effect.life * 0.8;
            ctx.fillStyle = effect.color;
            ctx.beginPath();
            ctx.arc(0, 0, 10 * (1 - effect.life), 0, Math.PI * 2);
            ctx.fill();
          } else if (effect.type === 'nebula') {
            ctx.globalAlpha = effect.life * 0.6;
            ctx.fillStyle = effect.color;
            ctx.beginPath();
            ctx.arc(0, 0, effect.radius * (1 - effect.life * 0.3), 0, Math.PI * 2);
            ctx.fill();
          } else if (effect.type === 'impact') {
            ctx.globalAlpha = effect.life;
            ctx.strokeStyle = effect.color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, effect.radius * (1 - effect.life), 0, Math.PI * 2);
            ctx.stroke();
          }

          ctx.restore();
        });

        state.enemies = state.enemies.filter((enemy) => {
          if (!enemy.boss) {
            enemy.behaviorTimer += delta;

            if (enemy.behaviorTimer > enemy.behaviorInterval) {
              enemy.behaviorTimer = 0;
              enemy.behaviorInterval = Math.random() * 2 + 0.5;

              const angle = Math.atan2(organism.y - enemy.y, organism.x - enemy.x);
              const speed = enemy.speed * (0.8 + Math.random() * 0.4);
              enemy.vx = Math.cos(angle) * speed;
              enemy.vy = Math.sin(angle) * speed;
            }

            enemy.x += enemy.vx * delta * 60;
            enemy.y += enemy.vy * delta * 60;
          } else {
            enemy.attackTimer += delta;
            enemy.phaseTimer += delta;

            if (enemy.phase === 'charge' && enemy.attackTimer > enemy.attackCooldown) {
              enemy.phase = 'dash';
              enemy.attackTimer = 0;
              const angle = Math.atan2(organism.y - enemy.y, organism.x - enemy.x);
              enemy.vx = Math.cos(angle) * enemy.dashSpeed;
              enemy.vy = Math.sin(angle) * enemy.dashSpeed;
              createEffect(state, enemy.x, enemy.y, 'dash', enemy.color);
              playSound('dash');
            }

            if (enemy.phase === 'dash') {
              enemy.x += enemy.vx * delta * 60;
              enemy.y += enemy.vy * delta * 60;
              enemy.dashDuration -= delta;
              if (enemy.dashDuration <= 0) {
                enemy.phase = 'charge';
                enemy.dashDuration = enemy.dashDurationMax;
                enemy.vx *= 0.2;
                enemy.vy *= 0.2;
              }
            } else {
              const angle = Math.atan2(organism.y - enemy.y, organism.x - enemy.x);
              const speed = enemy.speed * (0.6 + Math.random() * 0.4);
              enemy.vx = Math.cos(angle) * speed;
              enemy.vy = Math.sin(angle) * speed;
              enemy.x += enemy.vx * delta * 60;
              enemy.y += enemy.vy * delta * 60;
            }
          }

          enemy.x = Math.max(0, Math.min(state.worldSize, enemy.x));
          enemy.y = Math.max(0, Math.min(state.worldSize, enemy.y));

          const dx = enemy.x - organism.x;
          const dy = enemy.y - organism.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < enemy.size + organism.size) {
            if (!organism.invulnerable && !organism.invulnerableFromPowerUp) {
              state.health -= enemy.damage;
              organism.invulnerable = true;
              organism.invulnerableTimer = 1.5;
              createEffect(state, organism.x, organism.y, 'impact', enemy.color);
              playSound('hit');
              state.uiSyncTimer = Math.min(state.uiSyncTimer, 0.05);

              if (state.health <= 0) {
                state.gameOver = true;
                state.showEvolutionChoice = false;
              }
            }
            enemy.vx *= -0.5;
            enemy.vy *= -0.5;
          }

          const screenX = enemy.x - offsetX;
          const screenY = enemy.y - offsetY;

          if (
            screenX < -enemy.size - 50 ||
            screenX > width + enemy.size + 50 ||
            screenY < -enemy.size - 50 ||
            screenY > height + enemy.size + 50
          ) {
            return true;
          }

          ctx.save();
          ctx.translate(screenX, screenY);
          ctx.rotate(enemy.rotation);
          ctx.globalAlpha = enemy.opacity;

          const gradient = ctx.createRadialGradient(0, 0, enemy.size * 0.3, 0, 0, enemy.size);
          gradient.addColorStop(0, `${enemy.coreColor}1)`);
          gradient.addColorStop(0.5, `${enemy.color}0.8)`);
          gradient.addColorStop(1, `${enemy.color}0.2)`);
          ctx.fillStyle = gradient;

          ctx.beginPath();
          ctx.arc(0, 0, enemy.size, 0, Math.PI * 2);
          ctx.fill();

          ctx.globalAlpha = 1;
          ctx.shadowBlur = 20;
          ctx.shadowColor = `${enemy.coreColor}0.8)`;
          ctx.strokeStyle = `${enemy.color}0.6)`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, enemy.size * (1 + Math.sin(state.gameTime * enemy.pulseSpeed) * 0.1), 0, Math.PI * 2);
          ctx.stroke();
          ctx.shadowBlur = 0;

          ctx.restore();

          if (enemy.health <= 0) {
            state.combo += 1;
            state.maxCombo = Math.max(state.maxCombo, state.combo);
            state.energy += enemy.energyReward;
            state.score += enemy.points;
            createEffect(state, enemy.x, enemy.y, 'hit', enemy.color);
            playSound('enemyDie');
            dropPowerUps(state, enemy);
            state.uiSyncTimer = Math.min(state.uiSyncTimer, 0.05);

            if (enemy.boss) {
              state.boss = null;
              state.bossPending = false;
              addNotification(state, '✨ Mega-organismo neutralizado!');
            }

            return false;
          }

          return true;
        });

        if (state.enemies.length < 10 && Math.random() < 0.005) {
          spawnEnemy();
        }

        state.projectiles = state.projectiles.filter((proj) => {
          proj.x += proj.vx;
          proj.y += proj.vy;
          proj.life -= delta;

          if (proj.life <= 0) return false;

          if (
            proj.x < camera.x - width / 2 - 50 ||
            proj.x > camera.x + width / 2 + 50 ||
            proj.y < camera.y - height / 2 - 50 ||
            proj.y > camera.y + height / 2 + 50
          ) {
            return true;
          }

          for (let i = 0; i < state.enemies.length; i++) {
            const enemy = state.enemies[i];
            const dx = proj.x - enemy.x;
            const dy = proj.y - enemy.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < enemy.size) {
              enemy.health -= proj.damage;
              createEffect(state, enemy.x, enemy.y, 'hit', proj.color);

              if (enemy.health <= 0) {
                state.energy += 25;
                state.score += enemy.points;
                dropPowerUps(state, enemy);
                if (enemy.boss) {
                  state.boss = null;
                  state.bossPending = false;
                  addNotification(state, '✨ Mega-organismo neutralizado!');
                }
                state.uiSyncTimer = Math.min(state.uiSyncTimer, 0.05);
              } else if (enemy.boss) {
                state.boss = {
                  active: true,
                  health: enemy.health,
                  maxHealth: enemy.maxHealth,
                  color: enemy.color,
                };
                state.uiSyncTimer = Math.min(state.uiSyncTimer, 0.05);
              }

              return false;
            }
          }

          const screenX = proj.x - offsetX;
          const screenY = proj.y - offsetY;

          ctx.fillStyle = proj.color;
          ctx.shadowBlur = 15;
          ctx.shadowColor = proj.color;
          ctx.beginPath();
          ctx.arc(screenX, screenY, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;

          return true;
        });
      };

      renderFrame(ctx, state, camera, {
        canvas,
        delta,
        drawWorld,
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
  };
};

export default useGameLoop;
