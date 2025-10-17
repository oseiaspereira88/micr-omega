import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

import GameOverScreen from '../GameOverScreen';

describe('GameOverScreen', () => {
  it('exibe o botão Jogar Novamente e aciona onRestart ao clicar', () => {
    const handleRestart = vi.fn();

    render(
      <GameOverScreen score={12345} level={12} maxCombo={8} onRestart={handleRestart} />
    );

    const restartButton = screen.getByRole('button', { name: /jogar novamente/i });
    expect(restartButton).toBeInTheDocument();

    fireEvent.click(restartButton);

    expect(handleRestart).toHaveBeenCalledTimes(1);
  });

  it('formata os valores usando separadores de milhar brasileiros', () => {
    render(
      <GameOverScreen score={1234567} level={6543} maxCombo={4321} onRestart={() => {}} />
    );

    expect(screen.getByText('1.234.567')).toBeInTheDocument();
    expect(screen.getByText('🧬 Nível Alcançado: 6.543')).toBeInTheDocument();
    expect(screen.getByText('🔥 Combo Máximo: x4.321')).toBeInTheDocument();
  });

  it('usa 0 como fallback quando os valores são inválidos', () => {
    render(<GameOverScreen score={Number.NaN} level="invalid" maxCombo={null} onRestart={() => {}} />);

    const summaryCard = screen.getByText('Pontuação Final').parentElement;
    expect(summaryCard).not.toBeNull();
    expect(within(summaryCard).getByText('0')).toBeInTheDocument();
    expect(screen.getByText('🧬 Nível Alcançado: 0')).toBeInTheDocument();
    expect(screen.getByText('🔥 Combo Máximo: x0')).toBeInTheDocument();
  });
});
