import { withCameraTransform } from './utils/cameraHelpers.js';

export const effectsRenderer = {
  render(ctx, state, camera, assets = {}) {
    if (!ctx) return;

    const { delta = 0 } = assets;
    const viewport = assets.viewport || camera.viewport || {};
    const { effects = [], particles = [], fogIntensity = 0 } = state;

    const nextEffects = [];
    const nextParticles = [];

    withCameraTransform(ctx, camera, () => {
      effects.forEach(eff => {
        const growth = eff.growth ?? 200;
        const decay = eff.decay ?? 2;

        eff.life -= delta * decay;
        eff.size = Math.min(eff.maxSize ?? 120, eff.size + delta * growth);

        if (eff.spin) {
          eff.rotation = (eff.rotation || 0) + eff.spin * delta;
        }

        if (eff.life <= 0) {
          return;
        }

        const screenX = eff.x - camera.offsetX;
        const screenY = eff.y - camera.offsetY;

        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.globalAlpha = Math.max(0, Math.min(1, eff.life));
        ctx.shadowBlur = 20;
        ctx.shadowColor = eff.color;

        const style = eff.style || 'ring';
        const lineWidth = eff.lineWidth ?? 3;

        switch (style) {
          case 'filled': {
            ctx.fillStyle = eff.color;
            ctx.beginPath();
            ctx.arc(0, 0, Math.max(4, eff.size * 0.4), 0, Math.PI * 2);
            ctx.fill();
            break;
          }
          case 'double-ring': {
            ctx.strokeStyle = eff.color;
            ctx.lineWidth = lineWidth;
            ctx.beginPath();
            ctx.arc(0, 0, eff.size * 0.6, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha *= 0.6;
            ctx.beginPath();
            ctx.arc(0, 0, eff.size, 0, Math.PI * 2);
            ctx.stroke();
            break;
          }
          case 'pulse': {
            ctx.fillStyle = eff.color;
            ctx.beginPath();
            ctx.arc(0, 0, eff.size, 0, Math.PI * 2);
            ctx.fill();
            break;
          }
          case 'burst': {
            ctx.strokeStyle = eff.color;
            ctx.lineWidth = lineWidth;
            ctx.lineCap = 'round';
            const rays = eff.rays || 10;
            for (let i = 0; i < rays; i++) {
              const angle = (i / rays) * Math.PI * 2 + (eff.rotation || 0);
              const inner = eff.size * 0.2;
              const outer = eff.size;
              ctx.beginPath();
              ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
              ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
              ctx.stroke();
            }
            break;
          }
          case 'spiral': {
            ctx.strokeStyle = eff.color;
            ctx.lineWidth = lineWidth;
            ctx.beginPath();
            const segments = 24;
            for (let i = 0; i <= segments; i++) {
              const t = i / segments;
              const angle = (eff.rotation || 0) + t * Math.PI * 3;
              const radius = t * eff.size * 0.6;
              const x = Math.cos(angle) * radius;
              const y = Math.sin(angle) * radius;
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.stroke();
            break;
          }
          default: {
            ctx.strokeStyle = eff.color;
            ctx.lineWidth = lineWidth;
            ctx.beginPath();
            ctx.arc(0, 0, eff.size, 0, Math.PI * 2);
            ctx.stroke();
          }
        }

        ctx.restore();

        nextEffects.push(eff);
      });

      const offsetX = camera?.offsetX ?? 0;
      const offsetY = camera?.offsetY ?? 0;

      particles.forEach(p => {
        const normalizedDelta = Number.isFinite(delta) ? Math.max(0, delta) : 0;
        const frameScale = normalizedDelta > 0 ? Math.min(3, normalizedDelta * 60) : 1;

        p.x += (p.vx ?? 0) * frameScale;
        p.y += (p.vy ?? 0) * frameScale;
        p.vy = (p.vy ?? 0) + (p.gravity ?? 0.15) * frameScale;
        p.life -= (p.decay ?? 0.02) * frameScale;
        p.age = (p.age ?? 0) + normalizedDelta;

        if (p.life <= 0) {
          return;
        }

        const screenX = (p.x ?? 0) - offsetX;
        const screenY = (p.y ?? 0) - offsetY;
        const glowStrength = Math.max(0, p.glowStrength ?? 0);
        const pulseSpeed = p.pulseSpeed ?? 0;
        const pulseOffset = p.pulseOffset ?? 0;
        const pulseFactor = pulseSpeed
          ? (Math.sin((p.age ?? 0) * pulseSpeed + pulseOffset) + 1) / 2
          : 1;
        const baseAlpha = Math.max(0, Math.min(1, p.baseAlpha ?? 1));
        const alpha = Math.max(
          0,
          Math.min(1, p.life * (baseAlpha * (glowStrength > 0 ? 0.6 + 0.4 * pulseFactor : 1)))
        );
        const sizePulse = p.size * (1 + (glowStrength > 0 ? (pulseFactor - 0.5) * 0.3 : 0));

        ctx.save();

        if ((p.composite ?? 'source-over') === 'additive') {
          ctx.globalCompositeOperation = 'lighter';
        }

        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.shadowBlur = 8 * (1 + glowStrength * 0.8);
        ctx.shadowColor = p.color;

        const spriteKey = p.sprite;
        const spriteAtlas = assets?.sprites;
        const spriteImage = spriteKey && spriteAtlas ? spriteAtlas[spriteKey] : null;

        if (spriteImage) {
          const width = sizePulse * 2;
          const height = sizePulse * 2;
          ctx.drawImage(spriteImage, screenX - sizePulse, screenY - sizePulse, width, height);
        } else {
          const shape = p.shape ?? 'circle';
          ctx.beginPath();
          if (shape === 'square') {
            ctx.rect(screenX - sizePulse, screenY - sizePulse, sizePulse * 2, sizePulse * 2);
          } else {
            ctx.arc(screenX, screenY, sizePulse, 0, Math.PI * 2);
          }
          ctx.fill();
        }

        ctx.restore();

        nextParticles.push(p);
      });
      ctx.globalAlpha = 1;
    });

    if (fogIntensity > 0.01) {
      const width = viewport.width ?? 0;
      const height = viewport.height ?? 0;
      const fogGradient = ctx.createRadialGradient(
        width / 2,
        height / 2,
        Math.min(width, height) * 0.2,
        width / 2,
        height / 2,
        Math.max(width, height)
      );
      fogGradient.addColorStop(0, `rgba(20, 40, 70, ${fogIntensity * 0.4})`);
      fogGradient.addColorStop(1, `rgba(5, 10, 20, ${fogIntensity})`);
      ctx.save();
      ctx.globalAlpha = fogIntensity;
      ctx.fillStyle = fogGradient;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }

    return {
      effects: nextEffects,
      particles: nextParticles,
    };
  },
};
