import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SkillWheel from '../SkillWheel';
import styles from '../SkillWheel.module.css';

const originalMatchMedia = typeof window !== 'undefined' ? window.matchMedia : undefined;

const createMatchMedia = (matches) => {
  let currentMatches = matches;
  const listeners = new Set();

  const mediaQueryList = {
    matches: currentMatches,
    media: '(max-width: 900px)',
    onchange: null,
    addEventListener: vi.fn((event, handler) => {
      if (event === 'change') {
        listeners.add(handler);
      }
    }),
    removeEventListener: vi.fn((event, handler) => {
      if (event === 'change') {
        listeners.delete(handler);
      }
    }),
    addListener: vi.fn((handler) => {
      listeners.add(handler);
    }),
    removeListener: vi.fn((handler) => {
      listeners.delete(handler);
    }),
    dispatchEvent: vi.fn(() => true),
  };

  mediaQueryList.setMatches = (nextValue) => {
    if (currentMatches === nextValue) {
      return;
    }

    currentMatches = nextValue;
    mediaQueryList.matches = nextValue;
    const event = { matches: nextValue, media: mediaQueryList.media };

    if (typeof mediaQueryList.onchange === 'function') {
      mediaQueryList.onchange(event);
    }

    listeners.forEach((listener) => listener(event));
  };

  return mediaQueryList;
};

let lastMatchMediaInstance;

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation(() => {
    lastMatchMediaInstance = createMatchMedia(false);
    return lastMatchMediaInstance;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  if (originalMatchMedia) {
    window.matchMedia = originalMatchMedia;
  } else {
    delete window.matchMedia;
  }
  lastMatchMediaInstance = undefined;
});

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

describe('SkillWheel responsive layout', () => {
  it('switches layout classes when the viewport media query changes', () => {
    const { container } = render(<SkillWheel {...BASE_PROPS} touchControlsActive={false} />);

    expect(lastMatchMediaInstance).toBeDefined();
    expect(container.firstChild).not.toHaveClass(styles.mobile);

    act(() => {
      lastMatchMediaInstance?.setMatches(true);
    });

    expect(container.firstChild).toHaveClass(styles.mobile);
    expect(container.firstChild).not.toHaveClass(styles.mobileWithTouchControls);

    act(() => {
      lastMatchMediaInstance?.setMatches(false);
    });

    expect(container.firstChild).not.toHaveClass(styles.mobile);
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

