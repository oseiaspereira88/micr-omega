import { nebulaTypes } from '../config';

const ensureViewport = (camera) => camera?.viewport || {};

export const environmentRenderer = {
  render(ctx, state, camera) {
    if (!ctx || !state || !camera) return;

    const viewport = ensureViewport(camera);
    const width = viewport.width ?? 0;
    const height = viewport.height ?? 0;
    const offsetX = camera.offsetX ?? camera.x - width / 2;
    const offsetY = camera.offsetY ?? camera.y - height / 2;

    const organism = state.organism;
    if (!organism) return;

    state.nebulas?.forEach((nebula) => {
      const screenX = nebula.x - offsetX;
      const screenY = nebula.y - offsetY;

      if (
        screenX < -nebula.radius * 2 ||
        screenX > width + nebula.radius * 2 ||
        screenY < -nebula.radius * 2 ||
        screenY > height + nebula.radius * 2
      ) {
        return;
      }

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
      const screenX = obs.x - offsetX;
      const screenY = obs.y - offsetY;

      if (
        screenX < -obs.size * 2 ||
        screenX > width + obs.size * 2 ||
        screenY < -obs.size * 2 ||
        screenY > height + obs.size * 2
      ) {
        return;
      }

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
      const screenX = power.x - offsetX;
      const screenY = power.y - offsetY;

      if (
        screenX < -120 ||
        screenX > width + 120 ||
        screenY < -120 ||
        screenY > height + 120
      ) {
        return;
      }

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
      const screenX = matter.x - offsetX;
      const screenY = matter.y - offsetY;

      if (screenX < -100 || screenX > width + 100) {
        return;
      }

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
      const screenX = proj.x - offsetX;
      const screenY = proj.y - offsetY;

      if (
        screenX < -50 ||
        screenX > width + 50 ||
        screenY < -50 ||
        screenY > height + 50
      ) {
        return;
      }

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
  },
};

export default environmentRenderer;
