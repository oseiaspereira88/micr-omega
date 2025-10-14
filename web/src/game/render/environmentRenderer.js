import { nebulaTypes } from '../config';
import {
  getCameraViewMetrics,
  withCameraTransform,
} from './utils/cameraHelpers.js';

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

        const pulse = Math.sin(matter.pulsePhase || 0) * 0.1 + 1;

        ctx.shadowBlur = 20 * (matter.glowIntensity ?? 1);
        ctx.shadowColor = matter.color;
        ctx.fillStyle = matter.color;
        ctx.globalAlpha = 0.85;

        ctx.beginPath();
        ctx.arc(0, 0, matter.size * pulse, 0, Math.PI * 2);
        ctx.fill();

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
