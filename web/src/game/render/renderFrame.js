import { WORLD_SIZE } from '@micr-omega/shared';

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
    name: entity.name,
    level: entity.level,
    species: entity.species,
    aggression: entity.aggression,
    attributes: entity.attributes,
    palette: entity.palette,
    accentColor: entity.accentColor,
    detailColor: entity.detailColor,
    glowColor: entity.glowColor,
    hpFillColor: entity.hpFillColor,
    hpBorderColor: entity.hpBorderColor,
    labelColor: entity.labelColor,
    labelBackground: entity.labelBackground,
    label: entity.label,
    threatTier: entity.threatTier,
  }));

const renderWorldEntities = (ctx, worldView, camera) => {
  if (!ctx || !worldView || !camera) return;

  const { organicMatter = [], obstacles = [], roomObjects = [] } = worldView;
  const viewport = camera.viewport || {};
  const width = viewport.width ?? 0;
  const height = viewport.height ?? 0;
  const offsetX = camera.offsetX ?? camera.x - width / 2;
  const offsetY = camera.offsetY ?? camera.y - height / 2;

  withCameraTransform(ctx, camera, () => {
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

const clampValue = (value, min, max) => Math.min(max, Math.max(min, value));

const drawMinimap = (ctx, state, camera, options = {}) => {
  const { settings, viewport: viewportOverride, worldSize = WORLD_SIZE } = options;
  if (!ctx || !state || !camera) return;
  if (!settings?.showMinimap) return;

  const viewport = camera.viewport || viewportOverride || {};
  const width = viewport.width ?? 0;
  const height = viewport.height ?? 0;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return;
  }

  const size = options.size ?? 160;
  const padding = options.padding ?? 18;
  const originX = Math.max(8, width - size - padding);
  const originY = Math.max(8, padding);

  const safeWorldSize = Number.isFinite(worldSize) && worldSize > 0 ? worldSize : WORLD_SIZE;
  const worldRadius = safeWorldSize / 2;
  const scale = size / safeWorldSize;

  const projectCoordinate = (value) =>
    clampValue((value ?? 0) + worldRadius, 0, safeWorldSize) * scale;

  const worldView = state.worldView || {};
  const microorganisms = Array.isArray(worldView.microorganisms) ? worldView.microorganisms : [];
  const organicMatter = Array.isArray(worldView.organicMatter) ? worldView.organicMatter : [];
  const obstacles = Array.isArray(worldView.obstacles) ? worldView.obstacles : [];
  const roomObjects = Array.isArray(worldView.roomObjects) ? worldView.roomObjects : [];

  const players = Array.isArray(state.players) ? state.players : [];
  const localPlayerId = state.localPlayerId;

  ctx.save();
  ctx.translate(originX, originY);

  ctx.fillStyle = 'rgba(8, 12, 24, 0.82)';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(0, 217, 255, 0.45)';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, size, size);

  const drawCircle = (x, y, radius, color, alpha = 1) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return;
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = clampValue(alpha, 0, 1);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(1.5, radius), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  obstacles.forEach((obstacle) => {
    const centerX = projectCoordinate(obstacle?.x);
    const centerY = projectCoordinate(obstacle?.y);
    const widthWorld = Number.isFinite(obstacle?.width) ? obstacle.width : 40;
    const heightWorld = Number.isFinite(obstacle?.height) ? obstacle.height : 40;
    const drawWidth = Math.max(3, widthWorld * scale);
    const drawHeight = Math.max(3, heightWorld * scale);

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(Number.isFinite(obstacle?.orientation) ? obstacle.orientation : 0);
    ctx.fillStyle = obstacle?.impassable ? 'rgba(120, 60, 180, 0.85)' : 'rgba(70, 140, 220, 0.7)';
    ctx.fillRect(-drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    ctx.restore();
  });

  organicMatter.forEach((entity) => {
    const x = projectCoordinate(entity?.x);
    const y = projectCoordinate(entity?.y);
    const magnitude = Number.isFinite(entity?.quantity) ? entity.quantity : 0;
    const radius = Math.max(1.5, Math.min(4, (magnitude / 6) * scale));
    const buffColor = entity?.attributeBuff?.color;
    const fillColor = buffColor ?? 'rgba(255, 214, 94, 0.9)';
    const alpha = buffColor ? 1 : 0.9;
    drawCircle(x, y, radius, fillColor, alpha);
  });

  roomObjects.forEach((object) => {
    const x = projectCoordinate(object?.x);
    const y = projectCoordinate(object?.y);
    drawCircle(x, y, 3, 'rgba(91, 142, 255, 0.9)', 0.85);
  });

  microorganisms.forEach((micro) => {
    const x = projectCoordinate(micro?.x);
    const y = projectCoordinate(micro?.y);
    const isBoss = Boolean(micro?.boss);
    const color = isBoss ? 'rgba(255, 85, 119, 0.95)' : 'rgba(255, 170, 51, 0.9)';
    const radius = isBoss ? 3.5 : 2;
    drawCircle(x, y, radius, color, isBoss ? 1 : 0.85);
  });

  players
    .filter((player) => player && player.id !== localPlayerId)
    .forEach((player) => {
      const position = player.renderPosition || player.position || {};
      const x = projectCoordinate(position.x);
      const y = projectCoordinate(position.y);
      const palette = player.palette || {};
      const color = palette.base || 'rgba(180, 200, 255, 0.85)';
      drawCircle(x, y, 3, color, 0.85);
    });

  const localPlayer = players.find((player) => player?.id === localPlayerId) || null;
  if (localPlayer) {
    const position = localPlayer.renderPosition || localPlayer.position || {};
    const x = projectCoordinate(position.x);
    const y = projectCoordinate(position.y);
    drawCircle(x, y, 4, 'rgba(0, 217, 255, 1)', 1);
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = 'rgba(0, 217, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  const zoom = Number.isFinite(camera.zoom) && camera.zoom > 0 ? camera.zoom : 1;
  const viewportWidthWorld = (camera.viewport?.width ?? width) / zoom;
  const viewportHeightWorld = (camera.viewport?.height ?? height) / zoom;
  const cameraX = Number.isFinite(camera.x) ? camera.x : 0;
  const cameraY = Number.isFinite(camera.y) ? camera.y : 0;
  const viewLeft = clampValue(cameraX - viewportWidthWorld / 2 + worldRadius, 0, safeWorldSize);
  const viewTop = clampValue(cameraY - viewportHeightWorld / 2 + worldRadius, 0, safeWorldSize);
  const viewWidth = Math.min(viewportWidthWorld, safeWorldSize);
  const viewHeight = Math.min(viewportHeightWorld, safeWorldSize);

  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(viewLeft * scale, viewTop * scale, viewWidth * scale, viewHeight * scale);
  ctx.restore();

  ctx.restore();
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
    {
      enemies: mapMicroorganismsToEnemies(state.worldView?.microorganisms),
      damagePopups: Array.isArray(state.damagePopups) ? state.damagePopups : [],
    },
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

  drawMinimap(ctx, state, extendedCamera, {
    settings: assets.settings,
    viewport,
    worldSize: state.worldSize ?? WORLD_SIZE,
  });

  if (effectsResult) {
    state.effects = effectsResult.effects;
    state.particles = effectsResult.particles;
    return effectsResult;
  }

  return null;
};
