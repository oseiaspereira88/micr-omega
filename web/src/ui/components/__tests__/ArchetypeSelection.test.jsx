import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import ArchetypeSelection from '../ArchetypeSelection';

describe('ArchetypeSelection', () => {
  it('mantém a seleção ativa ao filtrar opções permitidas', () => {
    render(
      <ArchetypeSelection
        selection={{ pending: true, options: ['virus', 'algae'] }}
        selected="virus"
        onSelect={() => {}}
      />,
    );

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(2);
    expect(screen.getByText('Vírus')).toBeInTheDocument();
    expect(screen.getByText('Alga')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /vírus/i })).toHaveAttribute('aria-selected', 'true');
  });
});
