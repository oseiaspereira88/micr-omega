import React, { useEffect, useMemo, useRef, useState } from 'react';

import { createInitialState } from './game/state/initialState';
import {
  forms,
  createSkills,
  evolutionaryTraits,
  organicMatterTypes,
  enemyTemplates,
  obstacleTypes,
  nebulaTypes,
  createPowerUpTypes,
} from './game/config';
import { spawnObstacle as createObstacleEntity } from './game/factories/obstacleFactory';
import { spawnNebula as createNebulaEntity } from './game/factories/nebulaFactory';
import {
  spawnPowerUp as createPowerUpEntity,
  dropPowerUps as calculatePowerUpDrops
} from './game/factories/powerUpFactory';
import { spawnOrganicMatter as createOrganicMatterEntities } from './game/factories/organicMatterFactory';
import { createSoundEffects } from './game/audio/soundEffects';
import { createParticle as generateParticle } from './game/effects/particles';
import { createVisualEffect as generateVisualEffect } from './game/effects/visualEffects';
import { addNotification as appendNotification } from './game/ui/notifications';
import {
  spawnEnemy as createEnemyEntity,
  spawnBoss as createBossEntity
} from './game/factories/enemyFactory';
import { renderFrame } from './game/render/renderFrame.js';
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
  runGameSystems
} from './game/systems';
import useInputController from './game/input/useInputController';
import { DEFAULT_JOYSTICK_STATE } from './game/input/utils';
import GameHud from './ui/components/GameHud';
import GameOverScreen from './ui/components/GameOverScreen';
import styles from './MicroOmegaGame.module.css';

