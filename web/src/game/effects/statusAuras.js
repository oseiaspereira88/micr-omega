import { STATUS_METADATA } from '../systems/statusEffects';

const TAU = Math.PI * 2;
const DEFAULT_COLOR = '#ffffff';

const activeAuras = new Map();
let processedEvents = new WeakSet();

const resolveStacks = (value) => {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.max(1, Math.round(value));
};

const resolveSize = (entity) => {
  if (!entity || !Number.isFinite(entity.size)) {
    return 20;
  }
  return Math.max(6, entity.size);
};

const computeRadius = (size, stacks) => size * (1.05 + Math.min(stacks, 6) * 0.2);
const computeInterval = (stacks) => Math.max(0.08, 0.32 / stacks);
const computeParticleCount = (stacks) => Math.max(6, Math.round(8 + stacks * 1.5));
const computeParticleLife = (stacks) => 0.9 + stacks * 0.18;
const computeParticleSize = (size, stacks) => Math.max(1.8, size * (0.2 + stacks * 0.05));
const computeRotationSpeed = (stacks) => 0.6 + stacks * 0.22;
const computePulseAmplitude = (stacks) => 0.2 + Math.min(0.55, stacks * 0.08);

const createStatusAura = (entity, config = {}) => {
  const stacks = resolveStacks(config.stacks);
  const size = resolveSize(entity);
  const color = typeof config.color === 'string' ? config.color : DEFAULT_COLOR;
  const duration = Number.isFinite(config.duration) ? Math.max(0, config.duration) : null;
  const now = Number.isFinite(config.now) ? config.now : Date.now() / 1000;

  return {
    entityId: entity.id,
    status: config.status ?? null,
    color,
    glowColor: color,
    stacks,
    remaining: duration,
    createdAt: now,
    updatedAt: now,
    timer: 0,
    interval: computeInterval(stacks),
    radius: computeRadius(size, stacks),
    particleCount: computeParticleCount(stacks),
    particleLife: computeParticleLife(stacks),
    particleFade: 0.03,
    particleSize: computeParticleSize(size, stacks),
    particleDrift: 0.35 + stacks * 0.05,
    rotationSpeed: computeRotationSpeed(stacks),
    baseAngle: Math.random() * TAU,
    variance: Math.PI / 12,
    glowStrength: 0.75 + stacks * 0.3,
    pulseSpeed: 3 + stacks * 0.55,
    pulseAmplitude: computePulseAmplitude(stacks),
  };
};

const syncAuraProperties = (aura, entity, config = {}) => {
  const stacks = resolveStacks(config.stacks ?? aura.stacks ?? 1);
  const size = resolveSize(entity);
  const color = typeof config.color === 'string' ? config.color : aura.color ?? DEFAULT_COLOR;
  if (config.status) {
    aura.status = config.status;
  }
  aura.color = color;
  aura.glowColor = color;
  aura.stacks = stacks;
  aura.interval = computeInterval(stacks);
  aura.radius = computeRadius(size, stacks);
  aura.particleCount = computeParticleCount(stacks);
  aura.particleLife = computeParticleLife(stacks);
  aura.particleSize = computeParticleSize(size, stacks);
  aura.particleDrift = 0.35 + stacks * 0.05;
  aura.rotationSpeed = computeRotationSpeed(stacks);
  aura.glowStrength = 0.75 + stacks * 0.3;
  aura.pulseSpeed = 3 + stacks * 0.55;
  aura.pulseAmplitude = computePulseAmplitude(stacks);

  if (config.duration === null) {
    aura.remaining = null;
  } else if (Number.isFinite(config.duration)) {
    aura.remaining = Math.max(0, config.duration);
  }

  if (Number.isFinite(config.now)) {
    aura.updatedAt = config.now;
  } else {
    aura.updatedAt = Date.now() / 1000;
  }

  return aura;
};

const createStatusAuraBatch = (entity, aura, createParticle, baseAngle) => {
  const particles = [];
  if (typeof createParticle !== 'function') {
    return particles;
  }
  const { particleCount, radius, color, particleLife, particleFade, particleSize, particleDrift } = aura;

  for (let index = 0; index < particleCount; index += 1) {
    const spread = (Math.random() - 0.5) * aura.variance;
    const angle = baseAngle + (index / particleCount) * TAU + spread;
    const distance = radius * (0.9 + Math.random() * 0.2);
    const x = entity.x + Math.cos(angle) * distance;
    const y = entity.y + Math.sin(angle) * distance;

    const particle = createParticle(x, y, {
      color,
      life: particleLife,
      size: particleSize,
      fade: particleFade,
      gravity: 0,
      speed: particleDrift,
      angle,
      blend: 'lighter',
      orientation: angle,
      glowStrength: aura.glowStrength,
      glowColor: aura.glowColor,
      pulseSpeed: aura.pulseSpeed,
      pulseAmplitude: aura.pulseAmplitude,
    });

    if (particle) {
      particles.push(particle);
    }
  }

  return particles;
};

