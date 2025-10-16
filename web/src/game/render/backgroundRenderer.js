import { WORLD_SIZE } from '@micr-omega/shared';

import {
  getCameraViewMetrics,
  withCameraTransform,
} from './utils/cameraHelpers.js';

const normalizeAngle = (angle) => {
  let result = angle;
  while (result > Math.PI) {
    result -= Math.PI * 2;
  }
  while (result < -Math.PI) {
    result += Math.PI * 2;
  }
  return result;
};

const wrapCoordinate = (value) => {
  if (!Number.isFinite(value)) return 0;
  let result = value % WORLD_SIZE;
  if (result < 0) {
    result += WORLD_SIZE;
  }
  return result;
};

const applySpawnOffset = (entity, camera) => {
  if (!entity) return;

  const hasOffset = Number.isFinite(entity.spawnOffsetX) || Number.isFinite(entity.spawnOffsetY);
  if (!hasOffset) {
    return;
  }

  const anchorX = Number.isFinite(entity.anchorX) ? entity.anchorX : camera?.x ?? 0;
  const anchorY = Number.isFinite(entity.anchorY) ? entity.anchorY : camera?.y ?? 0;

  if (Number.isFinite(entity.spawnOffsetX)) {
    entity.x = wrapCoordinate(anchorX + entity.spawnOffsetX);
  }
  if (Number.isFinite(entity.spawnOffsetY)) {
    entity.y = wrapCoordinate(anchorY + entity.spawnOffsetY);
  }

  entity.spawnOffsetX = null;
  entity.spawnOffsetY = null;
  entity.anchorX = anchorX;
  entity.anchorY = anchorY;
};

