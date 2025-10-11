import React, { useEffect, useRef, useState } from 'react';

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

const MicroOmegaGame = () => {
  const canvasRef = useRef(null);
  const audioCtxRef = useRef(null);
  const animationFrameRef = useRef(null);
  
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
    hasMultipleSkills: false
  });

  const [joystickActive, setJoystickActive] = useState(false);
  const [joystickPosition, setJoystickPosition] = useState({ x: 0, y: 0 });

  const stateRef = useRef(createInitialState());

  const keyboardStateRef = useRef({ up: false, down: false, left: false, right: false });

  const resetControls = (state) => {
    keyboardStateRef.current = { up: false, down: false, left: false, right: false };

    const targetState = state ?? stateRef.current;
    if (targetState.joystick) {
      targetState.joystick = { x: 0, y: 0, active: false, source: 'none' };
    }

    setJoystickActive(false);
    setJoystickPosition({ x: 0, y: 0 });
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

  const playSound = (type) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    switch(type) {
      case 'attack':
        osc.type = 'triangle';
        osc.frequency.value = 480;
        break;
      case 'collect':
        osc.type = 'sine';
        osc.frequency.value = 720;
        break;
      case 'damage':
        osc.type = 'sawtooth';
        osc.frequency.value = 160;
        break;
      case 'dash':
        osc.type = 'square';
        osc.frequency.value = 1280;
        break;
      case 'powerup':
        osc.type = 'sine';
        osc.frequency.value = 950;
        break;
      case 'skill':
        osc.type = 'triangle';
        osc.frequency.value = 880;
        break;
      case 'shoot':
        osc.type = 'square';
        osc.frequency.value = 1020;
        break;
      case 'buff':
        osc.type = 'sine';
        osc.frequency.value = 620;
        break;
      case 'drain':
        osc.type = 'triangle';
        osc.frequency.value = 360;
        break;
      case 'combo':
        osc.type = 'square';
        osc.frequency.value = 680;
        break;
      case 'boss':
        osc.type = 'sawtooth';
        osc.frequency.value = 260;
        break;
      default:
        osc.frequency.value = 440;
    }

    gain.gain.setValueAtTime(type === 'boss' ? 0.2 : 0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (type === 'boss' ? 0.6 : 0.3));

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  };

  const createParticle = (state, x, y, color, size = 3) => {
    state.particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 5,
      vy: (Math.random() - 0.5) * 5,
      life: 1,
      color,
      size: Math.random() * size + 2
    });
  };

  const effectConfigs = {
    shockwave: { style: 'ring', growth: 260, decay: 1.6, maxSize: 220, lineWidth: 4 },
    hit: { style: 'filled', growth: 220, decay: 4.4, maxSize: 60 },
    attack: { style: 'ring', growth: 240, decay: 2.4, maxSize: 150, lineWidth: 2 },
    shield: { style: 'double-ring', growth: 160, decay: 1.4, maxSize: 160, lineWidth: 3 },
    pulse: { style: 'pulse', growth: 230, decay: 1.7, maxSize: 200 },
    drain: { style: 'spiral', growth: 200, decay: 2.2, maxSize: 160, spin: 3, lineWidth: 2 },
    dashstart: { style: 'burst', growth: 320, decay: 3.2, maxSize: 160, lineWidth: 3, rays: 12 },
    dashend: { style: 'pulse', growth: 220, decay: 2.6, maxSize: 120 },
    default: { style: 'ring', growth: 200, decay: 2, maxSize: 120, lineWidth: 2 }
  };

  const createEffect = (state, x, y, type, color) => {
    const config = effectConfigs[type] || effectConfigs.default;
    state.effects.push({
      x,
      y,
      type,
      color,
      style: config.style,
      life: 1,
      size: config.initialSize ?? 0,
      maxSize: config.maxSize,
      growth: config.growth,
      decay: config.decay,
      lineWidth: config.lineWidth ?? 3,
      rays: config.rays ?? 0,
      rotation: Math.random() * Math.PI * 2,
      spin: config.spin ?? 0
    });
  };

  const addNotification = (state, text) => {
    state.notifications.push({
      text,
      life: 2,
      y: 60,
      id: Date.now() + Math.random()
    });
  };

  const powerUpTypes = createPowerUpTypes({
    addNotification: (text) => addNotification(stateRef.current, text)
  });
  const skills = createSkills({
    createEffect: (x, y, type, color) => createEffect(stateRef.current, x, y, type, color),
    playSound,
    createParticle: (x, y, color, size) => createParticle(stateRef.current, x, y, color, size)
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


  const handleJoystickStart = (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    setJoystickActive(true);
    stateRef.current.joystick.active = true;
    stateRef.current.joystick.source = 'touch';

    updateJoystickPosition(touch.clientX, touch.clientY, centerX, centerY);
  };

  const handleJoystickMove = (e) => {
    if (!joystickActive) return;
    
    e.preventDefault();
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    updateJoystickPosition(touch.clientX, touch.clientY, centerX, centerY);
  };

  const handleJoystickEnd = () => {
    setJoystickActive(false);
    setJoystickPosition({ x: 0, y: 0 });
    const joystick = stateRef.current.joystick;
    joystick.x = 0;
    joystick.y = 0;
    joystick.active = false;
    joystick.source = 'touch';

    const keys = keyboardStateRef.current;
    if (keys.up || keys.down || keys.left || keys.right) {
      const x = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      const y = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
      const length = Math.hypot(x, y) || 1;
      joystick.x = x / length;
      joystick.y = y / length;
      joystick.active = true;
      joystick.source = 'keyboard';
    }
  };

  const updateJoystickPosition = (touchX, touchY, centerX, centerY) => {
    const dx = touchX - centerX;
    const dy = touchY - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxDist = 50;
    
    let x = dx;
    let y = dy;
    
    if (dist > maxDist) {
      x = (dx / dist) * maxDist;
      y = (dy / dist) * maxDist;
    }
    
    setJoystickPosition({ x, y });
    
    stateRef.current.joystick = {
      x: x / maxDist,
      y: y / maxDist,
      active: true,
      source: 'touch'
    };
  };

  const updateKeyboardJoystick = () => {
    const keys = keyboardStateRef.current;
    const joystick = stateRef.current.joystick;
    const x = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    const y = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);

    if (x !== 0 || y !== 0) {
      const length = Math.hypot(x, y) || 1;
      joystick.x = x / length;
      joystick.y = y / length;
      joystick.active = true;
      joystick.source = 'keyboard';
    } else if (joystick.source === 'keyboard') {
      joystick.x = 0;
      joystick.y = 0;
      joystick.active = false;
      joystick.source = 'none';
    }
  };

  const checkEvolution = () => {
    const state = stateRef.current;
    checkEvolutionSystem(state, getSystemHelpers());
  };

  const openEvolutionMenu = () => {
    const state = stateRef.current;
    openEvolutionMenuSystem(state, getSystemHelpers());
  };

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
      hasMultipleSkills: organism.skills.length > 1
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

  useEffect(() => {
    const handleKeyDown = (event) => {
      const targetTag = event.target?.tagName?.toLowerCase();
      if (targetTag && ['input', 'textarea', 'select'].includes(targetTag)) return;

      const key = event.key;
      const lower = key.toLowerCase();
      let movementUpdated = false;

      if (key === 'ArrowUp' || lower === 'w') {
        keyboardStateRef.current.up = true;
        movementUpdated = true;
      } else if (key === 'ArrowDown' || lower === 's') {
        keyboardStateRef.current.down = true;
        movementUpdated = true;
      } else if (key === 'ArrowLeft' || lower === 'a') {
        keyboardStateRef.current.left = true;
        movementUpdated = true;
      } else if (key === 'ArrowRight' || lower === 'd') {
        keyboardStateRef.current.right = true;
        movementUpdated = true;
      }

      if (movementUpdated) {
        event.preventDefault();
        updateKeyboardJoystick();
      }

      if (key === ' ' || key === 'Spacebar') {
        event.preventDefault();
        performAttack();
      } else if (key === 'Shift') {
        event.preventDefault();
        performDash();
      } else if (lower === 'q') {
        event.preventDefault();
        useSkill();
      } else if (lower === 'r' || key === 'Tab') {
        event.preventDefault();
        cycleSkill(1);
      } else if (lower === 'e') {
        event.preventDefault();
        openEvolutionMenu();
      }
    };

    const handleKeyUp = (event) => {
      const key = event.key;
      const lower = key.toLowerCase();
      let movementUpdated = false;

      if (key === 'ArrowUp' || lower === 'w') {
        keyboardStateRef.current.up = false;
        movementUpdated = true;
      } else if (key === 'ArrowDown' || lower === 's') {
        keyboardStateRef.current.down = false;
        movementUpdated = true;
      } else if (key === 'ArrowLeft' || lower === 'a') {
        keyboardStateRef.current.left = false;
        movementUpdated = true;
      } else if (key === 'ArrowRight' || lower === 'd') {
        keyboardStateRef.current.right = false;
        movementUpdated = true;
      }

      if (movementUpdated) {
        event.preventDefault();
        updateKeyboardJoystick();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
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
      <div style={{
        width: '100vw',
        height: '100vh',
        background: 'linear-gradient(135deg, #1a0a0a 0%, #2a0515 50%, #0a0a1a 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, sans-serif',
        color: '#fff',
        padding: '20px',
        animation: 'fadeIn 0.5s ease'
      }}>
        <h1 style={{
          fontSize: '3.5rem',
          margin: '0 0 30px 0',
          background: 'linear-gradient(90deg, #FF0066, #FF6600, #FF0066)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          animation: 'pulse 2s infinite'
        }}>
          Game Over
        </h1>
        
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(20px)',
          padding: '40px',
          borderRadius: '25px',
          border: '2px solid rgba(255, 255, 255, 0.1)',
          marginBottom: '40px',
          textAlign: 'center',
          boxShadow: '0 10px 50px rgba(0, 0, 0, 0.5)'
        }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '20px', opacity: 0.8 }}>
            Pontuação Final
          </div>
          <div style={{
            fontSize: '4rem',
            fontWeight: 'bold',
            background: 'linear-gradient(90deg, #00D9FF, #7B2FFF, #FF00E5)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '20px'
          }}>
            {gameState.score}
          </div>
          <div style={{ fontSize: '1.1rem', opacity: 0.7 }}>
            🧬 Nível Alcançado: {gameState.level}
          </div>
          <div style={{ fontSize: '1.1rem', opacity: 0.7, marginTop: '6px' }}>
            🔥 Combo Máximo: x{gameState.maxCombo || 0}
          </div>
        </div>
        
        <button
          onClick={restartGame}
          style={{
            background: 'linear-gradient(135deg, #00FF88, #00D9FF)',
            border: 'none',
            padding: '20px 50px',
            borderRadius: '50px',
            fontSize: '1.4rem',
            fontWeight: 'bold',
            color: '#000',
            cursor: 'pointer',
            boxShadow: '0 0 40px rgba(0, 217, 255, 0.6)'
          }}
        >
          🔄 Jogar Novamente
        </button>
        
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes pulse {
            0%, 100% { filter: brightness(1); }
            50% { filter: brightness(1.3); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: '#000',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'system-ui, sans-serif',
      color: '#fff',
      overflow: 'hidden',
      position: 'relative'
    }}>
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        padding: '5px 10px',
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 10,
        height: '40px'
      }}>
        <div style={{
          fontSize: '1rem',
          fontWeight: 'bold',
          background: 'linear-gradient(90deg, #00D9FF, #7B2FFF)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          MicrΩ • Nv.{gameState.level} • {gameState.score} pts
        </div>
      </div>

      <canvas
        ref={canvasRef}
        style={{
          width: '100vw',
          height: '100vh',
          touchAction: 'none',
          display: 'block'
        }}
      />

      {gameState.bossActive && (
        <div
          style={{
            position: 'absolute',
            top: '48px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'min(600px, 80%)',
            background: 'rgba(40, 12, 30, 0.75)',
            border: '1px solid rgba(255, 0, 120, 0.4)',
            borderRadius: '14px',
            padding: '10px 18px',
            zIndex: 11,
            boxShadow: '0 0 30px rgba(255, 0, 120, 0.25)',
            pointerEvents: 'none'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', marginBottom: '6px' }}>
            <span>⚠️ Mega-organismo</span>
            <span>
              {Math.max(
                0,
                Math.round((gameState.bossHealth / (gameState.bossMaxHealth || 1)) * 100)
              )}%
            </span>
          </div>
          <div style={{ height: '10px', background: 'rgba(255, 255, 255, 0.12)', borderRadius: '6px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.max(
                  0,
                  Math.min(100, (gameState.bossHealth / (gameState.bossMaxHealth || 1)) * 100)
                )}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #FF3A6B, #FFD166)',
                transition: 'width 0.2s ease'
              }}
            />
          </div>
        </div>
      )}

      <div style={{
        position: 'absolute',
        top: '45px',
        left: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '5px',
        pointerEvents: 'none',
        zIndex: 10
      }}>
        <div style={{
          background: 'rgba(0, 217, 255, 0.2)',
          backdropFilter: 'blur(8px)',
          padding: '4px 8px',
          borderRadius: '6px',
          fontSize: '0.7rem'
        }}>
          ⚡ {Math.floor(gameState.energy)}
        </div>
        
        <div style={{
          background: 'rgba(255, 100, 100, 0.2)',
          backdropFilter: 'blur(8px)',
          padding: '4px 8px',
          borderRadius: '6px',
          fontSize: '0.7rem'
        }}>
          ❤️ {Math.floor(gameState.health)}/{gameState.maxHealth}
        </div>
        
        <div style={{
          background: 'rgba(255, 200, 0, 0.2)',
          backdropFilter: 'blur(8px)',
          padding: '4px 8px',
          borderRadius: '6px',
          fontSize: '0.7rem'
        }}>
          💨 {Math.floor(gameState.dashCharge)}%
        </div>
        {gameState.combo > 1 && (
          <div style={{
            background: 'rgba(255, 80, 0, 0.25)',
            backdropFilter: 'blur(8px)',
            padding: '4px 8px',
            borderRadius: '6px',
            fontSize: '0.7rem',
            color: '#FFAA55'
          }}>
            🔥 Combo x{gameState.combo}
          </div>
        )}
        {gameState.maxCombo > 0 && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.1)',
            padding: '3px 8px',
            borderRadius: '6px',
            fontSize: '0.65rem',
            color: 'rgba(255, 255, 255, 0.7)'
          }}>
            🏅 Máx x{gameState.maxCombo}
          </div>
        )}
        {gameState.activePowerUps?.length > 0 && (
          <div style={{
            marginTop: '6px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            {gameState.activePowerUps.map(power => {
              const percent = power.duration ? Math.max(0, Math.min(100, (power.remaining / power.duration) * 100)) : 0;
              return (
                <div
                  key={power.type}
                  style={{
                    background: `${power.color}22`,
                    border: `1px solid ${power.color}`,
                    borderRadius: '8px',
                    padding: '4px 6px'
                  }}
                >
                  <div style={{ fontSize: '0.65rem', color: power.color }}>
                    {power.icon} {power.name}
                  </div>
                  <div style={{
                    marginTop: '2px',
                    height: '4px',
                    background: 'rgba(255, 255, 255, 0.15)',
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${percent}%`,
                      height: '100%',
                      background: power.color,
                      transition: 'width 0.2s ease'
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {(currentSkillInfo || gameState.skillList.length > 0) && (
        <div
          style={{
            position: 'absolute',
            top: '45px',
            right: '8px',
            width: '230px',
            background: 'rgba(8, 18, 36, 0.78)',
            border: '1px solid rgba(0, 217, 255, 0.35)',
            borderRadius: '12px',
            padding: '10px 14px',
            zIndex: 10,
            backdropFilter: 'blur(14px)',
            boxShadow: '0 8px 28px rgba(0, 0, 0, 0.35)',
            pointerEvents: 'auto'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#00D9FF' }}>
              {currentSkillInfo ? `${currentSkillInfo.icon} ${currentSkillInfo.name}` : 'Sem habilidade ativa'}
            </span>
            {currentSkillInfo && (
              <span style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.7)' }}>
                {currentSkillInfo.cost}⚡
              </span>
            )}
          </div>

          <div style={{
            fontSize: '0.7rem',
            color: 'rgba(255, 255, 255, 0.7)',
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '4px'
          }}>
            <span>Custo: {currentSkillInfo ? currentSkillInfo.cost : '--'}⚡</span>
            <span>{skillCooldownLabel}</span>
          </div>

          <div
            style={{
              height: '6px',
              background: 'rgba(255, 255, 255, 0.12)',
              borderRadius: '4px',
              overflow: 'hidden',
              marginBottom: gameState.skillList.length > 0 ? '8px' : '4px'
            }}
          >
            <div
              style={{
                width: `${skillReadyPercent}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #00D9FF, #7B2FFF)',
                transition: 'width 0.2s ease'
              }}
            />
          </div>

          {gameState.skillList.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: gameState.hasMultipleSkills ? '8px' : '6px' }}>
              {gameState.skillList.map(skill => {
                const cooldownPercent = skill.maxCooldown
                  ? Math.max(0, Math.min(100, (skill.cooldown / skill.maxCooldown) * 100))
                  : 0;
                return (
                  <div
                    key={skill.key}
                    title={`${skill.name}`}
                    style={{
                      position: 'relative',
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      border: skill.isActive ? '2px solid #00D9FF' : '1px solid rgba(255, 255, 255, 0.25)',
                      background: skill.isActive ? 'rgba(0, 217, 255, 0.18)' : 'rgba(255, 255, 255, 0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.1rem',
                      overflow: 'hidden',
                      boxShadow: skill.isActive ? '0 0 12px rgba(0, 217, 255, 0.4)' : 'none'
                    }}
                  >
                    <span>{skill.icon}</span>
                    {skill.cooldown > 0 && (
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          height: `${Math.max(0, Math.min(100, cooldownPercent))}%`,
                          background: 'rgba(0, 0, 0, 0.55)'
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {gameState.hasMultipleSkills && (
            <button
              type="button"
              onClick={() => cycleSkill(1)}
              onTouchStart={(e) => {
                e.preventDefault();
                cycleSkill(1);
              }}
              style={{
                width: '100%',
                padding: '6px 0',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(90deg, #00D9FF, #7B2FFF)',
                color: '#000',
                fontWeight: 600,
                fontSize: '0.75rem',
                cursor: 'pointer',
                marginBottom: '4px'
              }}
            >
              🔁 Trocar habilidade (R)
            </button>
          )}

          <div style={{ fontSize: '0.65rem', color: 'rgba(255, 255, 255, 0.55)', textAlign: 'center' }}>
            Q: usar habilidade • Shift: dash
          </div>
        </div>
      )}

      <div
        onTouchStart={handleJoystickStart}
        onTouchMove={handleJoystickMove}
        onTouchEnd={handleJoystickEnd}
        style={{
          position: 'absolute',
          bottom: '15px',
          left: '15px',
          width: '110px',
          height: '110px',
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.1)',
          border: '2px solid rgba(255, 255, 255, 0.3)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          touchAction: 'none',
          backdropFilter: 'blur(5px)',
          zIndex: 10
        }}
      >
        <div style={{
          width: '45px',
          height: '45px',
          borderRadius: '50%',
          background: joystickActive ? 'rgba(0, 217, 255, 0.7)' : 'rgba(255, 255, 255, 0.4)',
          border: '2px solid #fff',
          transform: `translate(${joystickPosition.x}px, ${joystickPosition.y}px)`,
          transition: joystickActive ? 'none' : 'transform 0.2s',
          boxShadow: joystickActive ? '0 0 20px rgba(0, 217, 255, 0.8)' : 'none'
        }} />
      </div>

      <button
        onTouchStart={() => { stateRef.current.actionButton = true; performAttack(); }}
        onTouchEnd={() => { stateRef.current.actionButton = false; }}
        onMouseDown={() => { stateRef.current.actionButton = true; performAttack(); }}
        onMouseUp={() => { stateRef.current.actionButton = false; }}
        style={{
          position: 'absolute',
          bottom: '15px',
          right: '15px',
          width: '70px',
          height: '70px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #FF0066, #FF6600)',
          border: '3px solid #fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.8rem',
          cursor: 'pointer',
          touchAction: 'none',
          zIndex: 10,
          boxShadow: '0 0 20px rgba(255, 0, 102, 0.5)'
        }}
      >
        ⚔️
      </button>

      <button
        onClick={performDash}
        disabled={gameState.dashCharge < 30}
        style={{
          position: 'absolute',
          bottom: '95px',
          right: '15px',
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: gameState.dashCharge >= 30
            ? 'linear-gradient(135deg, #FFD700, #FFA500)'
            : 'rgba(100, 100, 100, 0.5)',
          border: '3px solid #fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.5rem',
          cursor: gameState.dashCharge >= 30 ? 'pointer' : 'not-allowed',
          touchAction: 'none',
          zIndex: 10,
          boxShadow: gameState.dashCharge >= 30 ? '0 0 20px rgba(255, 215, 0, 0.6)' : 'none'
        }}
      >
        💨
      </button>

      <button
        type="button"
        onClick={useSkill}
        onTouchStart={(e) => {
          e.preventDefault();
          useSkill();
        }}
        disabled={skillDisabled}
        title="Q: usar habilidade"
        style={{
          position: 'absolute',
          bottom: '95px',
          right: '95px',
          width: '65px',
          height: '65px',
          borderRadius: '50%',
          background: skillDisabled
            ? 'rgba(100, 100, 100, 0.35)'
            : 'linear-gradient(135deg, #00D9FF, #7B2FFF)',
          border: '3px solid #fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.6rem',
          cursor: skillDisabled ? 'not-allowed' : 'pointer',
          touchAction: 'none',
          zIndex: 10,
          color: skillDisabled ? 'rgba(255, 255, 255, 0.75)' : '#000',
          opacity: skillDisabled ? 0.7 : 1,
          boxShadow: skillDisabled ? 'none' : '0 0 22px rgba(0, 217, 255, 0.55)'
        }}
      >
        <span>{currentSkillInfo ? currentSkillInfo.icon : '🌀'}</span>
        {currentSkillInfo && (
          <div
            style={{
              position: 'absolute',
              bottom: '6px',
              fontSize: '0.6rem',
              fontWeight: 600,
              color: skillDisabled ? '#fff' : '#001'
            }}
          >
            {skillCoolingDown ? skillCooldownLabel : `${currentSkillInfo.cost}⚡`}
          </div>
        )}
        {!currentSkillInfo && (
          <div
            style={{
              position: 'absolute',
              bottom: '6px',
              fontSize: '0.6rem',
              fontWeight: 600,
              color: '#fff'
            }}
          >
            --
          </div>
        )}
        {currentSkillInfo && skillCoolingDown && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: `${Math.max(0, Math.min(100, skillCooldownPercent))}%`,
              background: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '0 0 32px 32px',
              pointerEvents: 'none'
            }}
          />
        )}
      </button>

      <button
        onClick={openEvolutionMenu}
        disabled={!gameState.canEvolve}
        style={{
          position: 'absolute',
          bottom: '15px',
          right: '95px',
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: gameState.canEvolve 
            ? 'linear-gradient(135deg, #00FF88, #00D9FF)' 
            : 'rgba(100, 100, 100, 0.3)',
          border: '3px solid #fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.5rem',
          cursor: gameState.canEvolve ? 'pointer' : 'not-allowed',
          touchAction: 'none',
          zIndex: 10,
          boxShadow: gameState.canEvolve ? '0 0 25px rgba(0, 255, 136, 0.8)' : 'none',
          animation: gameState.canEvolve ? 'pulse 1s infinite' : 'none'
        }}
      >
        🧬
      </button>

      {gameState.showEvolutionChoice && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.95)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '15px'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #0a0a2a 0%, #1a0a3a 100%)',
            padding: '20px',
            borderRadius: '16px',
            border: '2px solid rgba(0, 217, 255, 0.5)',
            maxWidth: '450px',
            width: '100%',
            boxShadow: '0 0 60px rgba(0, 217, 255, 0.4)',
            maxHeight: '85vh',
            overflow: 'auto'
          }}>
            <h2 style={{
              margin: '0 0 15px 0',
              fontSize: '1.4rem',
              textAlign: 'center',
              background: 'linear-gradient(90deg, #00D9FF, #FF00E5)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              🧬 Evolução Nível {gameState.level}
            </h2>
            
            {stateRef.current.evolutionType === 'skill' ? (
              <>
                <h3 style={{ fontSize: '1rem', marginBottom: '10px' }}>Escolha uma Habilidade:</h3>
                <div style={{ display: 'grid', gap: '10px' }}>
                  {stateRef.current.availableTraits?.map(traitKey => {
                    const trait = evolutionaryTraits[traitKey];
                    return (
                      <div
                        key={traitKey}
                        onClick={() => chooseTrait(traitKey)}
                        style={{
                          background: `linear-gradient(90deg, ${trait.color}33, ${trait.color}11)`,
                          padding: '12px',
                          borderRadius: '10px',
                          border: `2px solid ${trait.color}`,
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ fontSize: '1rem', fontWeight: 'bold', color: trait.color }}>
                          {trait.icon} {trait.name}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <h3 style={{ fontSize: '1rem', marginBottom: '10px' }}>Escolha uma Forma:</h3>
                <div style={{ display: 'grid', gap: '10px' }}>
                  {stateRef.current.availableForms?.map(formKey => {
                    const form = forms[formKey];
                    return (
                      <div
                        key={formKey}
                        onClick={() => chooseForm(formKey)}
                        style={{
                          background: 'rgba(100, 100, 255, 0.2)',
                          padding: '12px',
                          borderRadius: '10px',
                          border: '2px solid #7B2FFF',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ fontSize: '1rem', fontWeight: 'bold' }}>
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

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
};

export default MicroOmegaGame;
