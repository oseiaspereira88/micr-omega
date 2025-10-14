import { withCameraTransform } from './utils/cameraHelpers.js';

export const organismRenderer = {
  render(ctx, state, camera) {
    const { organism: org, activePowerUps = [], pulsePhase = 0 } = state;
    if (!ctx || !org) return;

    const baseSize = org.size * org.pulseIntensity;

    withCameraTransform(ctx, camera, () => {
      ctx.save();
      ctx.translate(org.x - camera.offsetX, org.y - camera.offsetY);

      const hasPowerShield =
        org.invulnerableFromPowerUp || activePowerUps.some(p => p.type === 'invincibility');

      org.trail.forEach((t, i) => {
        const trailSize = t.size * (i / org.trail.length);
        ctx.fillStyle = t.color;
        ctx.globalAlpha = t.life * 0.2;
        ctx.shadowBlur = 15;
        ctx.shadowColor = t.color;
        ctx.beginPath();
        ctx.arc(t.x - org.x, t.y - org.y, trailSize, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      ctx.rotate(org.angle);
      ctx.transform(1 + org.tiltX, org.tiltY, org.tiltX, 1 + org.tiltY, 0, 0);

      if (org.dying) {
        ctx.rotate(org.rotation);
        ctx.globalAlpha = org.deathTimer / 2;
      }

      if (org.invulnerable || hasPowerShield) {
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 4;
        ctx.globalAlpha = 0.6 + Math.sin(pulsePhase * 10) * 0.3;
        ctx.shadowBlur = 25;
        ctx.shadowColor = '#FFD700';
        ctx.beginPath();
        ctx.arc(0, 0, baseSize + 15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      }

      if (hasPowerShield) {
        const shieldPower = activePowerUps.find(p => p.type === 'invincibility');
        const shieldColor = shieldPower?.color || '#FFD700';
        ctx.strokeStyle = shieldColor;
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.4 + Math.sin(pulsePhase * 6) * 0.2;
        ctx.beginPath();
        ctx.arc(0, 0, baseSize + 12 + Math.sin(pulsePhase) * 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      ctx.strokeStyle = org.color;
      ctx.lineWidth = 2;
      ctx.shadowBlur = 20;
      ctx.shadowColor = org.color;

      ctx.beginPath();
      const segments = 64;
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const wave = Math.sin(angle * 3 + org.swimPhase) * org.bodyWave * baseSize;
        const r = baseSize + wave + 8;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.globalAlpha = 0.3;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      const gradient = ctx.createRadialGradient(
        -baseSize * 0.3,
        -baseSize * 0.3,
        0,
        0,
        0,
        baseSize * 1.4
      );
      gradient.addColorStop(0, org.tertiaryColor + 'FF');
      gradient.addColorStop(0.4, org.color);
      gradient.addColorStop(0.8, org.secondaryColor);
      gradient.addColorStop(1, org.color + '22');

      ctx.fillStyle = gradient;
      ctx.shadowBlur = 40;
      ctx.shadowColor = org.color;
      ctx.beginPath();
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const wave = Math.sin(angle * 3 + org.swimPhase) * org.bodyWave * baseSize;
        const r = baseSize + wave;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.fill();

      ctx.shadowBlur = 0;

      ctx.fillStyle = org.secondaryColor + '66';
      for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI * 2 + org.swimPhase * 0.2;
        const dist = baseSize * 0.3;
        const size = baseSize * 0.1;
        ctx.beginPath();
        ctx.arc(Math.cos(angle) * dist, Math.sin(angle) * dist, size, 0, Math.PI * 2);
        ctx.fill();
      }

      const eyeSize = baseSize * 0.25;
      const eyeDistance = baseSize * 0.4;
      const eyeY = -eyeSize * 0.3;

      const expressionOffset =
        org.eyeExpression === 'hurt' ? 0.3 : org.eyeExpression === 'attacking' ? -0.2 : 0;

      [-1, 1].forEach(side => {
        ctx.save();
        ctx.translate(eyeDistance * side, eyeY + expressionOffset * eyeSize);

        if (org.eyeBlinkState > 0.5) {
          ctx.strokeStyle = org.secondaryColor;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(-eyeSize, 0);
          ctx.lineTo(eyeSize, 0);
          ctx.stroke();
        } else {
          ctx.fillStyle = '#FFF';
          ctx.strokeStyle = org.secondaryColor;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, eyeSize, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          const pupilX = org.eyeLookX * eyeSize * 0.4;
          const pupilY = org.eyeLookY * eyeSize * 0.4;

          ctx.fillStyle = '#000';
          ctx.beginPath();
          ctx.arc(pupilX, pupilY, eyeSize * 0.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#FFF';
          ctx.globalAlpha = 0.8;
          ctx.beginPath();
          ctx.arc(pupilX - eyeSize * 0.15, pupilY - eyeSize * 0.15, eyeSize * 0.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        ctx.restore();
      });

      ctx.restore();
    });
  },
};