export const upsertStatusAura = (entity, auraConfig = {}) => {
  if (!entity || !entity.id) {
    return null;
  }

  const existing = activeAuras.get(entity.id);
  if (existing) {
    return syncAuraProperties(existing, entity, auraConfig);
  }

  const aura = createStatusAura(entity, auraConfig);
  activeAuras.set(entity.id, aura);
  return aura;
};

export const removeStatusAura = (entityId) => {
  if (!entityId) {
    return false;
  }
  return activeAuras.delete(entityId);
};

const buildEntityIndex = (entities) => {
  const index = new Map();
  if (!Array.isArray(entities)) {
    return index;
  }
  entities.forEach((entity) => {
    if (entity && entity.id) {
      index.set(entity.id, entity);
    }
  });
  return index;
};

const shouldTrackStatus = (statusKey) => {
  const metadata = STATUS_METADATA[statusKey];
  if (!metadata) {
    return false;
  }
  const dot = metadata.dot;
  return Boolean(dot && Number.isFinite(dot.damagePerSecond) && dot.damagePerSecond > 0);
};

export const updateStatusAuras = (state, delta, context = {}) => {
  if (!state) {
    return;
  }

  const normalizedDelta = Number.isFinite(delta) ? Math.max(0, delta) : 0;
  const events = Array.isArray(context.events) ? context.events : [];
  const nowSeconds = Number.isFinite(context.now)
    ? context.now / 1000
    : Number.isFinite(context.nowSeconds)
    ? context.nowSeconds
    : Date.now() / 1000;

  const entityIndex = buildEntityIndex(state.worldView?.microorganisms);

  events.forEach((event) => {
    if (!event || processedEvents.has(event)) {
      return;
    }
    processedEvents.add(event);

    if (event.targetKind !== 'microorganism') {
      return;
    }

    const entityId = event.targetObjectId;
    if (!entityId) {
      return;
    }

    const metadata = STATUS_METADATA[event.status];
    if (!shouldTrackStatus(event.status)) {
      removeStatusAura(entityId);
      return;
    }

    const stacks = Number.isFinite(event.stacks) ? event.stacks : 0;
    if (stacks <= 0) {
      removeStatusAura(entityId);
      return;
    }

    const entity = entityIndex.get(entityId);
    if (!entity) {
      removeStatusAura(entityId);
      return;
    }

    const duration = Number.isFinite(event.durationMs)
      ? Math.max(0, event.durationMs) / 1000
      : Number.isFinite(metadata?.duration)
      ? metadata.duration
      : null;

    upsertStatusAura(entity, {
      status: event.status,
      color: metadata?.color,
      stacks,
      duration,
      now: nowSeconds,
    });
  });

  const particlesTarget = Array.isArray(state.particles) ? state.particles : null;

  activeAuras.forEach((aura, entityId) => {
    const entity = entityIndex.get(entityId);
    if (!entity) {
      activeAuras.delete(entityId);
      return;
    }

    if (Number.isFinite(aura.remaining)) {
      aura.remaining = Math.max(0, aura.remaining - normalizedDelta);
      if (aura.remaining <= 0) {
        activeAuras.delete(entityId);
        return;
      }
    }

    aura.timer += normalizedDelta;
    const baseAngle = aura.baseAngle;

    if (particlesTarget && typeof context.createParticle === 'function') {
      const batches = aura.interval > 0 ? Math.floor(aura.timer / aura.interval) : 0;
      if (batches > 0) {
        aura.timer -= aura.interval * batches;
        for (let batchIndex = 0; batchIndex < batches; batchIndex += 1) {
          const offsetAngle = baseAngle + aura.rotationSpeed * aura.interval * batchIndex;
          const batch = createStatusAuraBatch(
            entity,
            aura,
            context.createParticle,
            offsetAngle,
          );
          if (batch.length > 0) {
            particlesTarget.push(...batch);
          }
        }
      }
    }

    aura.baseAngle = (baseAngle + aura.rotationSpeed * normalizedDelta) % TAU;
    aura.updatedAt = nowSeconds;
  });
};

export const __statusAuraTestUtils = {
  reset() {
    activeAuras.clear();
    processedEvents = new WeakSet();
  },
  getActive() {
    return activeAuras;
  },
};

export default updateStatusAuras;
