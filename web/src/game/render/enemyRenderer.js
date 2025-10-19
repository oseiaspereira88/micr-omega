import { withCameraTransform } from './utils/cameraHelpers.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
const clamp01 = (value) => clamp(value, 0, 1);
const TAU = Math.PI * 2;

const DAMAGE_POPUP_STYLES = {
  normal: {
    font: '600 14px "Exo 2", sans-serif',
    color: '#ff5f73',
    shadow: 'rgba(0, 0, 0, 0.55)',
    shadowBlur: 8,
  },
  critical: {
    font: '700 18px "Exo 2", sans-serif',
    color: '#ffd166',
    shadow: 'rgba(255, 129, 0, 0.65)',
    shadowBlur: 12,
  },
  advantage: {
    font: '600 16px "Exo 2", sans-serif',
    color: '#70d6ff',
    shadow: 'rgba(16, 92, 160, 0.6)',
    shadowBlur: 10,
  },
  resisted: {
    font: '600 13px "Exo 2", sans-serif',
    color: '#d5d9e6',
    shadow: 'rgba(30, 36, 50, 0.55)',
    shadowBlur: 8,
  },
  status: {
    font: '600 13px "Exo 2", sans-serif',
    color: '#ffb86c',
    shadow: 'rgba(120, 60, 0, 0.55)',
    shadowBlur: 8,
  },
  skill: {
    font: '700 15px "Exo 2", sans-serif',
    color: '#5cf2c7',
    shadow: 'rgba(28, 86, 66, 0.6)',
    shadowBlur: 10,
  },
};

const getDamagePopupStyle = (variant) => {
  if (typeof variant === 'string') {
    const normalized = variant.trim().toLowerCase();
    if (normalized === 'dot') {
      return DAMAGE_POPUP_STYLES.status;
    }
    if (DAMAGE_POPUP_STYLES[normalized]) {
      return DAMAGE_POPUP_STYLES[normalized];
    }
  }
  return DAMAGE_POPUP_STYLES.normal;
};

const DEFAULT_COLORS = {
  base: '#8fb8ff',
  label: '#f8fbff',
  labelBackground: 'rgba(12, 17, 29, 0.82)',
  hpBorder: '#1a2134',
};

const getCameraOffsets = (camera = {}, ctx) => {
  const viewport = camera.viewport || {};
  const width = viewport.width ?? ctx?.canvas?.width ?? 0;
  const height = viewport.height ?? ctx?.canvas?.height ?? 0;
  const zoom = camera.zoom ?? 1;

  const offsetX = Number.isFinite(camera.offsetX)
    ? camera.offsetX
    : (camera.x ?? 0) - width / (2 * zoom);
  const offsetY = Number.isFinite(camera.offsetY)
    ? camera.offsetY
    : (camera.y ?? 0) - height / (2 * zoom);

  return { offsetX, offsetY };
};

const hexToRgb = (hex) => {
  if (typeof hex !== 'string') {
    return { r: 143, g: 184, b: 255 };
  }
  const normalized = hex.trim().startsWith('#') ? hex.trim() : `#${hex.trim()}`;
  const match = /^#([0-9a-fA-F]{6})$/.exec(normalized);
  if (!match) {
    return { r: 143, g: 184, b: 255 };
  }
  return {
    r: parseInt(match[1].slice(0, 2), 16),
    g: parseInt(match[1].slice(2, 4), 16),
    b: parseInt(match[1].slice(4, 6), 16),
  };
};

