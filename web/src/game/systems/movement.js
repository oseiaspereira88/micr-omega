import {
  STATUS_METADATA,
  getStatusEffectVisual,
  getStatusHudSnapshot,
  getStatusMovementMultiplier,
  tickStatusEffects,
} from './statusEffects';

export const performDash = (state, helpers = {}) => {
  if (!state) return state;

  const {
    playSound,
    createEffect,
    createParticle,
    syncState
  } = helpers;

  const organism = state.organism;
  if (!organism) return state;

  if (organism.dashCharge < 30 || organism.dashCooldown > 0 || organism.isDashing) {
    return state;
  }

  organism.dashCharge = Math.max(0, organism.dashCharge - 30);
  const dashDuration = 0.3;
  organism.dashTimer = Math.max(dashDuration, organism.dashTimer || 0);
  organism.isDashing = true;
  organism.invulnerable = true;

  const dashSpeed = 25 * organism.speed * (organism.currentSpeedMultiplier || 1);
  const currentSpeed = Math.sqrt(organism.vx * organism.vx + organism.vy * organism.vy);
  const joystick = state.joystick || {};
  const intentX = typeof joystick.x === 'number' ? joystick.x : 0;
  const intentY = typeof joystick.y === 'number' ? joystick.y : 0;
  const intentMagnitude = Math.sqrt(intentX * intentX + intentY * intentY);
  const hasIntent = intentMagnitude > 0.001;

  let directionX;
  let directionY;

  if (currentSpeed > 0.5) {
    const normalizedVx = organism.vx / currentSpeed;
    const normalizedVy = organism.vy / currentSpeed;
    directionX = normalizedVx;
    directionY = normalizedVy;
  } else if (hasIntent) {
    directionX = intentX / (intentMagnitude || 1);
    directionY = intentY / (intentMagnitude || 1);
  } else {
    directionX = Math.cos(organism.angle);
    directionY = Math.sin(organism.angle);
  }

  organism.vx = directionX * dashSpeed;
  organism.vy = directionY * dashSpeed;

  const dashAngle = Math.atan2(directionY, directionX);
  if (Number.isFinite(dashAngle)) {
    organism.rotation = dashAngle;
    if (typeof organism.targetAngle === 'number') {
      organism.targetAngle = dashAngle;
    }
  }

  playSound?.('dash');
  createEffect?.(state, organism.x, organism.y, 'dashstart', organism.color);

  for (let i = 0; i < 10; i++) {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * 20;
    createParticle?.(
      state,
      organism.x + Math.cos(angle) * distance,
      organism.y + Math.sin(angle) * distance,
      organism.color,
      6
    );
  }

  syncState?.(state);
  return state;
};

