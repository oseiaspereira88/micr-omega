import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import HudBar from '../HudBar';

const expectDefaultMetrics = () => {
  expect(screen.getByText('MicrΩ • Nv.0 • 0 pts')).toBeInTheDocument();
  expect(screen.getByText('⚡ 0')).toBeInTheDocument();
  expect(screen.getByText('❤️ 0/0')).toBeInTheDocument();
  expect(screen.getByText('💨 0%')).toBeInTheDocument();
  expect(screen.getByText('🧬 MG 0')).toBeInTheDocument();
  expect(screen.getByText('🧠 PC 0/0')).toBeInTheDocument();
  expect(screen.getByText('XP 0 / 1')).toBeInTheDocument();
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
});

