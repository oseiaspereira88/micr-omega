import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

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
});
