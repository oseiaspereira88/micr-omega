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

        if (Number.isFinite(p.pulseSpeed) && p.pulseSpeed !== 0 && delta > 0) {
          p.pulsePhase = Number.isFinite(p.pulsePhase) ? p.pulsePhase : 0;
          p.pulsePhase += p.pulseSpeed * delta;
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

        const baseAlpha = Math.max(0, Math.min(1, p.life));
        const baseComposite = p.blend || previousComposite;
        const pulseAmplitude = Number.isFinite(p.pulseAmplitude) ? Math.max(0, p.pulseAmplitude) : 0;
        const pulseFactor =
          pulseAmplitude > 0 && Number.isFinite(p.pulsePhase)
            ? 1 + pulseAmplitude * Math.sin(p.pulsePhase)
            : 1;
        const renderSize = Math.max(0.5, p.size * pulseFactor);
        const glowStrength = Number.isFinite(p.glowStrength) ? Math.max(0, p.glowStrength) : 0;
        const glowColor = typeof p.glowColor === 'string' ? p.glowColor : p.color;

        if (glowStrength > 0) {
          const layerCount = Math.max(1, Math.min(5, Math.round(glowStrength * 2)));
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = glowColor;
          ctx.shadowBlur = Math.max(10, glowStrength * 18);
          ctx.shadowColor = glowColor;

          for (let layer = layerCount; layer >= 1; layer -= 1) {
            const t = layer / layerCount;
            const layerAlpha = baseAlpha * 0.35 * t;
            if (layerAlpha <= 0.001) continue;
            ctx.globalAlpha = Math.max(0, Math.min(1, layerAlpha));
            ctx.beginPath();
            ctx.arc(0, 0, renderSize * (1 + t * glowStrength * 0.6), 0, Math.PI * 2);
            ctx.fill();
          }
        }

        ctx.globalCompositeOperation = baseComposite;
        ctx.fillStyle = p.color;
        ctx.shadowBlur = glowStrength > 0 ? Math.max(6, glowStrength * 8) : 8;
        ctx.shadowColor = glowColor;
        ctx.globalAlpha = baseAlpha;
        ctx.beginPath();
        ctx.arc(0, 0, renderSize, 0, Math.PI * 2);
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