const hexToRgba = (hex, alpha = 1) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${clamp01(alpha)})`;
};

const drawRoundedRectPath = (ctx, x, y, width, height, radius) => {
  const safeRadius = clamp(Math.min(Math.abs(width), Math.abs(height)) / 2, 0, radius);
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  ctx.lineTo(x + safeRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.quadraticCurveTo(x, y, x + safeRadius, y);
  ctx.closePath();
};

const fillRoundedRect = (ctx, x, y, width, height, radius) => {
  drawRoundedRectPath(ctx, x, y, width, height, radius);
  ctx.fill();
};

const strokeRoundedRect = (ctx, x, y, width, height, radius) => {
  drawRoundedRectPath(ctx, x, y, width, height, radius);
  ctx.stroke();
};

const computeLevelIntensity = (enemy) => clamp01((enemy?.level ?? 1) / 18);

const drawGlow = (ctx, enemy, size, palette) => {
  const levelIntensity = computeLevelIntensity(enemy);
  const glowColor = palette?.glow ?? palette?.accent ?? enemy?.glowColor ?? enemy?.color ?? DEFAULT_COLORS.base;
  const outerRadius = size * (1.5 + levelIntensity * 0.6 + (enemy?.boss ? 0.3 : 0));
  const innerRadius = size * 0.6;

  ctx.save();
  const gradient = ctx.createRadialGradient(0, 0, innerRadius, 0, 0, outerRadius);
  gradient.addColorStop(0, hexToRgba(glowColor, 0));
  gradient.addColorStop(1, hexToRgba(glowColor, 0.35 + levelIntensity * 0.3));
  ctx.fillStyle = gradient;
  ctx.globalAlpha = 0.65;
  ctx.beginPath();
  ctx.arc(0, 0, outerRadius, 0, TAU);
  ctx.fill();
  ctx.restore();
};

const drawTentacles = (ctx, enemy, size, palette) => {
  const species = (enemy?.species || '').toLowerCase();
  if (!['amoeba', 'rotifer'].includes(species)) {
    return;
  }

  const levelIntensity = computeLevelIntensity(enemy);
  const tentacleCount = Math.round(4 + levelIntensity * 6 + (enemy?.boss ? 2 : 0));
  const baseColor = palette?.detail ?? palette?.shadow ?? enemy?.shadowColor ?? DEFAULT_COLORS.hpBorder;

  ctx.save();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = hexToRgba(baseColor, 0.55 + levelIntensity * 0.25);
  ctx.globalAlpha = 0.7;

  for (let i = 0; i < tentacleCount; i += 1) {
    const angle = (TAU * i) / tentacleCount + (enemy.animPhase ?? 0) * 0.7;
    const startRadius = size * 0.65;
    const controlRadius = size * (1.2 + levelIntensity * 0.8);
    const endRadius = size * (1.65 + levelIntensity * 1.1);
    const controlAngle = angle + Math.sin((enemy.animPhase ?? 0) * 1.5 + i) * 0.4;

    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * startRadius, Math.sin(angle) * startRadius);
    ctx.quadraticCurveTo(
      Math.cos(controlAngle) * controlRadius,
      Math.sin(controlAngle) * controlRadius,
      Math.cos(angle) * endRadius,
      Math.sin(angle) * endRadius,
    );
    ctx.stroke();
  }

  ctx.restore();
};

const drawAmoebaBody = (ctx, enemy, size, palette) => {
  const segments = 14;
  const wobbleStrength = 0.18 + computeLevelIntensity(enemy) * 0.15;
  const phase = enemy.animPhase ?? 0;
  ctx.beginPath();
  for (let i = 0; i <= segments; i += 1) {
    const angle = (TAU * i) / segments;
    const noise = Math.sin(phase * 1.7 + angle * 3) * wobbleStrength;
    const radius = size * (1 + noise);
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();

  const gradient = ctx.createRadialGradient(0, 0, size * 0.2, 0, 0, size * 1.05);
  const innerColor = palette?.core ?? enemy.coreColor ?? enemy.color ?? DEFAULT_COLORS.base;
  const outerColor = palette?.outer ?? enemy.outerColor ?? enemy.color ?? DEFAULT_COLORS.base;
  gradient.addColorStop(0, innerColor);
  gradient.addColorStop(0.7, outerColor);
  gradient.addColorStop(1, palette?.accent ?? enemy.accentColor ?? outerColor);
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.strokeStyle = hexToRgba(palette?.detail ?? enemy.detailColor ?? outerColor, 0.6);
  ctx.lineWidth = 2;
  ctx.stroke();
};

const drawParameciumBody = (ctx, enemy, size, palette) => {
  const length = size * 2;
  const radius = size * 0.8;
  const phase = enemy.animPhase ?? 0;

  ctx.beginPath();
  ctx.moveTo(-length / 2, -radius);
  ctx.quadraticCurveTo(-length / 2 - radius * 0.4, 0, -length / 2, radius);
  ctx.lineTo(length / 2, radius);
  ctx.quadraticCurveTo(length / 2 + radius * 0.4, 0, length / 2, -radius);
  ctx.closePath();

  const gradient = ctx.createLinearGradient(-length / 2, 0, length / 2, 0);
  gradient.addColorStop(0, palette?.outer ?? enemy.outerColor ?? enemy.color ?? DEFAULT_COLORS.base);
  gradient.addColorStop(1, palette?.core ?? enemy.coreColor ?? enemy.color ?? DEFAULT_COLORS.base);
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.save();
  ctx.strokeStyle = hexToRgba(palette?.detail ?? enemy.detailColor ?? DEFAULT_COLORS.hpBorder, 0.6);
  ctx.lineWidth = 1.4;
  const ciliaCount = Math.max(10, Math.round(length / 6));
  for (let i = 0; i <= ciliaCount; i += 1) {
    const progress = i / ciliaCount;
    const x = -length / 2 + progress * length;
    const sway = Math.sin(phase * 1.8 + progress * TAU) * 4;

    ctx.beginPath();
    ctx.moveTo(x, -radius);
    ctx.lineTo(x + sway, -radius - 6 - computeLevelIntensity(enemy) * 6);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x, radius);
    ctx.lineTo(x - sway, radius + 6 + computeLevelIntensity(enemy) * 6);
    ctx.stroke();
  }
  ctx.restore();
};

const drawRotiferBody = (ctx, enemy, size, palette) => {
  const spikes = Math.max(6, Math.round(6 + computeLevelIntensity(enemy) * 4));
  const phase = enemy.animPhase ?? 0;

  ctx.beginPath();
  for (let i = 0; i < spikes; i += 1) {
    const outerAngle = (TAU * i) / spikes;
    const innerAngle = outerAngle + TAU / (spikes * 2);
    const outerRadius = size * (1.05 + Math.sin(phase * 2 + i) * 0.12);
    const innerRadius = size * 0.55;
    const outerX = Math.cos(outerAngle) * outerRadius;
    const outerY = Math.sin(outerAngle) * outerRadius;
    const innerX = Math.cos(innerAngle) * innerRadius;
    const innerY = Math.sin(innerAngle) * innerRadius;

    if (i === 0) {
      ctx.moveTo(outerX, outerY);
    } else {
      ctx.lineTo(outerX, outerY);
    }
    ctx.lineTo(innerX, innerY);
  }
  ctx.closePath();

  const gradient = ctx.createRadialGradient(0, 0, size * 0.2, 0, 0, size * 1.1);
  gradient.addColorStop(0, palette?.core ?? enemy.coreColor ?? enemy.color ?? DEFAULT_COLORS.base);
  gradient.addColorStop(0.6, palette?.outer ?? enemy.outerColor ?? enemy.color ?? DEFAULT_COLORS.base);
  gradient.addColorStop(1, palette?.accent ?? enemy.accentColor ?? enemy.outerColor ?? DEFAULT_COLORS.base);
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.strokeStyle = hexToRgba(palette?.detail ?? enemy.detailColor ?? DEFAULT_COLORS.hpBorder, 0.75);
  ctx.lineWidth = 2.2;
  ctx.stroke();
};

const drawDefaultBody = (ctx, enemy, size, palette) => {
  const gradient = ctx.createRadialGradient(0, 0, size * 0.25, 0, 0, size * 1.05);
  gradient.addColorStop(0, palette?.core ?? enemy.coreColor ?? enemy.color ?? DEFAULT_COLORS.base);
  gradient.addColorStop(1, palette?.outer ?? enemy.outerColor ?? enemy.color ?? DEFAULT_COLORS.base);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, size, 0, TAU);
  ctx.fill();
};

const drawHealthBar = (ctx, enemy, size, palette) => {
  const barWidth = Math.max(36, size * 2.4);
  const barHeight = Math.max(6, size * 0.35);
  const percent = enemy.maxHealth > 0 ? clamp01(enemy.health / enemy.maxHealth) : 0;
  const y = -size - 16;
  const radius = barHeight / 2;

  ctx.save();
  ctx.translate(0, 0);

  ctx.globalAlpha = 0.92;
  ctx.fillStyle = palette?.labelBackground ?? DEFAULT_COLORS.labelBackground;
  fillRoundedRect(ctx, -barWidth / 2, y, barWidth, barHeight, radius);

  if (percent > 0) {
    ctx.globalAlpha = 0.98;
    const fillGradient = ctx.createLinearGradient(-barWidth / 2, 0, barWidth / 2, 0);
    fillGradient.addColorStop(0, palette?.hpFill ?? enemy.hpFillColor ?? enemy.coreColor ?? DEFAULT_COLORS.base);
    fillGradient.addColorStop(1, palette?.accent ?? enemy.accentColor ?? enemy.color ?? DEFAULT_COLORS.base);
    ctx.fillStyle = fillGradient;
    fillRoundedRect(ctx, -barWidth / 2, y, barWidth * percent, barHeight, radius);
  }

  ctx.globalAlpha = 1;
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = palette?.hpBorder ?? enemy.hpBorderColor ?? enemy.shadowColor ?? DEFAULT_COLORS.hpBorder;
  strokeRoundedRect(ctx, -barWidth / 2, y, barWidth, barHeight, radius);

  ctx.restore();
};

const drawLabel = (ctx, enemy, size, palette) => {
  const baseName = typeof enemy.name === 'string' && enemy.name.trim().length > 0
    ? enemy.name.trim()
    : enemy.species || 'Microorganism';
  const level = Number.isFinite(enemy.level) ? enemy.level : 1;
  const labelText = enemy.label || `${baseName} · Lv ${level}`;
  const fontSize = clamp(size * 0.9, 12, 20);
  const paddingX = 8;
  const paddingY = 4;
  const boxY = -size - 28 - fontSize;

  ctx.save();
  ctx.font = `600 ${fontSize}px "Inter", "Helvetica Neue", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';

  const metrics = ctx.measureText(labelText);
  const textWidth = metrics?.width ?? labelText.length * (fontSize * 0.5);
  const boxWidth = textWidth + paddingX * 2;
  const boxHeight = fontSize + paddingY * 1.8;
  const radius = Math.min(12, boxHeight / 2);

  ctx.globalAlpha = 0.94;
  ctx.fillStyle = palette?.labelBackground ?? DEFAULT_COLORS.labelBackground;
  fillRoundedRect(ctx, -boxWidth / 2, boxY - boxHeight, boxWidth, boxHeight, radius);

  ctx.globalAlpha = 1;
  ctx.lineWidth = 1;
  const accent = palette?.accent ?? enemy.accentColor ?? enemy.color ?? DEFAULT_COLORS.base;
  ctx.strokeStyle = hexToRgba(accent, 0.55);
  strokeRoundedRect(ctx, -boxWidth / 2, boxY - boxHeight, boxWidth, boxHeight, radius);

  ctx.fillStyle = palette?.label ?? enemy.labelColor ?? DEFAULT_COLORS.label;
  ctx.fillText(labelText, 0, boxY - paddingY * 0.2);
  ctx.restore();
};

