import { HOSTILITY_MATRIX } from '../config/ecosystem';
import { DROP_TABLES } from '../config/enemyTemplates';
import { ELEMENT_TYPES } from '../../shared/combat';
import { ThreatManager, resolveNpcCombat } from './ai';

describe('ThreatManager', () => {
  it('prioritizes threat using elemental advantage and proximity', () => {
    const manager = new ThreatManager({ decayPerSecond: 0 });
    manager.addThreat('rotifer-1', 12);
    manager.addThreat('bacteria-1', 12);

    const candidates = [
      {
        id: 'rotifer-1',
        position: { x: 12, y: 0 },
        element: ELEMENT_TYPES.THERMAL,
        species: 'rotifer',
        health: { current: 10, max: 10 },
      },
      {
        id: 'bacteria-1',
        position: { x: 28, y: 0 },
        element: ELEMENT_TYPES.CHEMICAL,
        species: 'bacteria',
        health: { current: 10, max: 10 },
      },
    ];

    const selection = manager.selectTarget(candidates, {
      position: { x: 0, y: 0 },
      element: ELEMENT_TYPES.BIO,
      aggression: 1,
      preferredRange: 120,
      resolveHostility: (candidate) =>
        1 + (HOSTILITY_MATRIX.virus?.[candidate.species] ?? 0),
    });

    expect(selection.targetId).toBe('bacteria-1');
    expect(selection.threat).toBeGreaterThan(0);
  });
});

describe('resolveNpcCombat', () => {
  it('handles hostile encounters with loot and evolution tracking', () => {
    const virusBaseDrop = { ...DROP_TABLES.minion };
    const bacteriaDrop = { ...DROP_TABLES.minion };
    const world = {
      biome: 'delta',
      microorganisms: [
        {
          id: 'virus-alpha',
          species: 'virus',
          name: 'Alpha Rift',
          level: 3,
          position: { x: 0, y: 0 },
          movementVector: { x: 0, y: 0 },
          health: { current: 9, max: 9 },
          attack: 12,
          defense: 1,
          element: ELEMENT_TYPES.BIO,
          dropTier: 'minion',
          dropProfile: virusBaseDrop,
          baseDropProfile: virusBaseDrop,
          evolutionLevel: 1,
          evolutionXp: { current: 55, thresholds: { minor: 60, medium: 140 }, rolls: { minor: 0, medium: 0 } },
          mutationHistory: [],
          scars: [],
        },
        {
          id: 'bacteria-beta',
          species: 'bacteria',
          name: 'Beta Shroud',
          level: 2,
          position: { x: 18, y: 0 },
          movementVector: { x: 0, y: 0 },
          health: { current: 6, max: 6 },
          attack: 4,
          defense: 0,
          element: ELEMENT_TYPES.CHEMICAL,
          dropTier: 'minion',
          dropProfile: bacteriaDrop,
          baseDropProfile: bacteriaDrop,
          evolutionLevel: 1,
        },
      ],
    };

    const aiResult = resolveNpcCombat(world, {
      delta: 0.2,
      rng: () => 0.05,
      dropTables: DROP_TABLES,
      hostilityMatrix: HOSTILITY_MATRIX,
      now: 1200,
      memory: { threatManagers: {} },
    });

    expect(aiResult.events.some((event) => event.type === 'attack')).toBe(true);
    expect(aiResult.events.some((event) => event.type === 'kill')).toBe(true);
    expect(aiResult.drops.length).toBeGreaterThanOrEqual(1);
    expect(aiResult.world.microorganisms).toHaveLength(1);

    const survivor = aiResult.world.microorganisms[0];
    expect(survivor.id).toBe('virus-alpha');
    expect(survivor.evolutionXp.current).toBeGreaterThan(55);
    expect(survivor.scars.length).toBeGreaterThan(0);
    expect(survivor.dropProfile.geneticMaterial.min).toBeGreaterThan(virusBaseDrop.geneticMaterial.min);
  });

  it('allows cautious NPCs to flee when overwhelmed', () => {
    const world = {
      biome: 'delta',
      microorganisms: [
        {
          id: 'amoeba-1',
          species: 'amoeba',
          name: 'Quivering Bloom',
          level: 1,
          position: { x: 0, y: 0 },
          movementVector: { x: 0, y: 0 },
          health: { current: 1, max: 10 },
          attack: 2,
          defense: 0,
          element: ELEMENT_TYPES.BIO,
          dropTier: 'minion',
          dropProfile: DROP_TABLES.minion,
          baseDropProfile: DROP_TABLES.minion,
        },
        {
          id: 'bacteria-strong',
          species: 'bacteria',
          name: 'Iron Husk',
          level: 4,
          position: { x: 12, y: 0 },
          movementVector: { x: 0, y: 0 },
          health: { current: 12, max: 12 },
          attack: 6,
          defense: 2,
          element: ELEMENT_TYPES.CHEMICAL,
          dropTier: 'minion',
          dropProfile: DROP_TABLES.minion,
          baseDropProfile: DROP_TABLES.minion,
        },
      ],
    };

    const aiResult = resolveNpcCombat(world, {
      delta: 0.2,
      rng: () => 0.4,
      hostilityMatrix: HOSTILITY_MATRIX,
      memory: { threatManagers: {} },
    });

    const amoeba = aiResult.world.microorganisms.find((npc) => npc.id === 'amoeba-1');
    expect(amoeba).toBeDefined();
    expect(amoeba.ai.lastDecision).toBe('flee');
    expect(Math.abs(amoeba.movementVector.x) + Math.abs(amoeba.movementVector.y)).toBeGreaterThan(0);
  });
});
