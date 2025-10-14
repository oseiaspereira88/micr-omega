import {
  applyStatusEffect,
  createStatusResistanceProfile,
  createStatusState,
  getStatusDamageModifier,
  shouldTriggerPhagocytosis,
  tickStatusEffects,
} from './statusEffects';
import { ELEMENT_TYPES, STATUS_EFFECTS } from '../../shared/combat';

const createEntity = (overrides = {}) => ({
  x: 0,
  y: 0,
  health: overrides.health ?? 100,
  maxHealth: overrides.maxHealth ?? 100,
  statusResistances: createStatusResistanceProfile(overrides.statusResistances),
  status: createStatusState(overrides.status),
  ...overrides,
});

describe('statusEffects system', () => {
  it('scales duration with resistances', () => {
    const entity = createEntity({
      statusResistances: { [STATUS_EFFECTS.FISSURE]: 0.5 },
    });

    const result = applyStatusEffect(entity, {
      type: STATUS_EFFECTS.FISSURE,
      duration: 6,
    });

    expect(result.applied).toBe(true);
    expect(result.duration).toBeLessThan(6);
    expect(result.duration).toBeGreaterThan(2);
  });

  it('ticks damage over time and applies elemental synergies', () => {
    const attacker = createEntity();
    const target = createEntity();

    applyStatusEffect(target, {
      type: STATUS_EFFECTS.CORROSION,
      stacks: 2,
    });

    const initialBonus = getStatusDamageModifier({
      target,
      attackElement: ELEMENT_TYPES.ACID,
    });

    let totalDamage = 0;
    tickStatusEffects(target, 1.5, {
      onDamage: ({ damage }) => {
        totalDamage += damage;
      },
    });
    const expiration = tickStatusEffects(target, 8, {});
    expect(totalDamage).toBeGreaterThan(0);
    expect(initialBonus).toBeGreaterThan(0);
    expect(target.status.active[STATUS_EFFECTS.CORROSION]).toBeUndefined();
  });

  it('detects phagocytosis eligibility based on mass', () => {
    const attacker = createEntity({ mass: 5 });
    const target = createEntity({ mass: 2, health: 0 });

    expect(
      shouldTriggerPhagocytosis({
        attacker,
        target,
      })
    ).toBe(true);
  });
});
