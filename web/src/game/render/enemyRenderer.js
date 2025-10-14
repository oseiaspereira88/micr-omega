import { withCameraTransform } from './utils/cameraHelpers.js';

export const enemyRenderer = {
  render(ctx, state, camera) {
    if (!ctx) return;

    const { enemies = [] } = state;

    withCameraTransform(ctx, camera, () => {
      enemies.forEach(enemy => {
        ctx.save();
        ctx.translate(enemy.x - camera.offsetX, enemy.y - camera.offsetY);

        ctx.shadowBlur = 20;
        const innerColor = enemy.coreColor || enemy.color;
        const outerColor = enemy.outerColor || enemy.color;
        ctx.shadowColor = enemy.shadowColor || innerColor || enemy.color;

        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, enemy.size);
        gradient.addColorStop(0, innerColor);
        gradient.addColorStop(1, outerColor);
        ctx.fillStyle = gradient;

        ctx.beginPath();
        ctx.arc(0, 0, enemy.size, 0, Math.PI * 2);
        ctx.fill();

        if (enemy.boss) {
          ctx.strokeStyle = '#FFD700';
          ctx.lineWidth = 4;
          ctx.globalAlpha = 0.6 + Math.sin(enemy.animPhase) * 0.2;
          ctx.beginPath();
          ctx.arc(0, 0, enemy.size + 10, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        if (enemy.health < enemy.maxHealth) {
          const barWidth = enemy.size * 2;
          const healthPercent = enemy.health / enemy.maxHealth;

          ctx.fillStyle = '#333';
          ctx.fillRect(-barWidth / 2, -enemy.size - 15, barWidth, 4);

          ctx.fillStyle =
            healthPercent > 0.5 ? '#00FF00' : healthPercent > 0.25 ? '#FFFF00' : '#FF0000';
          ctx.fillRect(-barWidth / 2, -enemy.size - 15, barWidth * healthPercent, 4);
        }

        ctx.shadowBlur = 0;
        ctx.restore();
      });
    });
  },
};
