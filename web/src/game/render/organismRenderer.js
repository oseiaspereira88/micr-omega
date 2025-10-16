import { withCameraTransform } from './utils/cameraHelpers.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const clamp01 = (value) => Math.min(1, Math.max(0, value ?? 0));

const FORM_DESCRIPTORS = {
  sphere: { xScale: 1, yScale: 1, spikeCount: 0, spikeLength: 0 },
  elongated: { xScale: 1.4, yScale: 0.7, spikeCount: 0, spikeLength: 0 },
  star: { xScale: 1, yScale: 1, spikeCount: 6, spikeLength: 0.35 },
  amoeba: { xScale: 1.1, yScale: 0.95, spikeCount: 8, spikeLength: 0.25 },
  geometric: { xScale: 1, yScale: 1, spikeCount: 5, spikeLength: 0.3 },
  viral: { xScale: 0.95, yScale: 0.95, spikeCount: 12, spikeLength: 0.4 },
  bacterial: { xScale: 1.3, yScale: 0.85, spikeCount: 4, spikeLength: 0.22 },
  archaeal: { xScale: 1.1, yScale: 1, spikeCount: 5, spikeLength: 0.24 },
  protozoan: { xScale: 1.2, yScale: 0.9, spikeCount: 8, spikeLength: 0.28 },
  algal: { xScale: 1.05, yScale: 1.15, spikeCount: 5, spikeLength: 0.25 },
  mycelial: { xScale: 1.15, yScale: 1.15, spikeCount: 10, spikeLength: 0.33 },
};

const resolveFormDescriptor = (player) => {
  const forms = Array.isArray(player?.hybridForms) && player.hybridForms.length > 0
    ? player.hybridForms
    : player?.form
      ? [player.form]
      : ['sphere'];

  const aggregate = forms.reduce(
    (acc, formKey) => {
      const descriptor = FORM_DESCRIPTORS[formKey] || FORM_DESCRIPTORS.sphere;
      return {
        xScale: acc.xScale + descriptor.xScale,
        yScale: acc.yScale + descriptor.yScale,
        spikeCount: acc.spikeCount + descriptor.spikeCount,
        spikeLength: acc.spikeLength + descriptor.spikeLength,
      };
    },
    { xScale: 0, yScale: 0, spikeCount: 0, spikeLength: 0 }
  );

  const count = Math.max(1, forms.length);
  return {
    xScale: aggregate.xScale / count,
    yScale: aggregate.yScale / count,
    spikeCount: aggregate.spikeCount / count,
    spikeLength: aggregate.spikeLength / count,
  };
};

