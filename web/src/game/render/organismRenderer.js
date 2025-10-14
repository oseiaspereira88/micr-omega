import { withCameraTransform } from './utils/cameraHelpers.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const drawHealthRing = (ctx, radius, health, palette) => {
  if (!health) return;
  const { current, max } = health;
  const ratio = max > 0 ? clamp(current / max, 0, 1) : 0;

  ctx.save();
  ctx.rotate(-Math.PI / 2);
  ctx.lineWidth = 4;
  ctx.strokeStyle = `${palette.accent}CC`;
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = palette.base;
  ctx.globalAlpha = 0.95;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2 * ratio);
  ctx.stroke();
  ctx.restore();
};

const drawPlayerBody = (ctx, player, pulsePhase) => {
  const { palette, renderPosition, orientation, speed, isLocal } = player;
  const baseSize = 22 + clamp(speed * 12, 0, 10);
  const sizePulse = Math.sin((player.pulse ?? 0) + pulsePhase * 0.5) * 3;
  const totalRadius = baseSize + sizePulse;

  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, totalRadius);
  gradient.addColorStop(0, `${palette.base}FF`);
  gradient.addColorStop(0.6, `${palette.accent}CC`);
  gradient.addColorStop(1, `${palette.base}33`);

  if (isLocal) {
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = `${palette.base}22`;
    ctx.beginPath();
    ctx.arc(0, 0, totalRadius + 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.rotate(orientation ?? 0);
  ctx.fillStyle = gradient;
  ctx.shadowBlur = isLocal ? 25 : 10;
  ctx.shadowColor = palette.base;
  ctx.beginPath();
  ctx.ellipse(0, 0, totalRadius * (1.1 + speed * 0.05), totalRadius * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  drawHealthRing(ctx, totalRadius + 6, player.health, palette);

  ctx.save();
  ctx.rotate(orientation ?? 0);
  ctx.fillStyle = '#fff';
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.arc(totalRadius * 0.45, -totalRadius * 0.2, totalRadius * 0.25, 0, Math.PI * 2);
  ctx.arc(totalRadius * 0.45, totalRadius * 0.2, totalRadius * 0.25, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#050505';
  ctx.beginPath();
  ctx.arc(totalRadius * 0.55, -totalRadius * 0.2, totalRadius * 0.13, 0, Math.PI * 2);
  ctx.arc(totalRadius * 0.55, totalRadius * 0.2, totalRadius * 0.13, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.shadowBlur = 0;
};

const drawNameplate = (ctx, player, camera) => {
  if (!player?.name) return;
  const viewport = camera.viewport || {};
  const width = viewport.width ?? 0;
  const height = viewport.height ?? 0;
  const offsetX = camera.offsetX ?? camera.x - width / 2;
  const offsetY = camera.offsetY ?? camera.y - height / 2;

  const screenX = player.renderPosition.x - offsetX;
  const screenY = player.renderPosition.y - offsetY - 32;

  ctx.save();
  ctx.translate(screenX, screenY);
  ctx.font = 'bold 14px "Nunito", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = `${player.palette.label}DD`;
  ctx.strokeStyle = 'rgba(12, 15, 24, 0.6)';
  ctx.lineWidth = 3;
  ctx.strokeText(player.name, 0, 0);
  ctx.fillText(player.name, 0, 0);
  ctx.restore();
};

const drawCombatIndicators = (ctx, combatIndicators, camera) => {
  if (!Array.isArray(combatIndicators) || combatIndicators.length === 0) return;
  const viewport = camera.viewport || {};
  const width = viewport.width ?? 0;
  const height = viewport.height ?? 0;
  const offsetX = camera.offsetX ?? camera.x - width / 2;
  const offsetY = camera.offsetY ?? camera.y - height / 2;

  combatIndicators.forEach((indicator) => {
    const screenX = indicator.position.x - offsetX;
    const screenY = indicator.position.y - offsetY;

    ctx.save();
    ctx.translate(screenX, screenY);
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = `${indicator.palette.base}AA`;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(0, 0, 42, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });
};

export const organismRenderer = {
  render(ctx, state, camera) {
    if (!ctx || !state || !camera) return;

    const { players = [], combatIndicators = [], pulsePhase = 0 } = state;
    if (!Array.isArray(players) || players.length === 0) return;

    const viewport = camera.viewport || {};
    const width = viewport.width ?? 0;
    const height = viewport.height ?? 0;
    const offsetX = camera.offsetX ?? camera.x - width / 2;
    const offsetY = camera.offsetY ?? camera.y - height / 2;

    withCameraTransform(ctx, camera, () => {
      players.forEach((player) => {
        const screenX = player.renderPosition.x - offsetX;
        const screenY = player.renderPosition.y - offsetY;

        ctx.save();
        ctx.translate(screenX, screenY);
        drawPlayerBody(ctx, player, pulsePhase);
        ctx.restore();

        drawNameplate(ctx, player, camera);
      });

      drawCombatIndicators(ctx, combatIndicators, camera);
    });
  },
};