const getSpeciesRenderer = (enemy) => {
  const species = (enemy?.species || '').toLowerCase();
  if (species === 'amoeba') return drawAmoebaBody;
  if (species === 'paramecium') return drawParameciumBody;
  if (species === 'rotifer') return drawRotiferBody;
  return drawDefaultBody;
};

export const enemyRenderer = {
  render(ctx, state, camera) {
    if (!ctx) return;

    const enemies = Array.isArray(state?.enemies) ? state.enemies : [];
    const damagePopups = Array.isArray(state?.damagePopups) ? state.damagePopups : [];
    if (enemies.length === 0 && damagePopups.length === 0) return;

    const { offsetX, offsetY } = getCameraOffsets(camera, ctx);

    withCameraTransform(ctx, camera, () => {
      enemies.forEach((enemy) => {
        if (!enemy) return;

        const size = Math.max(4, Number.isFinite(enemy.size) ? enemy.size : 8);
        const palette = enemy.palette || {};
        const x = (enemy.x ?? 0) - offsetX;
        const y = (enemy.y ?? 0) - offsetY;

        ctx.save();
        ctx.translate(x, y);

        drawGlow(ctx, enemy, size, palette);
        drawTentacles(ctx, enemy, size, palette);

        ctx.shadowBlur = 18 + computeLevelIntensity(enemy) * 18 + (enemy.boss ? 8 : 0);
        ctx.shadowColor = palette.shadow ?? enemy.shadowColor ?? enemy.color ?? DEFAULT_COLORS.base;

        const renderer = getSpeciesRenderer(enemy);
        renderer(ctx, enemy, size, palette);

        if (enemy.boss) {
          ctx.save();
          ctx.globalAlpha = 0.65 + Math.sin((enemy.animPhase ?? 0) * 1.3) * 0.2;
          ctx.strokeStyle = hexToRgba(palette?.accent ?? '#ffd700', 0.95);
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(0, 0, size + 12, 0, TAU);
          ctx.stroke();
          ctx.restore();
        }

        ctx.shadowBlur = 0;

        drawHealthBar(ctx, enemy, size, palette);
        drawLabel(ctx, enemy, size, palette);

        const phaseSpeed = 0.035 + computeLevelIntensity(enemy) * 0.035 + (enemy.boss ? 0.02 : 0);
        enemy.animPhase = (enemy.animPhase ?? 0) + phaseSpeed;

        ctx.restore();
      });

      damagePopups.forEach((popup) => {
        if (!popup || !Number.isFinite(popup.x) || !Number.isFinite(popup.y)) {
          return;
        }

        const opacity = clamp01(popup.opacity ?? 1);
        if (opacity <= 0) {
          return;
        }

        const style = getDamagePopupStyle(popup.variant);
        const riseOffset = Number.isFinite(popup.offset) ? popup.offset : 0;
        const screenX = popup.x - offsetX;
        const screenY = popup.y - offsetY - riseOffset;
        const value = Number.isFinite(popup.value) ? Math.round(popup.value) : 0;

        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.translate(screenX, screenY);
        ctx.font = style.font;
        ctx.fillStyle = style.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = style.shadow;
        ctx.shadowBlur = style.shadowBlur ?? 8;
        ctx.lineWidth = 2;
        ctx.fillText(String(value), 0, 0);
        ctx.restore();
      });
    });
  },
};
