export const hudRenderer = {
  render(ctx, state, camera, assets = {}) {
    if (!ctx) return;

    const viewport = camera.viewport || {};
    const { delta = 0 } = assets;
    const {
      worldSize,
      organism,
      nebulas = [],
      obstacles = [],
      powerUps = [],
      enemies = [],
      notifications = [],
    } = state;

    const minimapSize = 140;
    const padding = 20;

    const width = viewport.width ?? 0;
    ctx.save();
    ctx.translate(width - minimapSize - padding, padding);

    ctx.fillStyle = 'rgba(12, 18, 32, 0.75)';
    ctx.fillRect(0, 0, minimapSize, minimapSize);
    ctx.strokeStyle = 'rgba(0, 217, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, minimapSize, minimapSize);

    const scale = minimapSize / worldSize;

    nebulas.forEach(nebula => {
      ctx.fillStyle =
        nebula.type === 'solid' ? 'rgba(120, 90, 220, 0.4)' : 'rgba(80, 170, 240, 0.3)';
      const radius = nebula.radius * scale;
      ctx.beginPath();
      ctx.arc(nebula.x * scale, nebula.y * scale, Math.max(2, radius), 0, Math.PI * 2);
      ctx.fill();
    });

    obstacles.forEach(obs => {
      ctx.fillStyle = 'rgba(180, 90, 200, 0.6)';
      ctx.fillRect(obs.x * scale - 2, obs.y * scale - 2, 4, 4);
    });

    powerUps.forEach(power => {
      ctx.fillStyle = power.color;
      ctx.beginPath();
      ctx.arc(power.x * scale, power.y * scale, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    enemies.forEach(enemy => {
      ctx.fillStyle = enemy.boss ? '#FF5577' : '#FFAA33';
      ctx.beginPath();
      ctx.arc(enemy.x * scale, enemy.y * scale, enemy.boss ? 4 : 2, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = '#00D9FF';
    ctx.beginPath();
    ctx.arc(organism.x * scale, organism.y * scale, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    const nextNotifications = notifications.filter(n => {
      n.life -= delta;
      n.y += delta * 20;

      if (n.life > 0) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.globalAlpha = Math.min(n.life, 1);
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#000';
        ctx.fillText(n.text, width / 2, n.y);
        ctx.shadowBlur = 0;
        return true;
      }
      return false;
    });
    ctx.globalAlpha = 1;

    return {
      notifications: nextNotifications,
    };
  },
};
