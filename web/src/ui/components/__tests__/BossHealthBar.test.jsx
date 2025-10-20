import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import BossHealthBar from '../BossHealthBar';

describe('BossHealthBar', () => {
  it('renders 0% when health data is undefined', () => {
    render(<BossHealthBar active health={undefined} maxHealth={undefined} />);

    expect(screen.getByText('0%')).toBeInTheDocument();

    const progress = screen.getByRole('progressbar', { name: /mega-organismo - vida/i });
    expect(Number(progress.getAttribute('aria-valuenow'))).toBe(0);
    expect(progress.getAttribute('aria-describedby')).toBeTruthy();
    expect(progress).toHaveAttribute('aria-valuetext', '0% (0 de 1)');

    const fill = progress.firstElementChild;
    expect(fill).not.toBeNull();
    expect(fill).toHaveStyle({ width: '0%' });

    expect(screen.getByText(/enfurecido!/i)).toBeInTheDocument();
  });

  it('renders custom boss name when provided', () => {
    render(
      <BossHealthBar active health={250} maxHealth={500} name="Colosso Primevo" />
    );

    expect(screen.getByText(/⚠️ Colosso Primevo/)).toBeInTheDocument();
    const progress = screen.getByRole('progressbar', { name: /colosso primevo - vida/i });
    expect(progress).toBeInTheDocument();
    expect(progress).toHaveAttribute('aria-valuetext', '50% (250 de 500)');

    expect(progress.querySelectorAll('[data-segment-marker]')).toHaveLength(3);

    expect(screen.getByText(/fase 3/i)).toBeInTheDocument();
  });
});

