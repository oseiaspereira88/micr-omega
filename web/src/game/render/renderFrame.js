import { backgroundRenderer } from './backgroundRenderer.js';
import { enemyRenderer } from './enemyRenderer.js';
import { organismRenderer } from './organismRenderer.js';
import { hudRenderer } from './hudRenderer.js';
import { effectsRenderer } from './effectsRenderer.js';

export const renderFrame = (ctx, state, camera, assets = {}) => {
  if (!ctx || !state || !camera) return;

  const { canvas, delta = 0, drawWorld } = assets;
  const viewport = assets.viewport || {
    width: canvas?.width ?? camera.viewport?.width ?? 0,
    height: canvas?.height ?? camera.viewport?.height ?? 0,
  };

  const extendedCamera = { ...camera, viewport };

  backgroundRenderer.render(
    ctx,
    {
      backgroundLayers: state.backgroundLayers,
      lightRays: state.lightRays,
      microorganisms: state.microorganisms,
      glowParticles: state.glowParticles,
      floatingParticles: state.floatingParticles,
    },
    extendedCamera
  );

  if (typeof drawWorld === 'function') {
    drawWorld({ ctx, state, camera: extendedCamera, viewport });
  }

  enemyRenderer.render(ctx, { enemies: state.enemies }, extendedCamera);
  organismRenderer.render(
    ctx,
    {
      organism: state.organism,
      activePowerUps: state.activePowerUps,
      pulsePhase: state.pulsePhase,
    },
    extendedCamera
  );

  const effectsResult = effectsRenderer.render(
    ctx,
    {
      effects: state.effects,
      particles: state.particles,
      fogIntensity: state.fogIntensity,
    },
    extendedCamera,
    { delta, viewport }
  );

  if (effectsResult) {
    state.effects = effectsResult.effects;
    state.particles = effectsResult.particles;
  }

  const hudResult = hudRenderer.render(
    ctx,
    {
      worldSize: state.worldSize,
      organism: state.organism,
      nebulas: state.nebulas,
      obstacles: state.obstacles,
      powerUps: state.powerUps,
      enemies: state.enemies,
      notifications: state.notifications,
    },
    extendedCamera,
    { delta, viewport }
  );

  if (hudResult) {
    state.notifications = hudResult.notifications;
  }
};