const drawOrganicShape = (ctx, radius, descriptor, palette, speed, pulsePhase, isLocal) => {
  const xScale = descriptor.xScale ?? 1;
  const yScale = descriptor.yScale ?? 1;
  const spikeCount = Math.max(0, Math.round(descriptor.spikeCount ?? 0));
  const spikeLength = Math.max(0, descriptor.spikeLength ?? 0);

  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * Math.max(xScale, yScale));
  gradient.addColorStop(0, `${palette.base}FF`);
  gradient.addColorStop(0.6, `${palette.accent}CC`);
  gradient.addColorStop(1, `${palette.base}33`);

  ctx.save();
  ctx.shadowBlur = isLocal ? 25 : 12;
  ctx.shadowColor = palette.base;
  ctx.fillStyle = gradient;

  if (spikeCount >= 3) {
    const totalPoints = spikeCount * 2;
    ctx.beginPath();
    for (let i = 0; i < totalPoints; i += 1) {
      const isSpike = i % 2 === 0;
      const distance = radius * (isSpike ? 1 + spikeLength : 1);
      const angle = (Math.PI * 2 * i) / totalPoints + pulsePhase * 0.05;
      const x = Math.cos(angle) * distance * (xScale + speed * 0.03);
      const y = Math.sin(angle) * distance * (yScale + speed * 0.02);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.ellipse(
      0,
      0,
      radius * xScale * (1 + speed * 0.05),
      radius * yScale,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  ctx.restore();
};

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

const drawEyes = (ctx, player, radius) => {
  const blink = clamp01(player?.eyeBlink?.openness ?? 1);
  const look = player?.eyeLook ?? { x: 0, y: 0 };
  const expression = player?.eyeExpression ?? {};
  const attack = clamp01(expression.attacking);
  const hurt = clamp01(expression.hurt);
  const neutral = clamp01(1 - attack - hurt);

  const baseEyeRadius = radius * 0.23;
  const spacing = radius * 0.45;
  const offsetY = radius * 0.2;
  const accent = player?.palette?.accent ?? '#1a1a1a';

  const expressionOpenness = neutral * 1 + attack * 0.78 + hurt * 0.55;
  const openness = clamp(expressionOpenness * blink, 0.08, 1);
  const widthScale = 1 + attack * 0.15 - hurt * 0.08;
  const pupilBase = baseEyeRadius * (0.52 + attack * 0.08 - hurt * 0.05);

  const scleraAlpha = 0.72 + neutral * 0.18 + attack * 0.05;
  const eyelidAlpha = 0.42 + attack * 0.28 + hurt * 0.32;
  const lowerLidAlpha = 0.28 + hurt * 0.4;

  const lookX = clamp(look.x ?? 0, -1, 1);
  const lookY = clamp(look.y ?? 0, -1, 1);

  [ -offsetY, offsetY ].forEach((yOffset, index) => {
    ctx.save();
    ctx.translate(spacing, yOffset);
    const slant = (attack * 0.25 - hurt * 0.12) * (index === 0 ? -1 : 1);
    ctx.rotate(slant);

    const eyeWidth = baseEyeRadius * widthScale;
    const eyeHeight = baseEyeRadius * openness;

    ctx.fillStyle = `rgba(255, 255, 255, ${scleraAlpha})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, eyeWidth, eyeHeight, 0, 0, Math.PI * 2);
    ctx.fill();

    const pupilOffsetX = lookX * eyeWidth * 0.7;
    const pupilOffsetY = lookY * eyeHeight * 0.7;
    ctx.fillStyle = '#050505';
    ctx.beginPath();
    ctx.ellipse(pupilOffsetX, pupilOffsetY, pupilBase, pupilBase * (1 + hurt * 0.25), 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.beginPath();
    ctx.ellipse(
      pupilOffsetX - pupilBase * 0.35,
      pupilOffsetY - pupilBase * 0.35,
      pupilBase * 0.45,
      pupilBase * 0.35,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();

    const upperLid = baseEyeRadius * (1 - openness);
    if (upperLid > 0.005) {
      ctx.save();
      ctx.fillStyle = accent;
      ctx.globalAlpha = eyelidAlpha;
      ctx.beginPath();
      ctx.moveTo(-eyeWidth - 1, -eyeHeight);
      ctx.quadraticCurveTo(0, -eyeHeight - upperLid * (0.6 + attack * 0.5), eyeWidth + 1, -eyeHeight);
      ctx.lineTo(eyeWidth + 1, -eyeHeight + upperLid * 0.8);
      ctx.quadraticCurveTo(0, -eyeHeight + upperLid * 0.25, -eyeWidth - 1, -eyeHeight + upperLid * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    const lowerLid = baseEyeRadius * (1 - openness) * (0.35 + hurt * 0.45);
    if (lowerLid > 0.004) {
      ctx.save();
      ctx.fillStyle = accent;
      ctx.globalAlpha = lowerLidAlpha;
      ctx.beginPath();
      ctx.moveTo(-eyeWidth - 1, eyeHeight);
      ctx.quadraticCurveTo(0, eyeHeight + lowerLid * (0.4 + hurt * 0.6), eyeWidth + 1, eyeHeight);
      ctx.lineTo(eyeWidth + 1, eyeHeight - lowerLid * 0.6);
      ctx.quadraticCurveTo(0, eyeHeight - lowerLid * 0.2, -eyeWidth - 1, eyeHeight - lowerLid * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  });
};

const drawPlayerBody = (ctx, player, pulsePhase) => {
  const { palette, renderPosition, orientation, speed, isLocal } = player;
  const baseSize = 22 + clamp(speed * 12, 0, 10);
  const sizePulse = Math.sin((player.pulse ?? 0) + pulsePhase * 0.5) * 3;
  const totalRadius = baseSize + sizePulse;
  const descriptor = resolveFormDescriptor(player);

  ctx.save();
  ctx.rotate(orientation ?? 0);

  if (isLocal) {
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = `${palette.base}22`;
    ctx.beginPath();
    ctx.ellipse(0, 0, totalRadius * 1.5, totalRadius * 1.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawOrganicShape(ctx, totalRadius, descriptor, palette, speed, pulsePhase, isLocal);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.beginPath();
  ctx.ellipse(0, -totalRadius * 0.15, totalRadius * descriptor.xScale * 0.55, totalRadius * descriptor.yScale * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  drawHealthRing(ctx, totalRadius + 6, player.health, palette);

  ctx.save();
  ctx.rotate(orientation ?? 0);
  drawEyes(ctx, player, totalRadius);
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
