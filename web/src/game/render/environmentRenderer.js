import { nebulaTypes } from '../config';
import {
  getCameraViewMetrics,
  withCameraTransform,
} from './utils/cameraHelpers.js';
import { generateOrganicShapeOffsets } from './organicShapeGenerators.js';

const ensureViewport = (camera) => camera?.viewport || {};

export const environmentRenderer = {
  render(ctx, state, camera) {
    if (!ctx || !state || !camera) return;

    const viewport = ensureViewport(camera);
    const width = viewport.width ?? 0;
    const height = viewport.height ?? 0;
    const offsetX = camera.offsetX ?? camera.x - width / 2;
    const offsetY = camera.offsetY ?? camera.y - height / 2;
    const { halfWidth, halfHeight, centerX, centerY } = getCameraViewMetrics(camera);

    const organism = state.organism;
    if (!organism) return;

    withCameraTransform(ctx, camera, () => {
      state.nebulas?.forEach((nebula) => {
        const dx = nebula.x - centerX;
        const dy = nebula.y - centerY;
        const margin = nebula.radius * 2;
        if (Math.abs(dx) > halfWidth + margin || Math.abs(dy) > halfHeight + margin) {
          return;
        }

        const screenX = nebula.x - offsetX;
        const screenY = nebula.y - offsetY;

        const nebulaColorBase =
          nebula.color ?? nebulaTypes[nebula.type]?.color ?? 'rgba(20, 56, 81, ';

        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.rotate(nebula.rotation || 0);

        const gradient = ctx.createRadialGradient(
          0,
          0,
          nebula.radius * 0.2,
          0,
          0,
          nebula.radius
        );
        gradient.addColorStop(0, `${nebulaColorBase}0.3)`);
        gradient.addColorStop(0.7, `${nebulaColorBase}0.15)`);
        gradient.addColorStop(1, 'rgba(10, 30, 60, 0)');
        ctx.fillStyle = gradient;
        ctx.globalAlpha = nebula.dispelled
          ? Math.max(0, 1 - (nebula.dispelProgress || 0))
          : 1;

        const layers = 8;
        for (let i = 0; i < layers; i += 1) {
          const turbulence =
            Math.sin((nebula.pulsePhase || 0) * nebula.turbulence + i) *
            nebula.turbulence *
            10;
          const radius =
            nebula.radius * (0.6 + i * 0.05 + (turbulence || 0) * 0.002);
          ctx.beginPath();
          ctx.ellipse(
            0,
            0,
            radius,
            radius * 0.8,
            (i / layers) * Math.PI,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }

        ctx.restore();
      });
      ctx.globalAlpha = 1;

      state.obstacles?.forEach((obs) => {
        const dx = obs.x - centerX;
        const dy = obs.y - centerY;
        const margin = obs.size * 2;
        if (Math.abs(dx) > halfWidth + margin || Math.abs(dy) > halfHeight + margin) {
          return;
        }

        const screenX = obs.x - offsetX;
        const screenY = obs.y - offsetY;

        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.rotate(obs.rotation || 0);

        const gradient = ctx.createLinearGradient(
          -obs.size,
          -obs.size,
          obs.size,
          obs.size
        );
        gradient.addColorStop(0, obs.color);
        gradient.addColorStop(0.5, obs.coreColor);
        gradient.addColorStop(1, obs.color);
        ctx.fillStyle = gradient;
        ctx.globalAlpha = obs.opacity ?? 1;

        const pulse = Math.sin(state.gameTime * obs.pulseSpeed) * 0.2 + 1;
        ctx.beginPath();
        ctx.moveTo(0, -obs.size * pulse);
        ctx.lineTo(obs.size * 0.8 * pulse, 0);
        ctx.lineTo(0, obs.size * pulse);
        ctx.lineTo(-obs.size * 0.8 * pulse, 0);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.arc(0, 0, obs.size * 0.4 * pulse, 0, Math.PI * 2);
        ctx.fillStyle = obs.coreColor;
        ctx.fill();

        if (obs.hitPulse > 0) {
          ctx.beginPath();
          ctx.arc(0, 0, obs.size * 0.6 * obs.hitPulse, 0, Math.PI * 2);
          ctx.strokeStyle = obs.hitColor;
          ctx.lineWidth = 3;
          ctx.globalAlpha = obs.hitPulse;
          ctx.stroke();
        }

        ctx.restore();
        ctx.globalAlpha = 1;
      });

      state.powerUps?.forEach((power) => {
        const dx = power.x - centerX;
        const dy = power.y - centerY;
        const margin = 160;
        if (Math.abs(dx) > halfWidth + margin || Math.abs(dy) > halfHeight + margin) {
          return;
        }

        const screenX = power.x - offsetX;
        const screenY = power.y - offsetY;

        ctx.save();
        ctx.translate(screenX, screenY);
        const glow = Math.sin(power.pulse || 0) * 0.25 + 0.75;
        ctx.fillStyle = power.color;
        ctx.globalAlpha = 0.8;
        ctx.shadowBlur = 20;
        ctx.shadowColor = power.color;
        ctx.beginPath();
        ctx.arc(0, 0, 18 + Math.sin((power.pulse || 0) * 0.5) * 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(power.icon, 0, 6);
        ctx.restore();
      });
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      state.organicMatter?.forEach((matter) => {
        const dx = matter.x - centerX;
        const dy = matter.y - centerY;
        const margin = 150;
        if (Math.abs(dx) > halfWidth + margin || Math.abs(dy) > halfHeight + margin) {
          return;
        }

        const screenX = matter.x - offsetX;
        const screenY = matter.y - offsetY;

        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.rotate(matter.rotation || 0);

        const baseSize = Number.isFinite(matter.size) ? matter.size : 10;
        const shapeScale = Number.isFinite(matter.shapeScale) ? matter.shapeScale : 1;
        const baseRadius = Math.max(2, baseSize * shapeScale);
        const shapeKey = matter.shape ?? 'sphere';
        const computeSeed = () => {
          if (Number.isFinite(matter.shapeSeed)) {
            return matter.shapeSeed;
          }
          if (typeof matter.id === 'string') {
            let hash = 0;
            for (let i = 0; i < matter.id.length; i += 1) {
              hash = (hash * 31 + matter.id.charCodeAt(i)) & 0xffffffff;
            }
            return Math.abs(hash % 10_000) / 10_000 || 0.5;
          }
          const composite =
            (Number.isFinite(matter.x) ? matter.x : 0) * 0.017 +
            (Number.isFinite(matter.y) ? matter.y : 0) * 0.031 +
            (Number.isFinite(matter.quantity) ? matter.quantity : 0) * 0.0071;
          return Math.abs(Math.sin(composite) * 9_812.345) % 1;
        };
        const offsets = generateOrganicShapeOffsets(shapeKey, baseRadius, computeSeed());
        const pulseBase = Math.sin(matter.pulsePhase || 0) * 0.1 + 1;
        const color = matter.color ?? '#f0e17a';
        const glow = Math.max(0.4, matter.glowIntensity ?? 1);
        const segments = offsets?.length ? offsets : [{ x: 0, y: 0, radius: baseRadius, stretch: 1, rotation: 0 }];

        ctx.shadowBlur = 20 * glow;
        ctx.shadowColor = color;
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.82;

        segments.forEach((segment, index) => {
          const offsetXLocal = Number.isFinite(segment?.x) ? segment.x : 0;
          const offsetYLocal = Number.isFinite(segment?.y) ? segment.y : 0;
          const localRadius = Number.isFinite(segment?.radius) ? segment.radius : baseRadius;
          const stretch = Number.isFinite(segment?.stretch) ? segment.stretch : 1;
          const rotation = Number.isFinite(segment?.rotation) ? segment.rotation : 0;
          const pulse = pulseBase + Math.sin((matter.pulsePhase || 0) + index * 0.7) * 0.06;
          const radiusX = Math.max(1.5, localRadius * pulse);
          const radiusY = Math.max(1, radiusX * stretch);

          ctx.save();
          ctx.translate(offsetXLocal, offsetYLocal);
          if (rotation) {
            ctx.rotate(rotation);
          }
          ctx.beginPath();
          ctx.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });

        if (baseRadius > 4) {
          ctx.globalAlpha = 0.4;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.beginPath();
          ctx.ellipse(0, -baseRadius * 0.25, baseRadius * 0.6, baseRadius * 0.35, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        ctx.restore();
      });
      ctx.globalAlpha = 1;

      state.projectiles?.forEach((proj) => {
        const dx = proj.x - centerX;
        const dy = proj.y - centerY;
        const margin = 120;
        if (Math.abs(dx) > halfWidth + margin || Math.abs(dy) > halfHeight + margin) {
          return;
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
      });

      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      state.effects?.forEach((effect) => {
        const dx = effect.x - centerX;
        const dy = effect.y - centerY;
        const margin = effect.size ? effect.size * 3 : 180;
        if (Math.abs(dx) > halfWidth + margin || Math.abs(dy) > halfHeight + margin) {
          return;
        }

        const screenX = effect.x - offsetX;
        const screenY = effect.y - offsetY;

        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.rotate(effect.rotation || 0);

        ctx.fillStyle = effect.color || 'rgba(100, 200, 255, 0.6)';
        ctx.globalAlpha = effect.opacity ?? 0.6;
        ctx.shadowBlur = effect.glow ?? 0;
        ctx.shadowColor = effect.shadowColor || effect.color || 'rgba(100, 200, 255, 0.6)';

        ctx.beginPath();
        ctx.arc(0, 0, effect.size ?? 40, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      });
    });

    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  },
};

export default environmentRenderer;
