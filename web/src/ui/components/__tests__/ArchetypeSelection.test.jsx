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

    const options = screen.getAllByRole('radio');
    expect(options).toHaveLength(2);
    expect(screen.getByText('Vírus')).toBeInTheDocument();
    expect(screen.getByText('Alga')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /vírus/i })).toHaveAttribute('aria-checked', 'true');
  });

  it('associa o título ao diálogo para acessibilidade', () => {
    render(
      <ArchetypeSelection
        selection={{ pending: true, options: ['virus'] }}
        selected="virus"
        onSelect={() => {}}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Escolha seu arquétipo inicial' });
    expect(dialog).toBeInTheDocument();
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

    const virusRadio = screen.getByRole('radio', { name: /vírus/i });
    virusRadio.focus();

    fireEvent.keyDown(virusRadio, { key: 'ArrowRight' });

    expect(handleSelect).toHaveBeenCalledWith('algae');

    const algaeRadio = screen.getByRole('radio', { name: /alga/i });
    expect(algaeRadio.className).toContain('cardSelected');
  });
});
