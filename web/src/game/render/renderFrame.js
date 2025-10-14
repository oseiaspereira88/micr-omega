import { backgroundRenderer } from './backgroundRenderer.js';
import { organismRenderer } from './organismRenderer.js';
import { effectsRenderer } from './effectsRenderer.js';
import { enemyRenderer } from './enemyRenderer.js';
import { withCameraTransform } from './utils/cameraHelpers.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const mapMicroorganismsToEnemies = (microorganisms = []) =>
  microorganisms.map((entity) => ({
    id: entity.id,
    x: entity.x,
    y: entity.y,
    size: entity.size,
    color: entity.color,
    coreColor: entity.coreColor ?? entity.color,
    outerColor: entity.outerColor ?? entity.color,
    shadowColor: entity.shadowColor ?? entity.outerColor ?? entity.color,
    health: entity.health ?? entity.maxHealth ?? 0,
    maxHealth: entity.maxHealth ?? entity.health ?? 0,
    boss: Boolean(entity.boss),
    animPhase: entity.animPhase ?? 0,
  }));

const renderWorldEntities = (ctx, worldView, camera) => {
  if (!ctx || !worldView || !camera) return;

  const { microorganisms = [], organicMatter = [], obstacles = [], roomObjects = [] } = worldView;
  const viewport = camera.viewport || {};
  const width = viewport.width ?? 0;
  const height = viewport.height ?? 0;
  const offsetX = camera.offsetX ?? camera.x - width / 2;
  const offsetY = camera.offsetY ?? camera.y - height / 2;

  withCameraTransform(ctx, camera, () => {
    microorganisms.forEach((entity) => {
      const screenX = entity.x - offsetX;
      const screenY = entity.y - offsetY;
      const size = clamp(entity.size ?? 6, 3, 18);
      const pulse = (Math.sin(entity.animPhase || 0) + 1) * 0.5;
      entity.animPhase = (entity.animPhase || 0) + 0.04;

      ctx.save();
      ctx.translate(screenX, screenY);
      ctx.globalAlpha = 0.5 + pulse * 0.4;
      ctx.fillStyle = entity.color ?? '#8fb8ff';
      ctx.beginPath();
      ctx.arc(0, 0, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    organicMatter.forEach((entity) => {
      const screenX = entity.x - offsetX;
      const screenY = entity.y - offsetY;
      const quantity = clamp(entity.quantity ?? 0, 0, 100);
      const radius = 6 + Math.sqrt(quantity);

      ctx.save();
      ctx.translate(screenX, screenY);
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#f0e17a';
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#d4c25a';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    });

    obstacles.forEach((obstacle) => {
      const screenX = obstacle.x - offsetX;
      const screenY = obstacle.y - offsetY;
      const halfWidth = (obstacle.width ?? 60) / 2;
      const halfHeight = (obstacle.height ?? 60) / 2;

      ctx.save();
      ctx.translate(screenX, screenY);
      ctx.rotate(obstacle.orientation ?? 0);
      ctx.fillStyle = obstacle.impassable ? '#254055' : '#345f7a';
      ctx.globalAlpha = 0.9;
      ctx.fillRect(-halfWidth, -halfHeight, halfWidth * 2, halfHeight * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 2;
      ctx.strokeRect(-halfWidth, -halfHeight, halfWidth * 2, halfHeight * 2);
      ctx.restore();
    });

    roomObjects.forEach((object) => {
      const screenX = object.x - offsetX;
      const screenY = object.y - offsetY;

      ctx.save();
      ctx.translate(screenX, screenY);
      ctx.fillStyle = '#7f5af0';
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#f5f3ff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    });
  });
};

export const renderFrame = (ctx, state, camera, assets = {}) => {
  if (!ctx || !state || !camera) return;

  const { canvas, delta = 0 } = assets;
  const viewport = assets.viewport || {
    width: canvas?.width ?? camera.viewport?.width ?? 0,
    height: canvas?.height ?? camera.viewport?.height ?? 0,
  };

  const extendedCamera = { ...camera, viewport };

  backgroundRenderer.render(ctx, state.background, extendedCamera);
  renderWorldEntities(ctx, state.worldView, extendedCamera);
  enemyRenderer.render(
    ctx,
    { enemies: mapMicroorganismsToEnemies(state.worldView?.microorganisms) },
    extendedCamera
  );
  organismRenderer.render(
    ctx,
    {
      players: state.players,
      combatIndicators: state.combatIndicators,
      localPlayerId: state.localPlayerId,
      pulsePhase: state.pulsePhase ?? 0,
    },
    extendedCamera
  );

  const effectsResult = effectsRenderer.render(
    ctx,
    {
      effects: state.effects,
      particles: state.particles,
      fogIntensity: 0,
    },
    extendedCamera,
    { delta, viewport }
  );

  if (effectsResult) {
    state.effects = effectsResult.effects;
    state.particles = effectsResult.particles;
    return effectsResult;
  }

  return null;
};