const MicroOmegaGame = () => {
  const canvasRef = useRef(null);
  const audioCtxRef = useRef(null);
  const animationFrameRef = useRef(null);
  const { playSound } = useMemo(
    () => createSoundEffects(() => audioCtxRef.current),
    []
  );
  
  const [gameState, setGameState] = useState({
    energy: 0,
    health: 100,
    maxHealth: 100,
    level: 1,
    score: 0,
    dashCharge: 100,
    canEvolve: false,
    showEvolutionChoice: false,
    showMenu: false,
    gameOver: false,
    combo: 0,
    maxCombo: 0,
    activePowerUps: [],
    bossActive: false,
    bossHealth: 0,
    bossMaxHealth: 0,
    currentSkill: null,
    skillList: [],
    hasMultipleSkills: false,
    notifications: []
  });

  const stateRef = useRef(createInitialState());
  const movementIntentRef = useRef({ ...DEFAULT_JOYSTICK_STATE });
  const inputResetRef = useRef((state) => {
    const targetState = state ?? stateRef.current;
    if (targetState.joystick) {
      targetState.joystick = { ...DEFAULT_JOYSTICK_STATE };
    }
    movementIntentRef.current = { ...DEFAULT_JOYSTICK_STATE };
  });

  const resetControls = (state) => {
    inputResetRef.current(state);
  };

  const pickRandomUnique = (array, count) => {
    if (!array?.length || count <= 0) return [];
    const pool = [...array];
    const result = [];

    while (pool.length > 0 && result.length < count) {
      const index = Math.floor(Math.random() * pool.length);
      result.push(pool.splice(index, 1)[0]);
    }

    return result;
  };

  useEffect(() => {
    audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    
    const state = stateRef.current;
    
    // Partículas flutuantes massivas (500+)
    for (let i = 0; i < 500; i++) {
      state.floatingParticles.push({
        x: Math.random() * 4000,
        y: Math.random() * 4000,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        size: Math.random() * 3 + 0.5,
        opacity: Math.random() * 0.5 + 0.1,
        depth: Math.random(),
        hue: Math.random() * 60 + 180, // Azul-ciano
        pulsePhase: Math.random() * Math.PI * 2,
        pulseSpeed: 0.5 + Math.random() * 1.5
      });
    }
    
    // Partículas bioluminescentes
    for (let i = 0; i < 150; i++) {
      state.glowParticles.push({
        x: Math.random() * 4000,
        y: Math.random() * 4000,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        size: Math.random() * 4 + 2,
        opacity: Math.random() * 0.8 + 0.2,
        depth: Math.random(),
        color: ['rgba(0, 255, 200, ', 'rgba(100, 200, 255, ', 'rgba(200, 100, 255, '][Math.floor(Math.random() * 3)],
        pulsePhase: Math.random() * Math.PI * 2,
        glowIntensity: Math.random() * 20 + 10
      });
    }
    
    // Microorganismos de fundo
    for (let i = 0; i < 80; i++) {
      state.microorganisms.push({
        x: Math.random() * 4000,
        y: Math.random() * 4000,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 6 + 3,
        opacity: Math.random() * 0.3 + 0.1,
        color: ['rgba(100, 200, 255, ', 'rgba(100, 255, 200, ', 'rgba(255, 200, 100, '][Math.floor(Math.random() * 3)],
        animPhase: Math.random() * Math.PI * 2,
        depth: 0.3 + Math.random() * 0.4
      });
    }
    
    // Raios de luz
    for (let i = 0; i < 5; i++) {
      state.lightRays.push({
        x: Math.random() * 4000,
        y: -200,
        angle: (Math.random() - 0.5) * 0.3,
        width: Math.random() * 100 + 50,
        opacity: Math.random() * 0.1 + 0.05,
        length: 1000 + Math.random() * 500,
        speed: Math.random() * 0.1 + 0.05
      });
    }
    
    // Camadas de fundo
    for (let i = 0; i < 3; i++) {
      state.backgroundLayers.push({
        x: Math.random() * 4000,
        y: Math.random() * 4000,
        size: Math.random() * 300 + 200,
        opacity: Math.random() * 0.05 + 0.02,
        color: i === 0 ? '#0a3a4a' : i === 1 ? '#1a2a3a' : '#2a1a3a',
        depth: 0.2 + i * 0.15,
        pulsePhase: Math.random() * Math.PI * 2
      });
    }
    
    // Obstacles
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
      if (audioCtxRef.current) audioCtxRef.current.close();
    };
  }, []);

  const spawnObstacle = (state) => {
    const targetState = state ?? stateRef.current;
    const obstacle = createObstacleEntity({
      worldSize: targetState.worldSize,
      types: obstacleTypes,
      rng: Math.random
    });

    if (obstacle) {
      targetState.obstacles.push(obstacle);
    }

    return obstacle;
  };

  const spawnNebula = (state, forcedType) => {
    const targetState = state ?? stateRef.current;
    const nebula = createNebulaEntity({
      worldSize: targetState.worldSize,
      types: nebulaTypes,
      forcedType,
      rng: Math.random
    });

    if (nebula) {
      targetState.nebulas.push(nebula);
    }

    return nebula;
  };

  const spawnPowerUp = (state, x, y, forcedType) => {
    const targetState = state ?? stateRef.current;
    const hasPosition = typeof x === 'number' && typeof y === 'number';
    const powerUp = createPowerUpEntity({
      worldSize: targetState.worldSize,
      types: powerUpTypes,
      forcedType,
      rng: Math.random,
      position: hasPosition ? { x, y } : undefined
    });

    if (powerUp) {
      targetState.powerUps.push(powerUp);
    }

    return powerUp;
  };

  const dropPowerUps = (state, enemy) => {
    if (!enemy) return [];

    const drops = calculatePowerUpDrops(enemy, {
      types: powerUpTypes,
      rng: Math.random
    });

    drops.forEach((powerUp) => {
      if (powerUp) {
        state.powerUps.push(powerUp);
      }
    });

    return drops;
  };

  const applyPowerUp = (typeKey) => {
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

    const existing = state.activePowerUps.find(p => p.type === typeKey);

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
        duration: type.duration
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
  };

  const spawnOrganicMatter = (state, count) => {
    const targetState = state ?? stateRef.current;
    const organicItems = createOrganicMatterEntities({
      count,
      worldSize: targetState.worldSize,
      types: organicMatterTypes,
      rng: Math.random
    });

    organicItems.forEach((item) => {
      if (item) {
        targetState.organicMatter.push(item);
      }
    });

    return organicItems;
  };

  const createParticle = (state, x, y, color, size = 3) => {
    const particle = generateParticle(x, y, color, size);
    if (particle) {
      state.particles.push(particle);
    }
  };

  const createEffect = (state, x, y, type, color) => {
    const effect = generateVisualEffect(x, y, type, color);
    if (effect) {
      state.effects.push(effect);
    }
  };

  const addNotification = (state, text) => {
    state.notifications = appendNotification(state.notifications, text);
  };

  const powerUpTypes = createPowerUpTypes();
  const skills = createSkills({
    playSound
  });

  const getSystemHelpers = () => ({
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
    createInitialState
  });

  const performDash = () => {
    const state = stateRef.current;
    performDashSystem(state, getSystemHelpers());
  };

  const spawnEnemy = () => {
    const state = stateRef.current;
    const enemy = createEnemyEntity({
      level: state.level,
      organismPosition: { x: state.organism.x, y: state.organism.y },
      templates: enemyTemplates,
      rng: Math.random
    });

    if (enemy) {
      state.enemies.push(enemy);
    }

    return enemy;
  };

  const spawnBoss = () => {
    const state = stateRef.current;
    if (state.boss?.active) return null;

    const result = createBossEntity({
      level: state.level,
      organismPosition: { x: state.organism.x, y: state.organism.y },
      rng: Math.random
    });

    if (!result) return null;

    const { boss, bossState } = result;

    state.enemies.push(boss);
    state.boss = bossState;

    addNotification(state, '⚠️ Mega-organismo detectado!');
    playSound('boss');
    state.uiSyncTimer = 0;

    return boss;
  };


  const performAttack = () => {
    const state = stateRef.current;
    performAttackSystem(state, getSystemHelpers());
  };

  const useSkill = () => {
    const state = stateRef.current;
    useSkillSystem(state, getSystemHelpers());
  };

  const cycleSkill = (direction = 1) => {
    const state = stateRef.current;
    cycleSkillSystem(state, getSystemHelpers(), direction);
  };
  const checkEvolution = () => {
    const state = stateRef.current;
    checkEvolutionSystem(state, getSystemHelpers());
  };

  const openEvolutionMenu = () => {
    const state = stateRef.current;
    openEvolutionMenuSystem(state, getSystemHelpers());
  };

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
    }
  });

  const { resetControls: inputResetControls } = inputActions;

  useEffect(() => {
    inputResetRef.current = inputResetControls;
  }, [inputResetControls]);

  const chooseTrait = (traitKey) => {
    const state = stateRef.current;
    chooseTraitSystem(state, getSystemHelpers(), traitKey);
  };

  const chooseForm = (formKey) => {
    const state = stateRef.current;
    chooseFormSystem(state, getSystemHelpers(), formKey);
  };

  const restartGame = () => {
    const state = stateRef.current;
    restartGameSystem(state, getSystemHelpers());
  };

  const syncState = () => {
    const state = stateRef.current;
    const organism = state.organism;
    const currentSkillKey = organism.skills[organism.currentSkillIndex];
    const currentSkillDef = currentSkillKey ? skills[currentSkillKey] : null;

    setGameState(prev => ({
      ...prev,
      energy: state.energy,
      health: state.health,
      maxHealth: state.maxHealth,
      level: state.level,
      score: state.score,
      dashCharge: organism.dashCharge,
      canEvolve: state.canEvolve,
      showEvolutionChoice: state.showEvolutionChoice,
      showMenu: prev.showMenu,
      gameOver: state.gameOver,
      combo: state.combo,
      maxCombo: state.maxCombo,
      activePowerUps: state.activePowerUps.map(p => ({
        type: p.type,
        name: p.name,
        icon: p.icon,
        color: p.color,
        remaining: p.remaining,
        duration: p.duration
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
            maxCooldown: (currentSkillDef.cooldown || 0) / 1000
          }
        : null,
      skillList: organism.skills.map(key => ({
        key,
        icon: skills[key].icon,
        name: skills[key].name,
        cooldown: organism.skillCooldowns[key] || 0,
        maxCooldown: (skills[key].cooldown || 0) / 1000,
        isActive: key === currentSkillKey
      })),
      hasMultipleSkills: organism.skills.length > 1,
      notifications: state.notifications.map(notification => ({
        id: notification.id,
        text: notification.text
      }))
    }));
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

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
      state.joystick = { ...movementIntentRef.current };
      const org = state.organism;

      let offsetX = org.x - canvas.width / 2;
      let offsetY = org.y - canvas.height / 2;

      state.fogIntensity = Math.max(0, state.fogIntensity - delta * 0.6);
      state.gameTime += delta;

      if (state.powerUps.length < 5 && Math.random() < 0.01) {
        spawnPowerUp(state);
      }

      if (state.bossPending && !(state.boss?.active)) {
        spawnBoss();
        state.bossPending = false;
      }

      const camera = { offsetX, offsetY };

      const drawWorld = ({ state, camera, viewport }) => {
        const org = state.organism;
        const width = viewport.width;
        const height = viewport.height;
        const baseOffsetX = camera.offsetX;
        const baseOffsetY = camera.offsetY;

        state.nebulas.forEach(nebula => {
          nebula.rotation += nebula.swirlSpeed * delta;
          nebula.pulse += delta * 0.4;

          const screenX = nebula.x - baseOffsetX;
          const screenY = nebula.y - baseOffsetY;

          if (
            screenX > -nebula.radius - 200 && screenX < width + nebula.radius + 200 &&
            screenY > -nebula.radius - 200 && screenY < height + nebula.radius + 200
          ) {
            ctx.save();
            ctx.translate(screenX, screenY);
            ctx.rotate(nebula.rotation * (nebula.type === 'gas' ? 0.5 : 1));

            const gradient = ctx.createRadialGradient(0, 0, nebula.radius * 0.15, 0, 0, nebula.radius);
            gradient.addColorStop(0, nebula.innerColor);
            gradient.addColorStop(0.7, nebula.color);
            gradient.addColorStop(1, 'rgba(5, 10, 30, 0)');

            ctx.globalAlpha = nebula.opacity;
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(0, 0, nebula.radius, 0, Math.PI * 2);
            ctx.fill();

            nebula.layers.forEach(layer => {
              const layerRadius =
                nebula.radius * layer.scale * (1 + Math.sin(nebula.pulse + layer.offset) * 0.05);
              ctx.globalAlpha = layer.alpha;
              ctx.fillStyle = nebula.glow;
              ctx.beginPath();
              ctx.ellipse(0, 0, layerRadius, layerRadius * 0.7, layer.offset + nebula.rotation, 0, Math.PI * 2);
              ctx.fill();
            });

            ctx.restore();
            ctx.globalAlpha = 1;
          }

          const dx = org.x - nebula.x;
          const dy = org.y - nebula.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;

          if (nebula.type === 'solid') {
            if (dist < nebula.radius + org.size * 0.6) {
              const overlap = nebula.radius + org.size * 0.6 - dist;
              const nx = dx / dist;
              const ny = dy / dist;
              org.x += nx * overlap;
              org.y += ny * overlap;
              org.vx *= 0.4;
              org.vy *= 0.4;
            }
          } else {
            const fogFactor = 1 - Math.min(dist / (nebula.radius + org.size * 2), 1);
            if (fogFactor > 0) {
              state.fogIntensity = Math.min(
                0.85,
                Math.max(state.fogIntensity, fogFactor * nebula.opacity * 1.8)
              );
            }
          }
        });

        camera.offsetX = org.x - width / 2;
        camera.offsetY = org.y - height / 2;

        const offsetX = camera.offsetX;
        const offsetY = camera.offsetY;

        state.obstacles.forEach(obs => {
          obs.rotation += obs.rotationSpeed * delta;
          obs.pulsePhase += delta * 2;

          const screenX = obs.x - offsetX;
          const screenY = obs.y - offsetY;

          if (screenX > -200 && screenX < width + 200) {
            ctx.save();
            ctx.translate(screenX, screenY);
            ctx.rotate(obs.rotation);

            ctx.fillStyle = obs.color;
            ctx.globalAlpha = obs.type === 'membrane' ? 0.6 : 0.8;

            const pulse = Math.sin(obs.pulsePhase) * 0.1 + 1;

            ctx.beginPath();
            ctx.arc(0, 0, obs.size * pulse, 0, Math.PI * 2);
            ctx.fill();

            ctx.globalAlpha = 1;
            ctx.restore();
          }
        });

        runGameSystems(state, delta, getSystemHelpers());

        state.organicMatter = state.organicMatter.filter(matter => {
          matter.x += matter.vx;
          matter.y += matter.vy;
          matter.rotation += matter.rotationSpeed * delta;
          matter.pulsePhase += delta * 2;

          const dx = matter.x - org.x;
          const dy = matter.y - org.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < matter.size + org.size) {
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

        state.powerUps = state.powerUps.filter(power => {
          power.pulse += delta * 3;

          const dx = power.x - org.x;
          const dy = power.y - org.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < org.size + 24) {
            applyPowerUp(power.type);
            return false;
          }

          const screenX = power.x - offsetX;
          const screenY = power.y - offsetY;

          if (
            screenX > -120 && screenX < width + 120 &&
            screenY > -120 && screenY < height + 120
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

        if (state.gameTime - state.lastEventTime > state.eventInterval / 1000) {
          spawnEnemy();
          state.lastEventTime = state.gameTime;
        }

        const bossEnemy = state.enemies.find(e => e.boss);
        if (!bossEnemy && state.boss?.active) {
          addNotification(state, '✨ Mega-organismo neutralizado!');
          state.boss = null;
          state.bossPending = false;
          state.uiSyncTimer = Math.min(state.uiSyncTimer, 0.05);
        }

        state.projectiles = state.projectiles.filter(proj => {
          proj.x += proj.vx;
          proj.y += proj.vy;
          proj.life -= delta;

          if (proj.life <= 0) return false;

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
                  color: enemy.color
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
  }, []);

  const currentSkillInfo = gameState.currentSkill;
  const skillMaxCooldown = currentSkillInfo?.maxCooldown ?? 0;
  const skillCooldownRemaining = currentSkillInfo?.cooldown ?? 0;
  const skillReadyPercent = currentSkillInfo
    ? skillMaxCooldown > 0
      ? Math.max(0, Math.min(100, ((skillMaxCooldown - skillCooldownRemaining) / skillMaxCooldown) * 100))
      : 100
    : 0;
  const skillCoolingDown = Boolean(currentSkillInfo && skillCooldownRemaining > 0.05);
  const skillDisabled =
    !currentSkillInfo || skillCoolingDown || (currentSkillInfo ? gameState.energy < currentSkillInfo.cost : true);
  const skillCooldownLabel = currentSkillInfo
    ? skillCoolingDown
      ? `${skillCooldownRemaining.toFixed(1)}s`
      : 'Pronta'
    : 'Sem habilidade';
  const skillCooldownPercent = currentSkillInfo && skillMaxCooldown
    ? Math.max(0, Math.min(100, (skillCooldownRemaining / skillMaxCooldown) * 100))
    : 0;

  if (gameState.gameOver) {
    return (
      <GameOverScreen
        score={gameState.score}
        level={gameState.level}
        maxCombo={gameState.maxCombo}
        onRestart={restartGame}
      />
    );
  }

  const skillData = {
    currentSkill: currentSkillInfo,
    skillList: gameState.skillList,
    hasMultipleSkills: gameState.hasMultipleSkills,
    skillCooldownLabel,
    skillReadyPercent,
    skillCooldownPercent,
    skillCoolingDown,
    skillDisabled,
  };

  return (
    <div className={styles.container}>
      <canvas ref={canvasRef} className={styles.canvas} />

      <GameHud
        level={gameState.level}
        score={gameState.score}
        energy={gameState.energy}
        health={gameState.health}
        maxHealth={gameState.maxHealth}
        dashCharge={gameState.dashCharge}
        combo={gameState.combo}
        maxCombo={gameState.maxCombo}
        activePowerUps={gameState.activePowerUps}
        bossActive={gameState.bossActive}
        bossHealth={gameState.bossHealth}
        bossMaxHealth={gameState.bossMaxHealth}
        skillData={skillData}
        notifications={gameState.notifications}
        joystick={joystick}
        onJoystickStart={inputActions.joystickStart}
        onJoystickMove={inputActions.joystickMove}
        onJoystickEnd={inputActions.joystickEnd}
        onAttackPress={inputActions.attackPress}
        onAttackRelease={inputActions.attackRelease}
        onAttack={inputActions.attack}
        onDash={inputActions.dash}
        onUseSkill={inputActions.useSkill}
        onCycleSkill={inputActions.cycleSkill}
        onOpenEvolutionMenu={inputActions.openEvolutionMenu}
        canEvolve={gameState.canEvolve}
      />

      {gameState.showEvolutionChoice && (
        <div className={styles.evolutionOverlay}>
          <div className={styles.evolutionCard}>
            <h2 className={styles.evolutionTitle}>🧬 Evolução Nível {gameState.level}</h2>

            {stateRef.current.evolutionType === 'skill' ? (
              <>
                <h3 className={styles.optionHeading}>Escolha uma Habilidade:</h3>
                <div className={styles.optionList}>
                  {stateRef.current.availableTraits?.map(traitKey => {
                    const trait = evolutionaryTraits[traitKey];
                    return (
                      <div
                        key={traitKey}
                        className={styles.traitCard}
                        style={{
                          background: `linear-gradient(90deg, ${trait.color}33, ${trait.color}11)`,
                          border: `2px solid ${trait.color}`,
                        }}
                        onClick={() => chooseTrait(traitKey)}
                      >
                        <div className={styles.traitTitle} style={{ color: trait.color }}>
                          {trait.icon} {trait.name}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <h3 className={styles.optionHeading}>Escolha uma Forma:</h3>
                <div className={styles.optionList}>
                  {stateRef.current.availableForms?.map(formKey => {
                    const form = forms[formKey];
                    return (
                      <div
                        key={formKey}
                        className={styles.formCard}
                        onClick={() => chooseForm(formKey)}
                      >
                        <div className={styles.formTitle}>
                          {form.icon} {form.name}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MicroOmegaGame;
