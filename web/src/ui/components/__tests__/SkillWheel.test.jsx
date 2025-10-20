import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import SkillWheel from '../SkillWheel';

const BASE_PROPS = {
  currentSkill: {
    key: 'fireball',
    name: 'Bola de Fogo',
    icon: '🔥',
    type: 'active',
    element: 'fire',
    cost: { energy: 5 },
    applies: ['burn'],
  },
  skillList: [
    {
      key: 'fireball',
      name: 'Bola de Fogo',
      icon: '🔥',
      type: 'active',
      element: 'fire',
      cooldown: 0,
      maxCooldown: 10,
      isActive: true,
    },
  ],
  hasMultipleSkills: true,
  skillCooldownLabel: 'Pronta',
  skillReadyPercent: 100,
  onCycleSkill: () => {},
  onUseSkill: () => {},
};

describe('SkillWheel control hints', () => {
  it('shows keyboard hints when keyboard controls are expected', () => {
    render(<SkillWheel {...BASE_PROPS} />);

    expect(
      screen.getByRole('button', { name: '🔁 Trocar habilidade (R)' }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('button', { name: '✨ Usar habilidade (Q)' }),
    ).toBeInTheDocument();

    expect(
      screen.getByText('Q: usar habilidade • Shift: dash'),
    ).toBeInTheDocument();
  });

  it('shows touch guidance when touch controls are active', () => {
    render(<SkillWheel {...BASE_PROPS} touchControlsActive />);

    expect(
      screen.getByRole('button', { name: '🔁 Trocar habilidade' }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('button', { name: '✨ Usar habilidade' }),
    ).toBeInTheDocument();

    expect(
      screen.getByText('Toque em “Usar habilidade” ou deslize para trocar.'),
    ).toBeInTheDocument();
  });
});
