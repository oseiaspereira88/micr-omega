import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

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

    const options = screen.getAllByRole('button');
    expect(options).toHaveLength(2);
    expect(screen.getByText('Vírus')).toBeInTheDocument();
    expect(screen.getByText('Alga')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /vírus/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('permite navegar pelos cartões com as setas mantendo o destaque visual', () => {
    const handleSelect = vi.fn();

    render(
      <ArchetypeSelection
        selection={{ pending: true, options: ['virus', 'algae', 'fungus'] }}
        selected="virus"
        onSelect={handleSelect}
      />,
    );

    const virusButton = screen.getByRole('button', { name: /vírus/i });
    virusButton.focus();

    fireEvent.keyDown(virusButton, { key: 'ArrowRight' });

    expect(handleSelect).toHaveBeenCalledWith('algae');

    const algaeButton = screen.getByRole('button', { name: /alga/i });
    expect(algaeButton.className).toContain('cardSelected');
  });
});
