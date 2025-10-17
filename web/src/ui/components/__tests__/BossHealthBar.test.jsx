import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import BossHealthBar from '../BossHealthBar';

describe('BossHealthBar', () => {
  it('renders 0% when health data is undefined', () => {
    render(<BossHealthBar active health={undefined} maxHealth={undefined} />);

    expect(screen.getByText('0%')).toBeInTheDocument();

    const progress = screen.getByRole('progressbar', { name: /mega-organismo/i });
    expect(Number(progress.getAttribute('aria-valuenow'))).toBe(0);

    const fill = progress.firstElementChild;
    expect(fill).not.toBeNull();
    expect(fill).toHaveStyle({ width: '0%' });
  });
});