export const backgroundRenderer = {
  render(ctx, state, camera) {
    if (!ctx) return;

    const viewport = camera.viewport || {};
    const width = viewport.width ?? 0;
    const height = viewport.height ?? 0;
    const {
      backgroundLayers = [],
      lightRays = [],
      microorganisms = [],
      glowParticles = [],
      floatingParticles = [],
    } = state;

    const gradient = ctx.createRadialGradient(
      width / 2,
      height / 2,
      0,
      width / 2,
      height / 2,
      Math.max(width, height)
    );
    gradient.addColorStop(0, '#0d1f2d');
    gradient.addColorStop(0.3, '#0a1820');
    gradient.addColorStop(0.6, '#071218');
    gradient.addColorStop(1, '#030a0f');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const { halfWidth, halfHeight, centerX, centerY } = getCameraViewMetrics(camera);

    withCameraTransform(ctx, camera, () => {
      backgroundLayers.forEach((layer) => {
        applySpawnOffset(layer, camera);
        layer.pulsePhase += 0.01;
        const pulse = Math.sin(layer.pulsePhase) * 0.5 + 0.5;
        const depth = layer.depth ?? 1;

        const dx = (layer.x - centerX) * depth;
        const dy = (layer.y - centerY) * depth;
        if (Math.abs(dx) > halfWidth + layer.size || Math.abs(dy) > halfHeight + layer.size) {
          return;
        }

        const screenX = layer.x - camera.offsetX * depth;
        const screenY = layer.y - camera.offsetY * depth;

        const layerGradient = ctx.createRadialGradient(
          screenX,
          screenY,
          0,
          screenX,
          screenY,
          layer.size
        );
        layerGradient.addColorStop(0, layer.color);
        layerGradient.addColorStop(1, 'transparent');

        ctx.fillStyle = layerGradient;
        ctx.globalAlpha = layer.opacity * pulse;
        ctx.fillRect(screenX - layer.size, screenY - layer.size, layer.size * 2, layer.size * 2);
      });
      ctx.globalAlpha = 1;

      lightRays.forEach((ray) => {
        applySpawnOffset(ray, camera);
        ray.y += ray.speed;
        if (ray.y > WORLD_SIZE) ray.y = -200;

        const parallax = 0.3;
        const dx = (ray.x - centerX) * parallax;
        const dy = (ray.y - centerY) * parallax;
        if (Math.abs(dx) > halfWidth + ray.width || Math.abs(dy) > halfHeight + ray.length) {
          return;
        }

        const screenX = ray.x - camera.offsetX * parallax;
        const screenY = ray.y - camera.offsetY * parallax;

        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.rotate(ray.angle);

        const rayGradient = ctx.createLinearGradient(0, 0, 0, ray.length);
        rayGradient.addColorStop(0, `rgba(100, 200, 255, ${ray.opacity})`);
        rayGradient.addColorStop(0.5, `rgba(100, 200, 255, ${ray.opacity * 0.5})`);
        rayGradient.addColorStop(1, 'transparent');

        ctx.fillStyle = rayGradient;
        ctx.fillRect(-ray.width / 2, 0, ray.width, ray.length);
        ctx.restore();
      });

      microorganisms.forEach((micro) => {
        applySpawnOffset(micro, camera);
        micro.animPhase += 0.05;
        micro.updateFrame = (micro.updateFrame + 1) % micro.updateStride;

        if (micro.updateFrame === 0) {
          micro.headingTimer -= 1;
          micro.speedTimer -= 1;
          micro.noiseOffset += micro.noiseSpeed;
          const noise = Math.sin(micro.noiseOffset) * 0.5 + Math.sin(micro.noiseOffset * 0.73) * 0.5;
          const noiseHeading = noise * micro.noiseHeadingScale;
          const noiseSpeed = noise * micro.noiseSpeedScale;

          if (micro.headingTimer <= 0) {
            micro.headingInterval = 90 + Math.random() * 180;
            micro.headingTimer = micro.headingInterval;
            micro.targetHeading =
              micro.heading + (Math.random() - 0.5) * micro.headingVariance + noiseHeading;
          }

          if (micro.speedTimer <= 0) {
            micro.speedInterval = 150 + Math.random() * 200;
            micro.speedTimer = micro.speedInterval;
            micro.targetSpeed = Math.max(
              0.05,
              micro.baseSpeed * (0.6 + Math.random() * 0.8) + noiseSpeed * micro.baseSpeed
            );
          }

          const edgeMargin = micro.edgeMargin ?? 160;
          if (
            micro.x < edgeMargin ||
            micro.x > WORLD_SIZE - edgeMargin ||
            micro.y < edgeMargin ||
            micro.y > WORLD_SIZE - edgeMargin
          ) {
            const inwardHeading = Math.atan2(micro.homeY - micro.y, micro.homeX - micro.x);
            micro.targetHeading = inwardHeading;
            micro.targetSpeed = Math.max(micro.targetSpeed, micro.baseSpeed * 0.9);
            micro.headingTimer = Math.min(micro.headingTimer, micro.headingInterval * 0.5);
          }

          const headingDelta = normalizeAngle(micro.targetHeading - micro.heading);
          micro.heading += headingDelta * micro.turnRate;
          micro.speed += (micro.targetSpeed - micro.speed) * micro.speedLerp;

          micro.swirlPhase += micro.swirlSpeed;
          const toVortexAngle = Math.atan2(micro.vortexY - micro.y, micro.vortexX - micro.x);
          const swirlAngle = toVortexAngle + Math.PI / 2;
          const swirlForce = Math.sin(micro.swirlPhase) * micro.swirlStrength;

          const baseVx = Math.cos(micro.heading) * micro.speed;
          const baseVy = Math.sin(micro.heading) * micro.speed;
          const swirlVx = Math.cos(swirlAngle) * swirlForce;
          const swirlVy = Math.sin(swirlAngle) * swirlForce;

          micro.vx = baseVx + swirlVx;
          micro.vy = baseVy + swirlVy;

          micro.scalePhase += micro.scaleSpeed + Math.abs(headingDelta) * micro.scaleTurnInfluence;
          const scaleWave = 0.85 + Math.sin(micro.scalePhase) * 0.2;
          micro.currentScale = scaleWave;
          const opacityWave = 0.7 + Math.cos(micro.scalePhase + headingDelta * 3) * 0.2;
          micro.currentOpacity = Math.min(1, Math.max(0.05, micro.opacity * opacityWave));
        }

        micro.x += micro.vx;
        micro.y += micro.vy;

        if (micro.x < 0) micro.x = 0;
        if (micro.x > WORLD_SIZE) micro.x = WORLD_SIZE;
        if (micro.y < 0) micro.y = 0;
        if (micro.y > WORLD_SIZE) micro.y = WORLD_SIZE;

        const depth = micro.depth ?? 1;
        const dx = (micro.x - centerX) * depth;
        const dy = (micro.y - centerY) * depth;
        if (Math.abs(dx) > halfWidth + 120 || Math.abs(dy) > halfHeight + 120) {
          return;
        }

        const screenX = micro.x - camera.offsetX * depth;
        const screenY = micro.y - camera.offsetY * depth;
        const swimPulse = 0.9 + Math.sin(micro.animPhase) * 0.1;
        const drawScale = (micro.currentScale ?? 1) * swimPulse * depth;
        const drawOpacity = micro.currentOpacity ?? micro.opacity;

        ctx.fillStyle = micro.color + drawOpacity + ')';
        ctx.globalAlpha = drawOpacity;
        ctx.beginPath();
        ctx.arc(screenX, screenY, micro.size * drawScale, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      glowParticles.forEach((p) => {
        applySpawnOffset(p, camera);
        p.x += p.vx;
        p.y += p.vy;
        p.pulsePhase += 0.03;

        if (p.x < 0) p.x = WORLD_SIZE;
        if (p.x > WORLD_SIZE) p.x = 0;
        if (p.y < 0) p.y = WORLD_SIZE;
        if (p.y > WORLD_SIZE) p.y = 0;

        const depth = 0.5 + (p.depth ?? 0) * 0.5;
        const dx = (p.x - centerX) * depth;
        const dy = (p.y - centerY) * depth;
        if (Math.abs(dx) > halfWidth + 100 || Math.abs(dy) > halfHeight + 100) {
          return;
        }

        const screenX = p.x - camera.offsetX * depth;
        const screenY = p.y - camera.offsetY * depth;
        const glow = Math.sin(p.pulsePhase) * 0.5 + 0.5;

        ctx.fillStyle = p.color + p.opacity * glow + ')';
        ctx.shadowBlur = p.glowIntensity * glow;
        ctx.shadowColor = p.color + '1)';
        ctx.globalAlpha = p.opacity * glow;
        ctx.beginPath();
        ctx.arc(screenX, screenY, p.size * (0.5 + (p.depth ?? 0)), 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      floatingParticles.forEach((p) => {
        applySpawnOffset(p, camera);
        p.x += p.vx * (1 + p.depth);
        p.y += p.vy * (1 + p.depth);
        p.pulsePhase += p.pulseSpeed * 0.02;

        if (p.x < 0) p.x = WORLD_SIZE;
        if (p.x > WORLD_SIZE) p.x = 0;
        if (p.y < 0) p.y = WORLD_SIZE;
        if (p.y > WORLD_SIZE) p.y = 0;

        const depth = 0.3 + (p.depth ?? 0) * 0.7;
        const dx = (p.x - centerX) * depth;
        const dy = (p.y - centerY) * depth;
        if (Math.abs(dx) > halfWidth + 120 || Math.abs(dy) > halfHeight + 120) {
          return;
        }

        const screenX = p.x - camera.offsetX * depth;
        const screenY = p.y - camera.offsetY * depth;
        const pulse = Math.sin(p.pulsePhase) * 0.3 + 0.7;
        const alpha = p.opacity * p.depth * pulse;

        ctx.fillStyle = `hsl(${p.hue}, 70%, 60%)`;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(screenX, screenY, p.size * (0.5 + p.depth * 0.5), 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    });
  },
};
