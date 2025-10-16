import { WORLD_SIZE } from '@micr-omega/shared';

import {
  getCameraViewMetrics,
  withCameraTransform,
} from './utils/cameraHelpers.js';

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
        micro.x += micro.vx;
        micro.y += micro.vy;
        micro.animPhase += 0.05;

        if (micro.x < 0) micro.x = WORLD_SIZE;
        if (micro.x > WORLD_SIZE) micro.x = 0;
        if (micro.y < 0) micro.y = WORLD_SIZE;
        if (micro.y > WORLD_SIZE) micro.y = 0;

        const depth = micro.depth ?? 1;
        const dx = (micro.x - centerX) * depth;
        const dy = (micro.y - centerY) * depth;
        if (Math.abs(dx) > halfWidth + 100 || Math.abs(dy) > halfHeight + 100) {
          return;
        }

        const screenX = micro.x - camera.offsetX * depth;
        const screenY = micro.y - camera.offsetY * depth;
        const pulse = Math.sin(micro.animPhase) * 0.2 + 1;

        ctx.fillStyle = micro.color + micro.opacity + ')';
        ctx.globalAlpha = micro.opacity;
        ctx.beginPath();
        ctx.arc(screenX, screenY, micro.size * pulse * depth, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      glowParticles.forEach((p) => {
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
