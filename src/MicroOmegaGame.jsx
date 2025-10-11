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
      spawnObstacle();
    }

    for (let i = 0; i < 18; i++) {
      spawnNebula(i % 4 === 0 ? 'solid' : 'gas');
    }

    for (let i = 0; i < 4; i++) {
      spawnPowerUp();
    }

    spawnOrganicMatter(25);
    
    return () => {
      if (audioCtxRef.current) audioCtxRef.current.close();
    };
  }, []);

  const spawnObstacle = () => {
    const state = stateRef.current;
    const types = Object.keys(obstacleTypes);
    const typeKey = types[Math.floor(Math.random() * types.length)];
    const type = obstacleTypes[typeKey];

    state.obstacles.push({
      x: Math.random() * 4000,
      y: Math.random() * 4000,
      size: type.sizes[0] + Math.random() * (type.sizes[1] - type.sizes[0]),
      color: type.colors[Math.floor(Math.random() * type.colors.length)],
      shape: type.shapes[Math.floor(Math.random() * type.shapes.length)],
      type: typeKey,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.3,
      pulsePhase: Math.random() * Math.PI * 2
    });
  };

  const spawnNebula = (forcedType) => {
    const state = stateRef.current;
    const keys = Object.keys(nebulaTypes);
    const typeKey = forcedType || keys[Math.floor(Math.random() * keys.length)];
    const type = nebulaTypes[typeKey];

    if (!type) return;

    const radius = type.radius[0] + Math.random() * (type.radius[1] - type.radius[0]);

    const layers = Array.from({ length: 4 }, () => ({
      offset: Math.random() * Math.PI * 2,
      scale: 0.6 + Math.random() * 0.5,
      alpha: type.opacity * (0.4 + Math.random() * 0.6)
    }));

    state.nebulas.push({
      id: Date.now() + Math.random(),
      x: Math.random() * state.worldSize,
      y: Math.random() * state.worldSize,
      radius,
      type: typeKey,
      rotation: Math.random() * Math.PI * 2,
      swirlSpeed: (Math.random() * 0.2 + 0.05) * (typeKey === 'gas' ? 1.5 : 1),
      pulse: Math.random() * Math.PI * 2,
      layers,
      color: type.color,
      innerColor: type.innerColor,
      glow: type.glow,
      opacity: type.opacity
    });
  };

  const spawnPowerUp = (x, y, forcedType) => {
    const state = stateRef.current;
    const keys = Object.keys(powerUpTypes);
    if (keys.length === 0) return;

    const typeKey = forcedType || keys[Math.floor(Math.random() * keys.length)];
    const type = powerUpTypes[typeKey];

    const powerUp = {
      id: Date.now() + Math.random(),
      x: x ?? Math.random() * state.worldSize,
      y: y ?? Math.random() * state.worldSize,
      type: typeKey,
      color: type.color,
      icon: type.icon,
      pulse: Math.random() * Math.PI * 2
    };

    state.powerUps.push(powerUp);
    return powerUp;
  };

  const dropPowerUps = (enemy) => {
    if (!enemy) return;

    const dropChance = enemy.boss ? 1 : 0.18;
    if (Math.random() < dropChance) {
      spawnPowerUp(
        enemy.x + (Math.random() - 0.5) * 40,
        enemy.y + (Math.random() - 0.5) * 40
      );
    }

    if (enemy.boss) {
      spawnPowerUp(enemy.x, enemy.y);
    }
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
      addNotification(type.message);
    } else {
      addNotification(`✨ ${type.name}!`);
    }

    if (typeKey === 'invincibility') {
      state.organism.invulnerableFromPowerUp = true;
      state.organism.hasShieldPowerUp = true;
    }

    playSound(type.sound || 'powerup');
    state.uiSyncTimer = 0;
    syncState();
  };

  const spawnOrganicMatter = (count) => {
    const state = stateRef.current;
    const types = Object.keys(organicMatterTypes);
    
    for (let i = 0; i < count; i++) {
      const typeKey = types[Math.floor(Math.random() * types.length)];
      const type = organicMatterTypes[typeKey];
      
      const isCluster = Math.random() > 0.4;
      const clusterSize = isCluster ? Math.floor(Math.random() * 5) + 3 : 1;
      
      const baseX = Math.random() * 4000;
      const baseY = Math.random() * 4000;
      
      for (let j = 0; j < clusterSize; j++) {
        const offset = isCluster ? (Math.random() - 0.5) * 40 : 0;
        
        state.organicMatter.push({
          x: baseX + offset,
          y: baseY + offset,
          vx: (Math.random() - 0.5) * 0.2,
          vy: (Math.random() - 0.5) * 0.2,
          size: type.sizes[0] + Math.random() * (type.sizes[1] - type.sizes[0]),
          color: type.colors[Math.floor(Math.random() * type.colors.length)],
          shape: type.shapes[Math.floor(Math.random() * type.shapes.length)],
          type: typeKey,
          energy: type.energy,
          health: type.health,
          rotationSpeed: (Math.random() - 0.5) * 2,
          rotation: Math.random() * Math.PI * 2,
          pulsePhase: Math.random() * Math.PI * 2,
          glowIntensity: Math.random() * 0.5 + 0.5
        });
      }
    }
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

  const createParticle = (x, y, color, size = 3) => {
    stateRef.current.particles.push({
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

  const createEffect = (x, y, type, color) => {
    const config = effectConfigs[type] || effectConfigs.default;
    stateRef.current.effects.push({
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

  const addNotification = (text) => {
    stateRef.current.notifications.push({
      text,
      life: 2,
      y: 60,
      id: Date.now() + Math.random()
    });
  };

  const powerUpTypes = createPowerUpTypes({ addNotification });
  const skills = createSkills({ createEffect, playSound, createParticle });

  const performDash = () => {
    const state = stateRef.current;
    const org = state.organism;

    if (org.dashCharge < 30 || org.dashCooldown > 0 || org.isDashing) return;

    org.dashCharge = Math.max(0, org.dashCharge - 30);
    org.isDashing = true;
    org.invulnerable = true;

    const dashSpeed = 25 * org.speed * (org.currentSpeedMultiplier || 1);
    const currentSpeed = Math.sqrt(org.vx * org.vx + org.vy * org.vy);

    if (currentSpeed > 0.5) {
      const normalizedVx = org.vx / currentSpeed;
      const normalizedVy = org.vy / currentSpeed;
      org.vx = normalizedVx * dashSpeed;
      org.vy = normalizedVy * dashSpeed;
    } else {
      org.vx = Math.cos(org.angle) * dashSpeed;
      org.vy = Math.sin(org.angle) * dashSpeed;
    }

    playSound('dash');
    createEffect(org.x, org.y, 'dashstart', org.color);

    for (let i = 0; i < 10; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * 20;
      createParticle(
        org.x + Math.cos(angle) * distance,
        org.y + Math.sin(angle) * distance,
        org.color,
        6
      );
    }

    setTimeout(() => {
      org.isDashing = false;
      org.invulnerable = false;
      org.dashCooldown = 1;
      createEffect(org.x, org.y, 'dashend', org.color);
      syncState();
    }, 300);

    syncState();
  };

  const spawnEnemy = () => {
    const state = stateRef.current;
    const templates = Object.keys(enemyTemplates);
    const templateKey = templates[Math.floor(Math.random() * templates.length)];
    const template = enemyTemplates[templateKey];
    
    const levelScale = 1 + (state.level * 0.2);
    const angle = Math.random() * Math.PI * 2;
    const distance = 600;
    
    state.enemies.push({
      id: Date.now() + Math.random(),
      x: state.organism.x + Math.cos(angle) * distance,
      y: state.organism.y + Math.sin(angle) * distance,
      vx: 0, vy: 0,
      type: templateKey,
      size: template.baseSize * Math.sqrt(levelScale),
      speed: template.baseSpeed,
      attack: Math.floor(template.baseAttack * levelScale),
      defense: Math.floor(template.baseDefense * levelScale),
      health: Math.floor(template.baseSize * levelScale * 2),
      maxHealth: Math.floor(template.baseSize * levelScale * 2),
      points: template.points,
      color: template.color,
      behavior: template.behavior,
      evolutionLevel: Math.floor(levelScale),
      attackCooldown: 0,
      state: 'wandering',
      animPhase: 0,
      canLeave: true,
      ticksOutOfRange: 0,
      boss: false
    });
  };

  const spawnBoss = () => {
    const state = stateRef.current;
    if (state.boss?.active) return;

    const org = state.organism;
    const angle = Math.random() * Math.PI * 2;
    const distance = 900;

    const boss = {
      id: Date.now() + Math.random(),
      x: org.x + Math.cos(angle) * distance,
      y: org.y + Math.sin(angle) * distance,
      vx: 0,
      vy: 0,
      type: 'leviathan',
      size: 160,
      speed: 1.2,
      attack: 35,
      defense: 14,
      health: 900,
      maxHealth: 900,
      points: 800,
      color: '#FF3A6B',
      behavior: 'boss',
      evolutionLevel: state.level,
      attackCooldown: 0,
      state: 'aggressive',
      animPhase: 0,
      canLeave: false,
      ticksOutOfRange: 0,
      boss: true
    };

    state.enemies.push(boss);
    state.boss = {
      active: true,
      health: boss.health,
      maxHealth: boss.maxHealth,
      color: boss.color
    };

    addNotification('⚠️ Mega-organismo detectado!');
    playSound('boss');
    state.uiSyncTimer = 0;
  };

  const updateEnemy = (enemy, state, delta) => {
    const org = state.organism;

    enemy.animPhase += delta * 3;
    enemy.attackCooldown = Math.max(0, enemy.attackCooldown - delta);

    const dx = org.x - enemy.x;
    const dy = org.y - enemy.y;
    const distToPlayer = Math.sqrt(dx * dx + dy * dy) || 1;

    if (enemy.boss) {
      enemy.vx += (dx / distToPlayer) * enemy.speed * 0.12;
      enemy.vy += (dy / distToPlayer) * enemy.speed * 0.12;
      enemy.rotation = (enemy.rotation || 0) + delta * 0.4;
      enemy.animPhase += delta * 2;
    } else {
      if (distToPlayer > 1500) {
        enemy.ticksOutOfRange++;
        if (enemy.ticksOutOfRange > 100) return false;
      } else {
        enemy.ticksOutOfRange = 0;
      }

      if (enemy.behavior === 'aggressive' && distToPlayer < 800) {
        enemy.vx += (dx / distToPlayer) * enemy.speed * 0.1;
        enemy.vy += (dy / distToPlayer) * enemy.speed * 0.1;
      } else if (enemy.behavior === 'territorial' && distToPlayer < 500) {
        enemy.vx += (dx / distToPlayer) * enemy.speed * 0.05;
        enemy.vy += (dy / distToPlayer) * enemy.speed * 0.05;
      } else if (enemy.behavior === 'opportunist') {
        if (distToPlayer < 350) {
          enemy.vx += (dx / distToPlayer) * enemy.speed * 0.1;
          enemy.vy += (dy / distToPlayer) * enemy.speed * 0.1;
        } else {
          enemy.vx += (Math.random() - 0.5) * enemy.speed * 0.05;
          enemy.vy += (Math.random() - 0.5) * enemy.speed * 0.05;
        }
      } else if (enemy.behavior === 'hunter') {
        enemy.vx += (dx / distToPlayer) * enemy.speed * 0.12;
        enemy.vy += (dy / distToPlayer) * enemy.speed * 0.12;
      }
    }

    enemy.vx *= 0.95;
    enemy.vy *= 0.95;

    const speed = Math.sqrt(enemy.vx * enemy.vx + enemy.vy * enemy.vy);
    const maxSpeed = (enemy.speed * (enemy.boss ? 1.5 : 2));
    if (speed > maxSpeed) {
      enemy.vx = (enemy.vx / speed) * maxSpeed;
      enemy.vy = (enemy.vy / speed) * maxSpeed;
    }

    enemy.x += enemy.vx;
    enemy.y += enemy.vy;

    if (distToPlayer < enemy.size + org.size + 10 && enemy.attackCooldown === 0) {
      const powerShieldActive =
        org.hasShieldPowerUp ||
        org.invulnerableFromPowerUp ||
        state.activePowerUps.some(p => p.type === 'invincibility');

      if (!org.invulnerable && !org.dying && !powerShieldActive) {
        const damage = Math.max(1, enemy.attack - org.defense);
        state.health -= damage;
        addNotification(`-${damage} HP`);
        playSound('damage');
        createEffect(org.x, org.y, 'hit', '#FF0000');

        org.eyeExpression = 'hurt';
        setTimeout(() => { org.eyeExpression = 'neutral'; }, 500);

        if (state.health <= 0) {
          org.dying = true;
          org.deathTimer = 2;
        }
      }
      enemy.attackCooldown = enemy.boss ? 2.2 : 1.5;

      org.vx += (dx / distToPlayer) * -3;
      org.vy += (dy / distToPlayer) * -3;
      state.combo = 0;
      state.comboTimer = 0;
      state.uiSyncTimer = Math.min(state.uiSyncTimer, 0.05);
    }

    if (enemy.boss) {
      state.boss = {
        active: true,
        health: enemy.health,
        maxHealth: enemy.maxHealth,
        color: enemy.color
      };
    }

    return enemy.health > 0;
  };

  const performAttack = () => {
    const state = stateRef.current;
    const org = state.organism;
    
    if (org.attackCooldown > 0 || org.dying) return;
    
    let hitSomething = false;
    let comboSound = false;

    const comboMultiplier = 1 + (state.combo * 0.05);
    const attackBonus = org.currentAttackBonus || 0;
    const rangeBonus = org.currentRangeBonus || 0;
    const attackRange = org.attackRange + rangeBonus;

    state.enemies.forEach(enemy => {
      const dx = enemy.x - org.x;
      const dy = enemy.y - org.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      if (dist < attackRange) {
        const damage = Math.max(1, (org.attack + attackBonus) * comboMultiplier - enemy.defense * 0.5);
        enemy.health -= damage;

        createEffect(enemy.x, enemy.y, 'hit', org.color);

        enemy.vx += (dx / dist) * 5;
        enemy.vy += (dy / dist) * 5;

        hitSomething = true;

        state.combo += 1;
        state.comboTimer = 3;
        if (state.combo > state.maxCombo) state.maxCombo = state.combo;
        if (state.combo > 0 && state.combo % 6 === 0) comboSound = true;

        if (enemy.health <= 0) {
          state.energy += 30;
          state.score += enemy.points;
          addNotification(`+${enemy.points} pts`);
          for (let i = 0; i < 15; i++) {
            createParticle(enemy.x, enemy.y, enemy.color);
          }
          dropPowerUps(enemy);
          if (enemy.boss) {
            state.boss = null;
            state.bossPending = false;
          }
          state.uiSyncTimer = Math.min(state.uiSyncTimer, 0.05);
        }

        if (enemy.boss && enemy.health > 0) {
          state.boss = {
            active: true,
            health: Math.max(0, enemy.health),
            maxHealth: enemy.maxHealth,
            color: enemy.color
          };
        }
      }
    });

    if (hitSomething) {
      playSound('attack');
      if (comboSound) playSound('combo');
      org.attackCooldown = 0.8;
      org.eyeExpression = 'attacking';
      setTimeout(() => { org.eyeExpression = 'neutral'; }, 300);
      createEffect(org.x, org.y, 'attack', org.color);
      state.uiSyncTimer = Math.min(state.uiSyncTimer, 0.05);
    } else {
      state.combo = Math.max(0, state.combo - 1);
      if (state.combo === 0) {
        state.comboTimer = 0;
      }
    }

    syncState();
  };

  const useSkill = () => {
    const state = stateRef.current;
    const org = state.organism;

    if (org.skills.length === 0 || org.dying) return;
    
    const currentSkill = org.skills[org.currentSkillIndex];
    const skill = skills[currentSkill];
    
    if (!skill || org.skillCooldowns[currentSkill] > 0) return;
    
    if (state.energy < skill.cost) {
      addNotification('Energia insuficiente!');
      return;
    }
    
    state.energy -= skill.cost;
    skill.effect(state);
    org.skillCooldowns[currentSkill] = skill.cooldown / 1000;
    state.uiSyncTimer = 0;

    syncState();
  };

  const cycleSkill = (direction = 1) => {
    const state = stateRef.current;
    const org = state.organism;

    if (org.skills.length <= 1 || org.dying) return;

    const total = org.skills.length;
    org.currentSkillIndex = (org.currentSkillIndex + direction + total) % total;

    const skillKey = org.skills[org.currentSkillIndex];
    const skill = skills[skillKey];
    if (skill) {
      addNotification(`Skill: ${skill.name}`);
    }

    state.uiSyncTimer = 0;
    syncState();
  };

  const updateOrganismPhysics = (org, delta) => {
    const state = stateRef.current;

    if (org.dying) {
      org.deathTimer -= delta;
      org.rotation += delta * 5;
      org.size *= 0.98;

      if (org.deathTimer <= 0) {
        state.gameOver = true;
        syncState();
      }
      return;
    }

    let speedMultiplier = 1;
    let attackBonus = 0;
    let rangeBonus = 0;
    let invincibilityActive = false;

    state.activePowerUps = state.activePowerUps.filter(power => {
      power.remaining -= delta;
      if (power.remaining > 0) {
        const intensity = Math.max(0.4, power.remaining / power.duration);
        if (power.type === 'speed') {
          speedMultiplier += 0.6 * intensity;
        } else if (power.type === 'damage') {
          attackBonus += 6 * intensity;
          rangeBonus += 20 * intensity;
        } else if (power.type === 'invincibility') {
          invincibilityActive = true;
        }
        return true;
      }

      addNotification(`${power.name} dissipou.`);
      state.uiSyncTimer = Math.min(state.uiSyncTimer, 0.05);
      return false;
    });

    org.currentSpeedMultiplier = speedMultiplier;
    org.currentAttackBonus = attackBonus;
    org.currentRangeBonus = rangeBonus;
    org.hasShieldPowerUp = invincibilityActive;
    org.invulnerableFromPowerUp = invincibilityActive;

    const friction = org.isDashing ? 0.98 : 0.92;
    const baseSpeed = org.isDashing ? 20 * speedMultiplier : 5 * org.speed * speedMultiplier;
    const maxSpeed = baseSpeed;

    const joy = state.joystick;
    
    if (joy.active && !org.isDashing) {
      org.vx += joy.x * 0.5;
      org.vy += joy.y * 0.5;
      
      if (joy.x !== 0 || joy.y !== 0) {
        org.targetAngle = Math.atan2(joy.y, joy.x);
      }
    }
    
    // Rotação suave
    let angleDiff = org.targetAngle - org.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    org.angle += angleDiff * 0.1;
    
    org.vx *= friction;
    org.vy *= friction;
    
    const speed = Math.sqrt(org.vx * org.vx + org.vy * org.vy);
    if (speed > maxSpeed) {
      org.vx = (org.vx / speed) * maxSpeed;
      org.vy = (org.vy / speed) * maxSpeed;
    }
    
    org.x += org.vx;
    org.y += org.vy;
    
    org.x = Math.max(org.size, Math.min(4000 - org.size, org.x));
    org.y = Math.max(org.size, Math.min(4000 - org.size, org.y));
    
    // Animação de locomoção SUTIL e ORGÂNICA
    const speedFactor = Math.min(speed / maxSpeed, 1);
    
    // Ondulação do corpo (swimming motion)
    org.swimPhase += delta * (3 + speedFactor * 5);
    org.bodyWave = Math.sin(org.swimPhase) * speedFactor * 0.08; // Muito sutil!
    
    // Pulsação rítmica durante movimento
    org.pulseIntensity = 1 + Math.sin(org.swimPhase * 0.5) * speedFactor * 0.05;
    
    // Inclinação suave baseada na direção
    if (speedFactor > 0.1) {
      const tiltAmount = speedFactor * 0.1; // Muito sutil
      org.tiltX = Math.sin(org.swimPhase) * tiltAmount;
      org.tiltY = Math.cos(org.swimPhase * 1.3) * tiltAmount;
    } else {
      org.tiltX *= 0.9;
      org.tiltY *= 0.9;
    }
    
    // Trail mais suave
    if (speed > 1) {
      if (org.trail.length === 0 || 
          Math.sqrt((org.x - org.trail[org.trail.length - 1].x) ** 2 + 
                    (org.y - org.trail[org.trail.length - 1].y) ** 2) > 5) {
        org.trail.push({ 
          x: org.x, 
          y: org.y, 
          life: 1, 
          size: org.size * 0.8,
          color: org.color 
        });
        if (org.trail.length > 20) org.trail.shift();
      }
    }
    
    org.trail = org.trail.map(t => ({ ...t, life: t.life - delta * 1.5 })).filter(t => t.life > 0);
    
    // Dash particles
    if (org.isDashing) {
      for (let i = 0; i < 3; i++) {
        createParticle(org.x, org.y, org.color, 4);
      }
    }
    
    // Dash recharge
    if (org.dashCharge < org.maxDashCharge) {
      org.dashCharge = Math.min(org.maxDashCharge, org.dashCharge + delta * 20);
    }
    
    org.dashCooldown = Math.max(0, org.dashCooldown - delta);
    
    // Eye animation
    org.eyeBlinkTimer += delta;
    if (org.eyeBlinkTimer > 3 + Math.random() * 2) {
      org.eyeBlinkState = 1;
      org.eyeBlinkTimer = 0;
    }
    
    if (org.eyeBlinkState > 0) {
      org.eyeBlinkState -= delta * 8;
      if (org.eyeBlinkState < 0) org.eyeBlinkState = 0;
    }
    
    if (speed > 0.5) {
      const targetLookX = (org.vx / maxSpeed) * 0.5;
      const targetLookY = (org.vy / maxSpeed) * 0.5;
      org.eyeLookX += (targetLookX - org.eyeLookX) * 0.1;
      org.eyeLookY += (targetLookY - org.eyeLookY) * 0.1;
    } else {
      org.eyeLookX *= 0.9;
      org.eyeLookY *= 0.9;
    }
    
    org.attackCooldown = Math.max(0, org.attackCooldown - delta);

    Object.keys(org.skillCooldowns).forEach(key => {
      org.skillCooldowns[key] = Math.max(0, org.skillCooldowns[key] - delta);
    });

    if (state.combo > 0) {
      state.comboTimer -= delta;
      if (state.comboTimer <= 0) {
        state.combo = 0;
        state.comboTimer = 0;
        state.uiSyncTimer = Math.min(state.uiSyncTimer, 0.05);
      }
    }
  };

  const renderOrganism = (ctx, org, offsetX, offsetY) => {
    const baseSize = org.size * org.pulseIntensity;
    
    ctx.save();
    ctx.translate(org.x - offsetX, org.y - offsetY);
    
    const activePowerUps = stateRef.current.activePowerUps;
    const hasPowerShield = org.invulnerableFromPowerUp || activePowerUps.some(p => p.type === 'invincibility');

    // Trail suave
    org.trail.forEach((t, i) => {
      const trailSize = t.size * (i / org.trail.length);
      ctx.fillStyle = t.color;
      ctx.globalAlpha = t.life * 0.2;
      ctx.shadowBlur = 15;
      ctx.shadowColor = t.color;
      ctx.beginPath();
      ctx.arc(t.x - org.x, t.y - org.y, trailSize, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    
    // Rotação e inclinação SUTIS
    ctx.rotate(org.angle);
    
    // Aplicar inclinação 3D simulada
    ctx.transform(1 + org.tiltX, org.tiltY, org.tiltX, 1 + org.tiltY, 0, 0);
    
    if (org.dying) {
      ctx.rotate(org.rotation);
      ctx.globalAlpha = org.deathTimer / 2;
    }
    
    // Shield
    if (org.invulnerable || hasPowerShield) {
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 4;
      ctx.globalAlpha = 0.6 + Math.sin(stateRef.current.pulsePhase * 10) * 0.3;
      ctx.shadowBlur = 25;
      ctx.shadowColor = '#FFD700';
      ctx.beginPath();
      ctx.arc(0, 0, baseSize + 15, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }

    if (hasPowerShield) {
      const shieldPower = activePowerUps.find(p => p.type === 'invincibility');
      const shieldColor = shieldPower?.color || '#FFD700';
      ctx.strokeStyle = shieldColor;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.4 + Math.sin(stateRef.current.pulsePhase * 6) * 0.2;
      ctx.beginPath();
      ctx.arc(0, 0, baseSize + 12 + Math.sin(stateRef.current.pulsePhase) * 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Membrana externa com ondulação SUTIL
    ctx.strokeStyle = org.color;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 20;
    ctx.shadowColor = org.color;
    
    ctx.beginPath();
    const segments = 64; // Mais segmentos = mais suave
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const wave = Math.sin(angle * 3 + org.swimPhase) * org.bodyWave * baseSize;
      const r = baseSize + wave + 8;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.globalAlpha = 0.3;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    
    // Corpo principal com gradiente rico
    const gradient = ctx.createRadialGradient(-baseSize * 0.3, -baseSize * 0.3, 0, 0, 0, baseSize * 1.4);
    gradient.addColorStop(0, org.tertiaryColor + 'FF');
    gradient.addColorStop(0.4, org.color);
    gradient.addColorStop(0.8, org.secondaryColor);
    gradient.addColorStop(1, org.color + '22');
    
    ctx.fillStyle = gradient;
    ctx.shadowBlur = 40;
    ctx.shadowColor = org.color;
    
    // Renderizar forma com ondulação
    ctx.beginPath();
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const wave = Math.sin(angle * 3 + org.swimPhase) * org.bodyWave * baseSize;
      const r = baseSize + wave;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.fill();
    
    ctx.shadowBlur = 0;
    
    // Organelos internos
    ctx.fillStyle = org.secondaryColor + '66';
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2 + org.swimPhase * 0.2;
      const dist = baseSize * 0.3;
      const size = baseSize * 0.1;
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * dist, Math.sin(angle) * dist, size, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Olhos expressivos
    const eyeSize = baseSize * 0.25;
    const eyeDistance = baseSize * 0.4;
    const eyeY = -eyeSize * 0.3;
    
    const expressionOffset = org.eyeExpression === 'hurt' ? 0.3 : 
                           org.eyeExpression === 'attacking' ? -0.2 : 0;
    
    [-1, 1].forEach(side => {
      ctx.save();
      ctx.translate(eyeDistance * side, eyeY + expressionOffset * eyeSize);
      
      if (org.eyeBlinkState > 0.5) {
        ctx.strokeStyle = org.secondaryColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-eyeSize, 0);
        ctx.lineTo(eyeSize, 0);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#FFF';
        ctx.strokeStyle = org.secondaryColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, eyeSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        const pupilX = org.eyeLookX * eyeSize * 0.4;
        const pupilY = org.eyeLookY * eyeSize * 0.4;
        
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(pupilX, pupilY, eyeSize * 0.5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#FFF';
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(pupilX - eyeSize * 0.15, pupilY - eyeSize * 0.15, eyeSize * 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    });
    
    ctx.restore();
  };

  const renderBackground = (ctx, canvas, offsetX, offsetY) => {
    const state = stateRef.current;
    
    // Gradiente de fundo complexo
    const gradient = ctx.createRadialGradient(
      canvas.width / 2, canvas.height / 2, 0,
      canvas.width / 2, canvas.height / 2, canvas.width
    );
    gradient.addColorStop(0, '#0d1f2d');
    gradient.addColorStop(0.3, '#0a1820');
    gradient.addColorStop(0.6, '#071218');
    gradient.addColorStop(1, '#030a0f');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Camadas de nebulosa
    state.backgroundLayers.forEach(layer => {
      layer.pulsePhase += 0.01;
      const pulse = Math.sin(layer.pulsePhase) * 0.5 + 0.5;
      
      const screenX = layer.x - offsetX * layer.depth;
      const screenY = layer.y - offsetY * layer.depth;
      
      const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, layer.size);
      gradient.addColorStop(0, layer.color);
      gradient.addColorStop(1, 'transparent');
      
      ctx.fillStyle = gradient;
      ctx.globalAlpha = layer.opacity * pulse;
      ctx.fillRect(screenX - layer.size, screenY - layer.size, layer.size * 2, layer.size * 2);
    });
    ctx.globalAlpha = 1;
    
    // Raios de luz
    state.lightRays.forEach(ray => {
      ray.y += ray.speed;
      if (ray.y > 4000) ray.y = -200;
      
      const screenX = ray.x - offsetX * 0.3;
      const screenY = ray.y - offsetY * 0.3;
      
      ctx.save();
      ctx.translate(screenX, screenY);
      ctx.rotate(ray.angle);
      
      const gradient = ctx.createLinearGradient(0, 0, 0, ray.length);
      gradient.addColorStop(0, `rgba(100, 200, 255, ${ray.opacity})`);
      gradient.addColorStop(0.5, `rgba(100, 200, 255, ${ray.opacity * 0.5})`);
      gradient.addColorStop(1, 'transparent');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(-ray.width / 2, 0, ray.width, ray.length);
      
      ctx.restore();
    });
    
    // Microorganismos de fundo
    state.microorganisms.forEach(micro => {
      micro.x += micro.vx;
      micro.y += micro.vy;
      micro.animPhase += 0.05;
      
      if (micro.x < 0) micro.x = 4000;
      if (micro.x > 4000) micro.x = 0;
      if (micro.y < 0) micro.y = 4000;
      if (micro.y > 4000) micro.y = 0;
      
      const screenX = micro.x - offsetX * micro.depth;
      const screenY = micro.y - offsetY * micro.depth;
      
      if (screenX > -50 && screenX < canvas.width + 50) {
        const pulse = Math.sin(micro.animPhase) * 0.2 + 1;
        
        ctx.fillStyle = micro.color + micro.opacity + ')';
        ctx.globalAlpha = micro.opacity;
        ctx.beginPath();
        ctx.arc(screenX, screenY, micro.size * pulse * micro.depth, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.globalAlpha = 1;
    
    // Partículas bioluminescentes
    state.glowParticles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.pulsePhase += 0.03;
      
      if (p.x < 0) p.x = 4000;
      if (p.x > 4000) p.x = 0;
      if (p.y < 0) p.y = 4000;
      if (p.y > 4000) p.y = 0;
      
      const screenX = p.x - offsetX * (0.5 + p.depth * 0.5);
      const screenY = p.y - offsetY * (0.5 + p.depth * 0.5);
      
      if (screenX > -50 && screenX < canvas.width + 50) {
        const glow = Math.sin(p.pulsePhase) * 0.5 + 0.5;
        
        ctx.fillStyle = p.color + (p.opacity * glow) + ')';
        ctx.shadowBlur = p.glowIntensity * glow;
        ctx.shadowColor = p.color + '1)';
        ctx.globalAlpha = p.opacity * glow;
        ctx.beginPath();
        ctx.arc(screenX, screenY, p.size * (0.5 + p.depth), 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    
    // Partículas flutuantes massivas
    state.floatingParticles.forEach(p => {
      p.x += p.vx * (1 + p.depth);
      p.y += p.vy * (1 + p.depth);
      p.pulsePhase += p.pulseSpeed * 0.02;
      
      if (p.x < 0) p.x = 4000;
      if (p.x > 4000) p.x = 0;
      if (p.y < 0) p.y = 4000;
      if (p.y > 4000) p.y = 0;
      
      const screenX = p.x - offsetX * (0.3 + p.depth * 0.7);
      const screenY = p.y - offsetY * (0.3 + p.depth * 0.7);
      
      if (screenX > -50 && screenX < canvas.width + 50) {
        const pulse = Math.sin(p.pulsePhase) * 0.3 + 0.7;
        const alpha = p.opacity * p.depth * pulse;
        
        ctx.fillStyle = `hsl(${p.hue}, 70%, 60%)`;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(screenX, screenY, p.size * (0.5 + p.depth * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.globalAlpha = 1;
  };

  const renderEnemy = (ctx, enemy, offsetX, offsetY) => {
    ctx.save();
    ctx.translate(enemy.x - offsetX, enemy.y - offsetY);

    ctx.shadowBlur = 20;
    ctx.shadowColor = enemy.color;

    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, enemy.size);
    gradient.addColorStop(0, enemy.color);
    gradient.addColorStop(1, enemy.color + '66');
    ctx.fillStyle = gradient;

    ctx.beginPath();
    ctx.arc(0, 0, enemy.size, 0, Math.PI * 2);
    ctx.fill();

    if (enemy.boss) {
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 4;
      ctx.globalAlpha = 0.6 + Math.sin(enemy.animPhase) * 0.2;
      ctx.beginPath();
      ctx.arc(0, 0, enemy.size + 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    if (enemy.health < enemy.maxHealth) {
      const barWidth = enemy.size * 2;
      const healthPercent = enemy.health / enemy.maxHealth;

      ctx.fillStyle = '#333';
      ctx.fillRect(-barWidth / 2, -enemy.size - 15, barWidth, 4);
      
      ctx.fillStyle = healthPercent > 0.5 ? '#00FF00' : healthPercent > 0.25 ? '#FFFF00' : '#FF0000';
      ctx.fillRect(-barWidth / 2, -enemy.size - 15, barWidth * healthPercent, 4);
    }
    
    ctx.shadowBlur = 0;
    ctx.restore();
  };

  const renderMinimap = (ctx, canvas, state) => {
    const minimapSize = 140;
    const padding = 20;
    ctx.save();
    ctx.translate(canvas.width - minimapSize - padding, padding);

    ctx.fillStyle = 'rgba(12, 18, 32, 0.75)';
    ctx.fillRect(0, 0, minimapSize, minimapSize);
    ctx.strokeStyle = 'rgba(0, 217, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, minimapSize, minimapSize);

    const scale = minimapSize / state.worldSize;

    state.nebulas.forEach(nebula => {
      ctx.fillStyle = nebula.type === 'solid' ? 'rgba(120, 90, 220, 0.4)' : 'rgba(80, 170, 240, 0.3)';
      const radius = nebula.radius * scale;
      ctx.beginPath();
      ctx.arc(nebula.x * scale, nebula.y * scale, Math.max(2, radius), 0, Math.PI * 2);
      ctx.fill();
    });

    state.obstacles.forEach(obs => {
      ctx.fillStyle = 'rgba(180, 90, 200, 0.6)';
      ctx.fillRect(obs.x * scale - 2, obs.y * scale - 2, 4, 4);
    });

    state.powerUps.forEach(power => {
      ctx.fillStyle = power.color;
      ctx.beginPath();
      ctx.arc(power.x * scale, power.y * scale, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    state.enemies.forEach(enemy => {
      ctx.fillStyle = enemy.boss ? '#FF5577' : '#FFAA33';
      ctx.beginPath();
      ctx.arc(enemy.x * scale, enemy.y * scale, enemy.boss ? 4 : 2, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = '#00D9FF';
    ctx.beginPath();
    ctx.arc(state.organism.x * scale, state.organism.y * scale, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
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
    const thresholds = [0, 200, 500, 1000, 1800, 3000, 5000];
    const nextThreshold = thresholds[state.level + 1];
    
    if (nextThreshold && state.energy >= nextThreshold) {
      state.canEvolve = true;
      syncState();
    }
  };

  const openEvolutionMenu = () => {
    const state = stateRef.current;
    
    if (!state.canEvolve) return;
    
    state.level++;
    state.canEvolve = false;

    state.evolutionType = state.level % 3 === 0 ? 'form' : 'skill';

    if (state.level >= state.nextBossLevel) {
      state.bossPending = true;
      state.nextBossLevel += 3;
    }

    if (state.evolutionType === 'skill') {
      const unusedTraits = Object.keys(evolutionaryTraits).filter(
        (traitKey) => !state.organism.traits.includes(traitKey)
      );
      const traitPool = unusedTraits.length > 0
        ? unusedTraits
        : Object.keys(evolutionaryTraits);
      state.availableTraits = pickRandomUnique(traitPool, Math.min(3, traitPool.length));
    } else {
      const unusedForms = Object.keys(forms).filter(
        (formKey) => formKey !== state.organism.form
      );
      const formPool = unusedForms.length > 0 ? unusedForms : Object.keys(forms);
      state.availableForms = pickRandomUnique(formPool, Math.min(3, formPool.length));
    }

    state.showEvolutionChoice = true;
    playSound('skill');
    state.uiSyncTimer = 0;
    syncState();
  };

  const chooseTrait = (traitKey) => {
    const state = stateRef.current;
    const trait = evolutionaryTraits[traitKey];
    
    if (trait) {
      state.organism.traits.push(traitKey);
      trait.effect(state.organism);

      state.organism.size += 4;
      state.organism.color = trait.color;

      if (trait.skill && state.organism.skillCooldowns[trait.skill] === undefined) {
        state.organism.skillCooldowns[trait.skill] = 0;
      }

      state.maxHealth += 30;
      state.health = state.maxHealth;

      state.showEvolutionChoice = false;
      addNotification(`✨ ${trait.name}`);

      state.uiSyncTimer = 0;

      syncState();
    }
  };

  const chooseForm = (formKey) => {
    const state = stateRef.current;
    const form = forms[formKey];
    
    if (form) {
      state.organism.form = formKey;
      state.organism.defense *= form.defense;
      state.organism.speed *= form.speed;

      state.showEvolutionChoice = false;
      addNotification(`✨ Forma ${form.name}!`);

      state.uiSyncTimer = 0;

      syncState();
    }
  };

  const restartGame = () => {
    const state = stateRef.current;

    Object.assign(state, {
      energy: 0,
      health: 100,
      maxHealth: 100,
      level: 1,
      score: 0,
      canEvolve: false,
      showEvolutionChoice: false,
      gameOver: false,
      combo: 0,
      maxCombo: 0,
      comboTimer: 0,
      boss: null,
      bossPending: false,
      nextBossLevel: 3,
      fogIntensity: 0,
      uiSyncTimer: 0,
      activePowerUps: [],
      powerUps: [],
      availableTraits: [],
      availableForms: [],
      organicMatter: [],
      enemies: [],
      projectiles: [],
      effects: [],
      particles: [],
      nebulas: [],
      notifications: [],
      lastEventTime: 0,
      gameTime: 0,

      organism: {
        x: 2000,
        y: 2000,
        vx: 0,
        vy: 0,
        size: 32,
        form: 'sphere',
        color: '#00D9FF',
        secondaryColor: '#0088FF',
        tertiaryColor: '#00FFFF',
        traits: [],
        angle: 0,
        targetAngle: 0,
        swimPhase: 0,
        bodyWave: 0,
        pulseIntensity: 1,
        rotation: 0,
        tiltX: 0,
        tiltY: 0,
        eyeBlinkTimer: 0,
        eyeBlinkState: 0,
        eyeLookX: 0,
        eyeLookY: 0,
        eyeExpression: 'neutral',
        trail: [],
        dashCharge: 100,
        maxDashCharge: 100,
        isDashing: false,
        dashCooldown: 0,
        currentSpeedMultiplier: 1,
        currentAttackBonus: 0,
        currentRangeBonus: 0,
        hasShieldPowerUp: false,
        invulnerableFromPowerUp: false,
        attack: 10,
        defense: 5,
        speed: 1,
        attackRange: 80,
        attackCooldown: 0,
        skills: [],
        currentSkillIndex: 0,
        skillCooldowns: {},
        dying: false,
        deathTimer: 0
      }
    });

    keyboardStateRef.current = { up: false, down: false, left: false, right: false };
    state.joystick = { x: 0, y: 0, active: false, source: 'none' };
    setJoystickActive(false);
    setJoystickPosition({ x: 0, y: 0 });

    state.obstacles = [];
    for (let i = 0; i < 30; i++) {
      spawnObstacle();
    }

    state.nebulas = [];
    for (let i = 0; i < 18; i++) {
      spawnNebula(i % 4 === 0 ? 'solid' : 'gas');
    }

    state.powerUps = [];
    for (let i = 0; i < 4; i++) {
      spawnPowerUp();
    }

    spawnOrganicMatter(25);

    syncState();
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
        spawnPowerUp();
      }

      if (state.bossPending && !(state.boss?.active)) {
        spawnBoss();
        state.bossPending = false;
      }

      // Renderizar fundo épico
      renderBackground(ctx, canvas, offsetX, offsetY);

      state.nebulas.forEach(nebula => {
        nebula.rotation += nebula.swirlSpeed * delta;
        nebula.pulse += delta * 0.4;

        const screenX = nebula.x - offsetX;
        const screenY = nebula.y - offsetY;

        if (screenX > -nebula.radius - 200 && screenX < canvas.width + nebula.radius + 200 &&
            screenY > -nebula.radius - 200 && screenY < canvas.height + nebula.radius + 200) {
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
            const layerRadius = nebula.radius * layer.scale * (1 + Math.sin(nebula.pulse + layer.offset) * 0.05);
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
            state.fogIntensity = Math.min(0.85, Math.max(state.fogIntensity, fogFactor * nebula.opacity * 1.8));
          }
        }
      });

      offsetX = org.x - canvas.width / 2;
      offsetY = org.y - canvas.height / 2;

      // Obstacles
      state.obstacles.forEach(obs => {
        obs.rotation += obs.rotationSpeed * delta;
        obs.pulsePhase += delta * 2;
        
        const screenX = obs.x - offsetX;
        const screenY = obs.y - offsetY;
        
        if (screenX > -200 && screenX < canvas.width + 200) {
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
      
      updateOrganismPhysics(org, delta);
      
      // Organic matter
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
          addNotification(`+${matter.energy} ⚡`);
          for (let i = 0; i < 5; i++) {
            createParticle(matter.x, matter.y, matter.color, 3);
          }
          return false;
        }
        
        const screenX = matter.x - offsetX;
        const screenY = matter.y - offsetY;
        
        if (screenX > -100 && screenX < canvas.width + 100) {
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
        spawnOrganicMatter(1);
      }

      // Power-ups
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

        if (screenX > -120 && screenX < canvas.width + 120 && screenY > -120 && screenY < canvas.height + 120) {
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
      
      // Enemies
      if (state.gameTime - state.lastEventTime > state.eventInterval / 1000) {
        spawnEnemy();
        state.lastEventTime = state.gameTime;
      }

      state.enemies = state.enemies.filter(e => updateEnemy(e, state, delta));

      const bossEnemy = state.enemies.find(e => e.boss);
      if (!bossEnemy && state.boss?.active) {
        addNotification('✨ Mega-organismo neutralizado!');
        state.boss = null;
        state.bossPending = false;
        state.uiSyncTimer = Math.min(state.uiSyncTimer, 0.05);
      }

      // Projectiles
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
            createEffect(enemy.x, enemy.y, 'hit', proj.color);

            if (enemy.health <= 0) {
              state.energy += 25;
              state.score += enemy.points;
              dropPowerUps(enemy);
              if (enemy.boss) {
                state.boss = null;
                state.bossPending = false;
                addNotification('✨ Mega-organismo neutralizado!');
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
      
      state.enemies.forEach(e => renderEnemy(ctx, e, offsetX, offsetY));

      renderOrganism(ctx, org, offsetX, offsetY);
      
      // Effects
      state.effects = state.effects.filter(eff => {
        const growth = eff.growth ?? 200;
        const decay = eff.decay ?? 2;

        eff.life -= delta * decay;
        eff.size = Math.min(eff.maxSize ?? 120, eff.size + delta * growth);

        if (eff.spin) {
          eff.rotation = (eff.rotation || 0) + eff.spin * delta;
        }

        if (eff.life <= 0) return false;

        const screenX = eff.x - offsetX;
        const screenY = eff.y - offsetY;

        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.globalAlpha = Math.max(0, Math.min(1, eff.life));
        ctx.shadowBlur = 20;
        ctx.shadowColor = eff.color;

        const style = eff.style || 'ring';
        const lineWidth = eff.lineWidth ?? 3;

        switch (style) {
          case 'filled': {
            ctx.fillStyle = eff.color;
            ctx.beginPath();
            ctx.arc(0, 0, Math.max(4, eff.size * 0.4), 0, Math.PI * 2);
            ctx.fill();
            break;
          }
          case 'double-ring': {
            ctx.strokeStyle = eff.color;
            ctx.lineWidth = lineWidth;
            ctx.beginPath();
            ctx.arc(0, 0, eff.size * 0.6, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha *= 0.6;
            ctx.beginPath();
            ctx.arc(0, 0, eff.size, 0, Math.PI * 2);
            ctx.stroke();
            break;
          }
          case 'pulse': {
            ctx.fillStyle = eff.color;
            ctx.beginPath();
            ctx.arc(0, 0, eff.size, 0, Math.PI * 2);
            ctx.fill();
            break;
          }
          case 'burst': {
            ctx.strokeStyle = eff.color;
            ctx.lineWidth = lineWidth;
            ctx.lineCap = 'round';
            const rays = eff.rays || 10;
            for (let i = 0; i < rays; i++) {
              const angle = (i / rays) * Math.PI * 2 + (eff.rotation || 0);
              const inner = eff.size * 0.2;
              const outer = eff.size;
              ctx.beginPath();
              ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
              ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
              ctx.stroke();
            }
            break;
          }
          case 'spiral': {
            ctx.strokeStyle = eff.color;
            ctx.lineWidth = lineWidth;
            ctx.beginPath();
            const segments = 24;
            for (let i = 0; i <= segments; i++) {
              const t = i / segments;
              const angle = (eff.rotation || 0) + t * Math.PI * 3;
              const radius = t * eff.size * 0.6;
              const x = Math.cos(angle) * radius;
              const y = Math.sin(angle) * radius;
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.stroke();
            break;
          }
          default: {
            ctx.strokeStyle = eff.color;
            ctx.lineWidth = lineWidth;
            ctx.beginPath();
            ctx.arc(0, 0, eff.size, 0, Math.PI * 2);
            ctx.stroke();
          }
        }

        ctx.restore();

        return true;
      });
      
      // Particles
      state.particles = state.particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.02;
        p.vy += 0.15;
        
        if (p.life <= 0) return false;
        
        const screenX = p.x - offsetX;
        const screenY = p.y - offsetY;
        
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.shadowBlur = 8;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.arc(screenX, screenY, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        
        return true;
      });
      ctx.globalAlpha = 1;

      if (state.fogIntensity > 0.01) {
        const fogGradient = ctx.createRadialGradient(
          canvas.width / 2,
          canvas.height / 2,
          Math.min(canvas.width, canvas.height) * 0.2,
          canvas.width / 2,
          canvas.height / 2,
          Math.max(canvas.width, canvas.height)
        );
        fogGradient.addColorStop(0, `rgba(20, 40, 70, ${state.fogIntensity * 0.4})`);
        fogGradient.addColorStop(1, `rgba(5, 10, 20, ${state.fogIntensity})`);
        ctx.save();
        ctx.globalAlpha = state.fogIntensity;
        ctx.fillStyle = fogGradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      }

      renderMinimap(ctx, canvas, state);

      // Notifications
      state.notifications = state.notifications.filter(n => {
        n.life -= delta;
        n.y += delta * 20;
        
        if (n.life > 0) {
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 16px sans-serif';
          ctx.textAlign = 'center';
          ctx.globalAlpha = Math.min(n.life, 1);
          ctx.shadowBlur = 8;
          ctx.shadowColor = '#000';
          ctx.fillText(n.text, canvas.width / 2, n.y);
          ctx.shadowBlur = 0;
          return true;
        }
        return false;
      });
      ctx.globalAlpha = 1;

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