export const updateOrganismPhysics = (state, helpers = {}, delta = 0) => {
  if (!state) return state;
  const organism = state.organism;
  if (!organism) return state;

  const { createParticle, addNotification, syncState, createEffect } = helpers;

  const statusResult = tickStatusEffects(
    organism,
    delta,
    {
      onDamage: ({ damage, status }) => {
        const normalizedDamage = Math.max(0, damage);
        if (normalizedDamage <= 0) return;
        state.health = Math.max(0, state.health - normalizedDamage);
        state.uiSyncTimer = Math.min(state.uiSyncTimer, 0.05);
        const visualType = getStatusEffectVisual(status);
        const color = STATUS_METADATA[status]?.color ?? '#ffffff';
        createEffect?.(state, organism.x, organism.y, visualType, color);
      },
      onExpire: ({ status }) => {
        const label = STATUS_METADATA[status]?.label ?? status;
        addNotification?.(state, `${label} dissipou.`);
      },
    }
  );

  if (statusResult.totalDamage >= 1) {
    addNotification?.(state, `-${Math.round(statusResult.totalDamage)} por estados`);
  }
  state.statusEffects = getStatusHudSnapshot(organism);

  const previousDashTimer = Math.max(0, organism.dashTimer || 0);
  const wasDashing = Boolean(organism.isDashing || previousDashTimer > 0);
  const updatedDashTimer = Math.max(0, previousDashTimer - delta);
  organism.dashTimer = updatedDashTimer;
  const dashActive = updatedDashTimer > 0;
  organism.isDashing = dashActive;

  if (dashActive) {
    organism.invulnerable = true;
  }

  if (wasDashing && !dashActive) {
    organism.invulnerable = Boolean(organism.invulnerableFromPowerUp);
    organism.dashCooldown = Math.max(organism.dashCooldown || 0, 1);
    createEffect?.(state, organism.x, organism.y, 'dashend', organism.color);
  }

  if (organism.dying) {
    organism.deathTimer -= delta;
    organism.rotation += delta * 5;
    organism.size *= 0.98;

    if (organism.deathTimer <= 0) {
      state.gameOver = true;
      syncState?.(state);
    }

    return state;
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

    addNotification?.(state, `${power.name} dissipou.`);
    state.uiSyncTimer = Math.min(state.uiSyncTimer, 0.05);
    return false;
  });

  const statusSpeedMultiplier = getStatusMovementMultiplier(organism);
  const combinedSpeedMultiplier = speedMultiplier * statusSpeedMultiplier;

  organism.currentSpeedMultiplier = combinedSpeedMultiplier;
  organism.currentAttackBonus = attackBonus;
  organism.currentRangeBonus = rangeBonus;
  organism.hasShieldPowerUp = invincibilityActive;
  organism.invulnerableFromPowerUp = invincibilityActive;

  const friction = dashActive ? 0.99 : 0.92;
  const baseSpeed = dashActive
    ? 20 * combinedSpeedMultiplier
    : 5 * organism.speed * combinedSpeedMultiplier;
  const maxSpeed = baseSpeed;

  const joystick = state.joystick;

  if (joystick.active && !organism.isDashing) {
    organism.vx += joystick.x * 0.5;
    organism.vy += joystick.y * 0.5;

    if (joystick.x !== 0 || joystick.y !== 0) {
      organism.targetAngle = Math.atan2(joystick.y, joystick.x);
    }
  }

  let angleDiff = organism.targetAngle - organism.angle;
  while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
  while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
  organism.angle += angleDiff * 0.1;

  organism.vx *= friction;
  organism.vy *= friction;

  const speed = Math.sqrt(organism.vx * organism.vx + organism.vy * organism.vy);
  if (!dashActive && speed > maxSpeed) {
    organism.vx = (organism.vx / speed) * maxSpeed;
    organism.vy = (organism.vy / speed) * maxSpeed;
  }

  organism.x += organism.vx;
  organism.y += organism.vy;

  organism.x = Math.max(organism.size, Math.min(4000 - organism.size, organism.x));
  organism.y = Math.max(organism.size, Math.min(4000 - organism.size, organism.y));

  const speedFactor = Math.min(speed / maxSpeed, 1);

  organism.swimPhase += delta * (3 + speedFactor * 5);
  organism.bodyWave = Math.sin(organism.swimPhase) * speedFactor * 0.08;
  organism.pulseIntensity = 1 + Math.sin(organism.swimPhase * 0.5) * speedFactor * 0.05;

  if (speedFactor > 0.1) {
    const tiltAmount = speedFactor * 0.1;
    organism.tiltX = Math.sin(organism.swimPhase) * tiltAmount;
    organism.tiltY = Math.cos(organism.swimPhase * 1.3) * tiltAmount;
  } else {
    organism.tiltX *= 0.9;
    organism.tiltY *= 0.9;
  }

  if (speed > 1) {
    if (
      organism.trail.length === 0 ||
      Math.sqrt(
        (organism.x - organism.trail[organism.trail.length - 1].x) ** 2 +
        (organism.y - organism.trail[organism.trail.length - 1].y) ** 2
      ) > 5
    ) {
      organism.trail.push({
        x: organism.x,
        y: organism.y,
        life: 1,
        size: organism.size * 0.8,
        color: organism.color
      });
      if (organism.trail.length > 20) organism.trail.shift();
    }
  }

  organism.trail = organism.trail
    .map(trail => ({ ...trail, life: trail.life - delta * 1.5 }))
    .filter(trail => trail.life > 0);

  if (organism.isDashing) {
    for (let i = 0; i < 3; i++) {
      createParticle?.(state, organism.x, organism.y, organism.color, 4);
    }
  }

  if (organism.dashCharge < organism.maxDashCharge) {
    organism.dashCharge = Math.min(organism.maxDashCharge, organism.dashCharge + delta * 20);
  }

  organism.dashCooldown = Math.max(0, organism.dashCooldown - delta);

  organism.eyeBlinkTimer += delta;
  if (organism.eyeBlinkTimer > 3 + Math.random() * 2) {
    organism.eyeBlinkState = 1;
    organism.eyeBlinkTimer = 0;
  }

  if (organism.eyeBlinkState > 0) {
    organism.eyeBlinkState -= delta * 8;
    if (organism.eyeBlinkState < 0) organism.eyeBlinkState = 0;
  }

  if (speed > 0.5) {
    const targetLookX = (organism.vx / maxSpeed) * 0.5;
    const targetLookY = (organism.vy / maxSpeed) * 0.5;
    organism.eyeLookX += (targetLookX - organism.eyeLookX) * 0.1;
    organism.eyeLookY += (targetLookY - organism.eyeLookY) * 0.1;
  } else {
    organism.eyeLookX *= 0.9;
    organism.eyeLookY *= 0.9;
  }

  organism.attackCooldown = Math.max(0, organism.attackCooldown - delta);

  Object.keys(organism.skillCooldowns).forEach(key => {
    organism.skillCooldowns[key] = Math.max(0, organism.skillCooldowns[key] - delta);
  });

  if (state.combo > 0) {
    state.comboTimer -= delta;
    if (state.comboTimer <= 0) {
      state.combo = 0;
      state.comboTimer = 0;
      state.uiSyncTimer = Math.min(state.uiSyncTimer, 0.05);
    }
  }

  return state;
};
