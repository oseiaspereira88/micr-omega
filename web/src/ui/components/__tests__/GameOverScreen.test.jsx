import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

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

    const levelValue = screen.getByText('8.901');
    expect(levelValue).toBeInTheDocument();
    expect(levelValue.closest('li')).toHaveTextContent('Nível Alcançado');

    const comboValue = screen.getByText('x23.456');
    expect(comboValue).toBeInTheDocument();
    expect(comboValue.closest('li')).toHaveTextContent('Combo Máximo');
  });

  it('usa 0 como fallback quando os valores são ausentes ou inválidos', () => {
    render(<GameOverScreen score={undefined} level={NaN} maxCombo={null} onRestart={() => {}} />);

    const summary = screen.getByText('Pontuação Final').closest('section');
    expect(summary).toHaveTextContent('0');

    const levelLabel = screen.getByText('Nível Alcançado');
    expect(levelLabel.closest('li')).toHaveTextContent('0');

    const comboValue = screen.getByText('x0');
    expect(comboValue.closest('li')).toHaveTextContent('Combo Máximo');
  });

  it('exibe o resumo da jornada com métricas formatadas', () => {
    const journeyStats = {
      elapsedMs: 90500,
      xpTotal: 1500,
      mgTotal: 320,
      evolutionsTotal: 5,
      evolutionsByTier: {
        small: 2,
        medium: 1,
        large: 2,
        macro: 0,
      },
    };

    render(
      <GameOverScreen
        score={5000}
        level={7}
        maxCombo={12}
        onRestart={() => {}}
        journeyStats={journeyStats}
      />
    );

    expect(screen.getByRole('heading', { name: /resumo da jornada/i })).toBeInTheDocument();
    expect(screen.getByText('Tempo decorrido')).toBeInTheDocument();
    expect(screen.getByText('1m 30s')).toBeInTheDocument();
    expect(screen.getByText('1.500 XP')).toBeInTheDocument();
    expect(screen.getByText('320 MG')).toBeInTheDocument();

    const evolutionCard = screen.getByText('Evoluções adquiridas').closest('div');
    expect(evolutionCard).not.toBeNull();
    const cardQueries = within(evolutionCard);
    expect(cardQueries.getByText('5')).toBeInTheDocument();
    expect(cardQueries.getByText('2 Pequenas · 1 Médias · 2 Grandes')).toBeInTheDocument();
  });
});
