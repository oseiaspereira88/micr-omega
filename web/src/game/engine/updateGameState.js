import {
  nebulaTypes,
} from '../config';

const ensureNumber = (value, fallback = 0) =>
  typeof value === 'number' ? value : fallback;

export const updateGameState = ({
  state,
  delta = 0,
  movementIntent = {},
  helpers = {},
  spawnEnemy,
  spawnBoss,
  spawnOrganicMatter,
  applyPowerUp,
}) => {
  if (!state) return;

  const {
    createEffect = () => {},
    createParticle = () => {},
    addNotification = () => {},
    dropPowerUps = () => [],
    playSound = () => {},
    getAveragePlayerLevel = () => 1,
  } = helpers;

  const organism = state.organism;
  if (!organism) {
    return;
  }

  const camera = state.camera;
  const worldSize = ensureNumber(state.worldSize, 4000);

  const averageLevelRaw = Number(getAveragePlayerLevel?.() ?? 1);
  const normalizedAverageLevel = Number.isFinite(averageLevelRaw) ? averageLevelRaw : 1;
  const clampedAverageLevel = Math.max(1, normalizedAverageLevel);
  const baseEnemyCap = 10;
  const enemyCapGrowth = 2;
  const maxEnemiesAllowed = Math.max(
    4,
    Math.round(baseEnemyCap + (clampedAverageLevel - 1) * enemyCapGrowth)
  );

  state.joystick = movementIntent || state.joystick || {};

  if (!state.gameOver) {
    const frameFactor = Math.min(delta * 60, 3);
    const moving = Boolean(movementIntent?.x || movementIntent?.y);

    if (moving && frameFactor > 0) {
      const length = Math.sqrt(
        movementIntent.x * movementIntent.x +
          movementIntent.y * movementIntent.y
      );
      const normX = movementIntent.x / (length || 1);
      const normY = movementIntent.y / (length || 1);

      const acceleration = organism.speed * frameFactor * 0.9;
      organism.vx += normX * acceleration;
      organism.vy += normY * acceleration;

      const maxSpeed = organism.speed * 12;
      const currentSpeed = Math.sqrt(organism.vx * organism.vx + organism.vy * organism.vy);
      if (currentSpeed > maxSpeed) {
        const scale = maxSpeed / currentSpeed;
        organism.vx *= scale;
        organism.vy *= scale;
      }

      organism.rotation = Math.atan2(normY, normX);
    }

    const frictionBase = moving ? 0.92 : 0.78;
    const friction = frameFactor > 0 ? Math.pow(frictionBase, frameFactor) : frictionBase;
    organism.vx *= friction;
    organism.vy *= friction;

    organism.x += organism.vx;
    organism.y += organism.vy;

    organism.x = Math.max(organism.size, Math.min(worldSize - organism.size, organism.x));
    organism.y = Math.max(organism.size, Math.min(worldSize - organism.size, organism.y));

    if (camera) {
      camera.x += ((organism.x - camera.x) * 0.08) * delta * 60;
      camera.y += ((organism.y - camera.y) * 0.08) * delta * 60;
    }

    const currentDashCharge = Math.max(0, ensureNumber(organism.dashCharge, 0));
    const maxDashCharge = Math.max(
      0,
      ensureNumber(organism.maxDashCharge, Math.max(currentDashCharge, 100))
    );
    if (maxDashCharge > 0) {
      const dashCharge = Math.min(maxDashCharge, currentDashCharge);
      const dashRegenRate = Math.max(
        0,
        ensureNumber(organism.dashChargeRegenRate, 20)
      );
      const regeneratedCharge = dashCharge + dashRegenRate * delta;
      organism.dashCharge = Math.min(maxDashCharge, regeneratedCharge);
    } else {
      organism.dashCharge = currentDashCharge;
    }

    organism.attackCooldown = Math.max(
      0,
      ensureNumber(organism.attackCooldown, 0) - delta
    );
    organism.dashCooldown = Math.max(
      0,
      ensureNumber(organism.dashCooldown, 0) - delta
    );

    state.gameTime += delta;

    if (state.gameTime - state.lastSpawnTime > state.spawnInterval / 1000) {
      if (state.enemies.length < maxEnemiesAllowed) {
        spawnEnemy?.();
      }
      state.lastSpawnTime = state.gameTime;
      state.spawnInterval = Math.max(800, state.spawnInterval - 20);

      if (state.level % 5 === 0 && !state.bossPending) {
        state.bossPending = true;
        spawnBoss?.();
      }
    }

    const effects = state.effects || [];
    state.effects = effects.filter(effect => {
      effect.life -= delta;
      return effect.life > 0;
    });
  }

  const updatedNebulas = [];
  (state.nebulas || []).forEach(nebula => {
    const dx = nebula.x - organism.x;
    const dy = nebula.y - organism.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < nebula.radius + organism.size && !nebula.dispelled) {
      nebula.dispelled = true;
      nebula.dispelProgress = nebula.dispelProgress || 0;
      nebula.rotationSpeed *= 3;
      nebula.turbulence *= 2;
      const nebulaColorBase =
        nebula.color ?? nebulaTypes[nebula.type]?.color ?? 'rgba(20, 56, 81, ';
      const nebulaEffectColor =
        nebula.glow ?? nebulaTypes[nebula.type]?.glow ?? `${nebulaColorBase}0.6)`;
      addNotification(state, '🌫️ Nebulosa bioenergética dispersa!');
      createEffect(state, nebula.x, nebula.y, 'nebula', nebulaEffectColor);
      state.uiSyncTimer = Math.min(state.uiSyncTimer, 0.05);
    }

    nebula.rotation += nebula.rotationSpeed * delta;
    nebula.pulsePhase += delta;

    if (nebula.dispelled) {
      nebula.dispelProgress = (nebula.dispelProgress || 0) + delta * 0.5;
      if (nebula.dispelProgress >= 1) {
        return;
      }
    }

    updatedNebulas.push(nebula);
  });
  state.nebulas = updatedNebulas;

  state.obstacles = (state.obstacles || []).filter(obs => {
    obs.x += obs.vx;
    obs.y += obs.vy;
    obs.rotation += obs.rotationSpeed * delta;

    if (obs.x < -200 || obs.x > worldSize + 200) return false;
    if (obs.y < -200 || obs.y > worldSize + 200) return false;

    const dx = obs.x - organism.x;
    const dy = obs.y - organism.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < obs.size + organism.size) {
      const divisor = dist || 1;
      organism.vx -= (dx / divisor) * 10;
      organism.vy -= (dy / divisor) * 10;
      createEffect(state, obs.x, obs.y, 'impact', obs.color);
      obs.color = obs.hitColor;
      obs.hitPulse = 1;
      obs.rotationSpeed *= -1;
      playSound('impact');
    }

    if (obs.hitPulse > 0) {
      obs.hitPulse *= 0.85;
      if (obs.hitPulse < 0.01) {
        obs.hitPulse = 0;
      }
    }

    return true;
  });

  state.powerUps = (state.powerUps || []).filter(power => {
    power.pulse += delta * 3;

    const dx = power.x - organism.x;
    const dy = power.y - organism.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < organism.size + 24) {
      applyPowerUp?.(power.type);
      return false;
    }

    return true;
  });

  state.organicMatter = (state.organicMatter || []).filter(matter => {
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
      for (let i = 0; i < 5; i += 1) {
        createParticle(state, matter.x, matter.y, matter.color, 3);
      }
      return false;
    }

    return true;
  });

  if (state.organicMatter.length < 30 && Math.random() < 0.05) {
    spawnOrganicMatter?.(state, 1);
  }

  state.enemies = (state.enemies || []).filter(enemy => {
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

    enemy.x = Math.max(0, Math.min(worldSize, enemy.x));
    enemy.y = Math.max(0, Math.min(worldSize, enemy.y));

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

  if (state.enemies.length < maxEnemiesAllowed && Math.random() < 0.005) {
    spawnEnemy?.();
  }

  state.projectiles = (state.projectiles || []).filter(proj => {
    proj.x += proj.vx;
    proj.y += proj.vy;
    proj.life -= delta;

    if (proj.life <= 0) return false;

    if (
      proj.x < -50 ||
      proj.x > worldSize + 50 ||
      proj.y < -50 ||
      proj.y > worldSize + 50
    ) {
      return false;
    }

    for (let i = 0; i < state.enemies.length; i += 1) {
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

    return true;
  });
};

export default updateGameState;
