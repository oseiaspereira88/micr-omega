import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from './App.jsx';

vi.mock('./GameApp.jsx', () => ({
  __esModule: true,
  default: () => <div data-testid="game-app">Game App</div>,
}));

const updateSearch = (search) => {
  const url = new URL(window.location.href);
  url.search = search;
  window.history.replaceState({}, '', url.toString());
};

describe('App display mode flow', () => {
  beforeEach(() => {
    updateSearch('');
  });

  afterEach(() => {
    updateSearch('');
  });

  it('renders concept screens by default', () => {
    render(<App />);

    expect(screen.getByText('Evolving Microworlds UI Kit')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Próximo' })).toBeInTheDocument();
  });

  it('advances through concept steps before entering the game', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Splash Screen' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Próximo' }));
    expect(screen.getByRole('heading', { name: 'Main Menu' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Próximo' }));
    expect(screen.getByRole('heading', { name: 'Lobby — Seleção de Salas' })).toBeInTheDocument();

    const finalCta = screen.getByRole('button', { name: 'Entrar no jogo' });
    await user.click(finalCta);

    expect(screen.getByTestId('game-app')).toBeInTheDocument();
  });

  it('skips concept screens when ?mode=play is present', () => {
    updateSearch('?mode=play');

    render(<App />);

    expect(screen.getByTestId('game-app')).toBeInTheDocument();
    expect(screen.queryByText('Evolving Microworlds UI Kit')).not.toBeInTheDocument();
  });
});

