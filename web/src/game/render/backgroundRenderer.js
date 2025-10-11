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

    backgroundLayers.forEach(layer => {
      layer.pulsePhase += 0.01;
      const pulse = Math.sin(layer.pulsePhase) * 0.5 + 0.5;

      const screenX = layer.x - camera.offsetX * layer.depth;
      const screenY = layer.y - camera.offsetY * layer.depth;

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

    lightRays.forEach(ray => {
      ray.y += ray.speed;
      if (ray.y > 4000) ray.y = -200;

      const screenX = ray.x - camera.offsetX * 0.3;
      const screenY = ray.y - camera.offsetY * 0.3;

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

    microorganisms.forEach(micro => {
      micro.x += micro.vx;
      micro.y += micro.vy;
      micro.animPhase += 0.05;

      if (micro.x < 0) micro.x = 4000;
      if (micro.x > 4000) micro.x = 0;
      if (micro.y < 0) micro.y = 4000;
      if (micro.y > 4000) micro.y = 0;

      const screenX = micro.x - camera.offsetX * micro.depth;
      const screenY = micro.y - camera.offsetY * micro.depth;

      if (screenX > -50 && screenX < width + 50) {
        const pulse = Math.sin(micro.animPhase) * 0.2 + 1;

        ctx.fillStyle = micro.color + micro.opacity + ')';
        ctx.globalAlpha = micro.opacity;
        ctx.beginPath();
        ctx.arc(screenX, screenY, micro.size * pulse * micro.depth, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.globalAlpha = 1;

    glowParticles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.pulsePhase += 0.03;

      if (p.x < 0) p.x = 4000;
      if (p.x > 4000) p.x = 0;
      if (p.y < 0) p.y = 4000;
      if (p.y > 4000) p.y = 0;

      const screenX = p.x - camera.offsetX * (0.5 + p.depth * 0.5);
      const screenY = p.y - camera.offsetY * (0.5 + p.depth * 0.5);

      if (screenX > -50 && screenX < width + 50) {
        const glow = Math.sin(p.pulsePhase) * 0.5 + 0.5;

        ctx.fillStyle = p.color + (p.opacity * glow) + ')';
        ctx.shadowBlur = p.glowIntensity * glow;
        ctx.shadowColor = p.color + '1)';
        ctx.globalAlpha = p.opacity * glow;
        ctx.beginPath();
        ctx.arc(screenX, screenY, p.size * (0.5 + p.depth), 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    floatingParticles.forEach(p => {
      p.x += p.vx * (1 + p.depth);
      p.y += p.vy * (1 + p.depth);
      p.pulsePhase += p.pulseSpeed * 0.02;

      if (p.x < 0) p.x = 4000;
      if (p.x > 4000) p.x = 0;
      if (p.y < 0) p.y = 4000;
      if (p.y > 4000) p.y = 0;

      const screenX = p.x - camera.offsetX * (0.3 + p.depth * 0.7);
      const screenY = p.y - camera.offsetY * (0.3 + p.depth * 0.7);

      if (screenX > -50 && screenX < width + 50) {
        const pulse = Math.sin(p.pulsePhase) * 0.3 + 0.7;
        const alpha = p.opacity * p.depth * pulse;

        ctx.fillStyle = `hsl(${p.hue}, 70%, 60%)`;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(screenX, screenY, p.size * (0.5 + p.depth * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.globalAlpha = 1;
  },
};
