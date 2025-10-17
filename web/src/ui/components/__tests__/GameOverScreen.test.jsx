import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

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

  it('foca automaticamente o botão Jogar Novamente ao montar', async () => {
    render(
      <GameOverScreen
        score={0}
        level={0}
        maxCombo={0}
        onRestart={() => {}}
        onQuit={() => {}}
      />
    );

    const restartButton = screen.getByRole('button', { name: /jogar novamente/i });

    await waitFor(() => {
      expect(restartButton).toHaveFocus();
    });
  });

  it('exibe o botão Sair da sala quando onQuit é fornecido e aciona o callback', async () => {
    const handleQuit = vi.fn();

    render(
      <GameOverScreen
        score={12345}
        level={12}
        maxCombo={8}
        onRestart={() => {}}
        onQuit={handleQuit}
      />
    );

    const quitButton = screen.getByRole('button', { name: /sair da sala/i });
    expect(quitButton).toBeInTheDocument();

    fireEvent.click(quitButton);

    expect(handleQuit).toHaveBeenCalledTimes(1);
  });

  it('formata pontuação, nível e combo usando formatação pt-BR', () => {
    render(
      <GameOverScreen score={1234567} level={8901} maxCombo={23456} onRestart={() => {}} />
    );

    expect(screen.getByText('1.234.567')).toBeInTheDocument();
    expect(screen.getByText('🧬 Nível Alcançado: 8.901')).toBeInTheDocument();
    expect(screen.getByText('🔥 Combo Máximo: x23.456')).toBeInTheDocument();
  });

  it('usa 0 como fallback quando os valores são ausentes ou inválidos', () => {
    render(<GameOverScreen score={undefined} level={NaN} maxCombo={null} onRestart={() => {}} />);

    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('🧬 Nível Alcançado: 0')).toBeInTheDocument();
    expect(screen.getByText('🔥 Combo Máximo: x0')).toBeInTheDocument();
  });
});
