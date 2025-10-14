import { describe, expect, it } from 'vitest';

import { enemyTemplates } from '../config/enemyTemplates';
import { createEnemyFromTemplate } from './enemy';

const RGBA_REGEX = /^rgba\(\s*\d+(?:\.\d+)?\s*,\s*\d+(?:\.\d+)?\s*,\s*\d+(?:\.\d+)?\s*,\s*(?:0|1|0?\.\d+)\s*\)$/;
const HSLA_REGEX = /^hsla\(\s*\d+(?:\.\d+)?\s*,\s*\d+(?:\.\d+)?%\s*,\s*\d+(?:\.\d+)?%\s*,\s*(?:0|1|0?\.\d+)\s*\)$/;
const HEX_REGEX = /^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

const isCanvasColor = (color) =>
  typeof color === 'string' &&
  (RGBA_REGEX.test(color) || HSLA_REGEX.test(color) || HEX_REGEX.test(color));

const createMockGradient = () => ({
  stops: [],
  addColorStop(position, color) {
    if (typeof position !== 'number' || position < 0 || position > 1) {
      throw new Error(`Invalid stop position: ${position}`);
    }
    if (!isCanvasColor(color)) {
      throw new Error(`Invalid canvas color: ${color}`);
    }
    this.stops.push({ position, color });
  },
});

const createEnemy = (templateKey, overrides = {}, options = {}) =>
  createEnemyFromTemplate(templateKey, enemyTemplates[templateKey], {
    level: options.level ?? 1,
    rng: () => 0.5,
    origin: { x: 0, y: 0 },
    spawnDistance: 0,
    idGenerator: () => `${templateKey}-enemy`,
    overrides,
  });

describe('createEnemyFromTemplate color generation', () => {
  it('produces gradient-safe color strings', () => {
    const enemy = createEnemy('virus');
    expect(enemy).toBeTruthy();

    const gradient = createMockGradient();

    expect(() => {
      gradient.addColorStop(0, enemy.coreColor);
      gradient.addColorStop(0.5, enemy.midColor || enemy.color);
      gradient.addColorStop(1, enemy.outerColor || enemy.color);
    }).not.toThrow();

    [enemy.coreColor, enemy.color, enemy.outerColor, enemy.shadowColor, enemy.strokeColor].forEach(
      (color) => {
        expect(isCanvasColor(color)).toBe(true);
      }
    );
  });

  it('respects alpha overrides when generating rgba colors', () => {
    const enemy = createEnemy('bacteria', {
      color: '#123456',
      coreColor: '#654321',
      colorAlpha: 0.42,
      coreAlpha: 0.84,
    });

    expect(enemy.color).toMatch(/^rgba\(/);
    expect(enemy.coreColor).toMatch(/^rgba\(/);

    const colorAlphaMatch = enemy.color.match(/,\s*(0?\.\d+|1)\)$/);
    const coreAlphaMatch = enemy.coreColor.match(/,\s*(0?\.\d+|1)\)$/);

    expect(colorAlphaMatch).not.toBeNull();
    expect(coreAlphaMatch).not.toBeNull();

    expect(parseFloat(colorAlphaMatch?.[1] ?? '0')).toBeCloseTo(0.42, 2);
    expect(parseFloat(coreAlphaMatch?.[1] ?? '0')).toBeCloseTo(0.84, 2);
  });
});

describe('createEnemyFromTemplate tier variants', () => {
  it('applies tier modifiers and evolution bonuses to elite virus variants', () => {
    const enemy = createEnemy('virus_elite', {}, { level: 5 });

    expect(enemy.tier).toBe('elite');
    expect(enemy.variantOf).toBe('virus');
    expect(enemy.abilities).toEqual(
      expect.arrayContaining(['viral_dash', 'acid_surge', 'viral_burst'])
    );
    expect(enemy.behaviorTraits.projectileVolley).toBeDefined();
    expect(enemy.resistances.chemical).toBeCloseTo(0.15, 2);
    expect(enemy.baseStats.attack).toBe(enemy.attack);
  });

  it('grants evolution abilities and traits when level thresholds are met', () => {
    const early = createEnemy('bacteria', {}, { level: 2 });
    const evolved = createEnemy('bacteria', {}, { level: 6 });

    expect(early.abilities).not.toContain('spore_burst');
    expect(evolved.abilities).toContain('spore_burst');
    expect(evolved.behaviorTraits.projectileVolley).toBeDefined();
    expect(evolved.resistances.thermal).toBeCloseTo(0, 2);
  });
});
