import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import HudBar from '../HudBar';

const expectDefaultMetrics = () => {
  expect(screen.getByText('MicrΩ • Nv.0 • 0 pts')).toBeInTheDocument();
  expect(screen.getByLabelText('Energia atual: 0')).toBeInTheDocument();
  expect(screen.getByLabelText('Vida atual: 0 de 0')).toBeInTheDocument();
  expect(screen.getByLabelText('Carga de dash disponível: 0%')).toBeInTheDocument();
  expect(screen.getByLabelText('Material genético disponível: 0')).toBeInTheDocument();
  expect(
    screen.getByLabelText('Pontos de característica disponíveis: 0 de 0')
  ).toBeInTheDocument();
  expect(screen.getByText('XP 0 / 1')).toBeInTheDocument();
  expect(screen.getByText('Pequena: 0/0')).toBeInTheDocument();
  expect(screen.getByText('Média: 0/0')).toBeInTheDocument();
  expect(screen.getByText('Grande: 0/0')).toBeInTheDocument();
  expect(screen.getAllByText('Menor 0')).toHaveLength(2);
  expect(screen.getAllByText('Maior 0')).toHaveLength(2);
  expect(screen.getAllByText('Ápice 0')).toHaveLength(2);
  expect(screen.getByText('Custo 25 MG')).toBeInTheDocument();
  expect(screen.getByText('Usado 0x')).toBeInTheDocument();
  expect(screen.getByText('Piedade 0/0')).toBeInTheDocument();
  expect(screen.getByText('XP +0')).toBeInTheDocument();
  expect(screen.getByText('MG +0')).toBeInTheDocument();
  expect(screen.getByText('Frags +0')).toBeInTheDocument();
  expect(screen.getByText('Genes +0')).toBeInTheDocument();
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  expect(screen.queryByText(/combo/i)).not.toBeInTheDocument();
};

describe('HudBar', () => {
  it('renders safe defaults when metrics are undefined', () => {
    render(<HudBar />);

    expectDefaultMetrics();
  });

  it('normalizes null metric values before rendering', () => {
    render(
      <HudBar
        level={null}
        score={null}
        energy={null}
        health={null}
        maxHealth={null}
        dashCharge={null}
        combo={null}
        maxCombo={null}
        xp={{ current: null, next: null }}
        geneticMaterial={{ current: null }}
        characteristicPoints={{ available: null, total: null }}
        geneFragments={{ minor: null, major: null, apex: null }}
        stableGenes={{ minor: null, major: null, apex: null }}
        evolutionSlots={{ small: null, medium: null, large: null }}
        reroll={{ cost: null, count: null, baseCost: null }}
        dropPity={{ fragment: null, stableGene: null }}
        recentRewards={{ xp: null, geneticMaterial: null, fragments: null, stableGenes: null }}
      />
    );

    expectDefaultMetrics();
  });

  it('coerces invalid numeric inputs into safe defaults', () => {
    render(
      <HudBar
        level={Number.NaN}
        score={Number.NaN}
        energy={Number.NaN}
        health={Number.NaN}
        maxHealth={Number.NaN}
        dashCharge={Number.NaN}
        combo={Number.NaN}
        maxCombo={Number.NaN}
        xp={{ current: Number.NaN, next: Number.NaN }}
        geneticMaterial={{ current: Number.NaN }}
        characteristicPoints={{ available: Number.NaN, total: Number.NaN }}
        geneFragments={{ minor: Number.NaN, major: Number.NaN, apex: Number.NaN }}
        stableGenes={{ minor: Number.NaN, major: Number.NaN, apex: Number.NaN }}
        evolutionSlots={{ small: {}, medium: {}, large: {} }}
        reroll={{ cost: Number.NaN, count: Number.NaN, baseCost: Number.NaN }}
        dropPity={{ fragment: Number.NaN, stableGene: Number.NaN }}
        recentRewards={{ xp: Number.NaN, geneticMaterial: Number.NaN, fragments: Number.NaN, stableGenes: Number.NaN }}
      />
    );

    expectDefaultMetrics();
  });

  it('formats large counters using pt-BR locale', () => {
    render(
      <HudBar
        level={42}
        score={1234567}
        energy={8900}
        health={12345}
        maxHealth={67890}
        dashCharge={75}
        combo={2345}
        maxCombo={67890}
        xp={{ current: 123456, next: 789012 }}
        geneticMaterial={{ current: 987654 }}
        characteristicPoints={{ available: 4321, total: 98765 }}
        geneFragments={{ minor: 1111, major: 2222, apex: 3333 }}
        stableGenes={{ minor: 4444, major: 5555, apex: 6666 }}
        evolutionSlots={{
          small: { used: 12, max: 3456 },
          medium: { used: 78, max: 9012 },
          large: { used: 34, max: 56789 },
          macro: { used: 1, max: 23456 },
        }}
        reroll={{ cost: 1234, count: 56, baseCost: 789 }}
        dropPity={{ fragment: 123, stableGene: 4567 }}
        recentRewards={{
          xp: 890123,
          geneticMaterial: 456789,
          fragments: 101112,
          stableGenes: 131415,
        }}
      />
    );

    expect(screen.getByText('MicrΩ • Nv.42 • 1.234.567 pts')).toBeInTheDocument();
    expect(screen.getByLabelText('Energia atual: 8.900')).toBeInTheDocument();
    expect(screen.getByLabelText('Vida atual: 12.345 de 67.890')).toBeInTheDocument();
    expect(screen.getByLabelText('Carga de dash disponível: 75%')).toBeInTheDocument();
    expect(screen.getByLabelText('Material genético disponível: 987.654')).toBeInTheDocument();
    expect(
      screen.getByLabelText('Pontos de característica disponíveis: 4.321 de 98.765')
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Combo atual: x2.345')).toBeInTheDocument();
    expect(screen.getByLabelText('Melhor combo: x67.890')).toBeInTheDocument();
    expect(screen.getByText('XP 123.456 / 789.012')).toBeInTheDocument();
    expect(screen.getByText('Pequena: 12/3.456')).toBeInTheDocument();
    expect(screen.getByText('Média: 78/9.012')).toBeInTheDocument();
    expect(screen.getByText('Grande: 34/56.789')).toBeInTheDocument();
    expect(screen.getByText('Macro: 1/23.456')).toBeInTheDocument();
    expect(screen.getByText('Menor 1.111')).toBeInTheDocument();
    expect(screen.getByText('Maior 2.222')).toBeInTheDocument();
    expect(screen.getByText('Ápice 3.333')).toBeInTheDocument();
    expect(screen.getByText('Menor 4.444')).toBeInTheDocument();
    expect(screen.getByText('Maior 5.555')).toBeInTheDocument();
    expect(screen.getByText('Ápice 6.666')).toBeInTheDocument();
    expect(screen.getByText('Custo 1.234 MG')).toBeInTheDocument();
    expect(screen.getByText('Usado 56x')).toBeInTheDocument();
    expect(screen.getByText('Piedade 123/4.567')).toBeInTheDocument();
    expect(screen.getByText('XP +890.123')).toBeInTheDocument();
    expect(screen.getByText('MG +456.789')).toBeInTheDocument();
    expect(screen.getByText('Frags +101.112')).toBeInTheDocument();
    expect(screen.getByText('Genes +131.415')).toBeInTheDocument();
  });
});

