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

      particles.forEach(p => {
        const fade = Number.isFinite(p.fade) ? p.fade : 0.02;
        const gravity = Number.isFinite(p.gravity) ? p.gravity : 0.15;

        p.x += p.vx;
        p.y += p.vy;
        p.life -= fade;
        p.vy += gravity;

        if (Number.isFinite(p.angularVelocity) && p.angularVelocity !== 0) {
          p.orientation = (p.orientation ?? 0) + p.angularVelocity;
        }

        if (p.life <= 0) {
          return;
        }

        const screenX = p.x - camera.offsetX;
        const screenY = p.y - camera.offsetY;
        const previousComposite = ctx.globalCompositeOperation;

        ctx.save();
        ctx.translate(screenX, screenY);
        if (Number.isFinite(p.orientation)) {
          ctx.rotate(p.orientation);
        }
        const stretch = Number.isFinite(p.stretch) ? Math.max(0.2, p.stretch) : 1;
        if (stretch !== 1) {
          ctx.scale(stretch, 1);
        }

        ctx.globalCompositeOperation = p.blend || previousComposite;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
        ctx.shadowBlur = 8;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.globalCompositeOperation = previousComposite;

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
