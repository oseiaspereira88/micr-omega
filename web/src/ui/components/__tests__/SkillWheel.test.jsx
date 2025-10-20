import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import SkillWheel from '../SkillWheel';
import styles from '../SkillWheel.module.css';

const BASE_PROPS = {
  currentSkill: {
    key: 'fireball',
    name: 'Bola de Fogo',
    icon: '🔥',
    type: 'active',
    element: 'fire',
    cost: { energy: 5 },
    applies: ['burn'],
    description: 'Lança uma esfera flamejante que incinera inimigos próximos.',
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
      description: 'Lança uma esfera flamejante que incinera inimigos próximos.',
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
    const { container } = render(<SkillWheel {...BASE_PROPS} touchControlsActive />);

    expect(container.firstChild).toHaveClass(styles.mobile, styles.mobileWithTouchControls);

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

describe('SkillWheel descriptions', () => {
  it('renders the current skill description and includes it in tooltips', () => {
    render(<SkillWheel {...BASE_PROPS} />);

    expect(
      screen.getByText('Lança uma esfera flamejante que incinera inimigos próximos.'),
    ).toBeInTheDocument();

    const skillItem = screen.getByLabelText(/Bola de Fogo/);
    expect(skillItem).toHaveAttribute(
      'title',
      expect.stringContaining('Lança uma esfera flamejante que incinera inimigos próximos.'),
    );
    expect(skillItem.getAttribute('aria-label')).toContain(
      'Lança uma esfera flamejante que incinera inimigos próximos.',
    );
  });
});

describe('SkillWheel empty state', () => {
  it('renders a placeholder when no skills are available', () => {
    const { container } = render(<SkillWheel currentSkill={null} skillList={[]} />);

    expect(container.firstChild).toHaveClass(styles.container, styles.empty);
    expect(
      screen.getByText('Nenhuma habilidade disponível no momento.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Equipe uma habilidade para vê-la aqui.')).toBeInTheDocument();
  });

  it('retains the layout footprint for touch layouts when showing the placeholder', () => {
    const { container } = render(
      <SkillWheel currentSkill={null} skillList={[]} touchControlsActive />,
    );

    expect(container.firstChild).toHaveClass(
      styles.container,
      styles.mobile,
      styles.mobileWithTouchControls,
      styles.empty,
    );
  });
});
