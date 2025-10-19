import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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

  it('renders onboarding flow by default', () => {
    render(<App />);

    expect(screen.getByTestId('micro-world-onboarding-flow')).toBeInTheDocument();
    expect(screen.getByTestId('splash-screen')).toBeInTheDocument();
    expect(screen.getByText(/Micr•Omega Boot Sequence/i)).toBeInTheDocument();
    expect(screen.queryByTestId('main-menu-play')).not.toBeInTheDocument();
  });

  it('advances through onboarding stages before entering the game', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByTestId('splash-screen')).toBeInTheDocument();

    await screen.findByTestId('main-menu-screen');

    await user.click(screen.getByTestId('main-menu-play'));
    expect(screen.getByTestId('lobby-screen')).toBeInTheDocument();

    await user.click(screen.getByTestId('lobby-join-public'));
    expect(await screen.findByTestId('game-app')).toBeInTheDocument();
  });

  it('permite pular a introdução manualmente a partir da tela splash', async () => {
    vi.useFakeTimers();

    try {
      render(<App />);

      const skipButton = screen.getByRole('button', { name: /pular introdução/i });

      skipButton.focus();
      expect(skipButton).toHaveFocus();

      fireEvent.click(skipButton);
      expect(screen.getByTestId('main-menu-screen')).toBeInTheDocument();
      expect(screen.queryByTestId('splash-screen')).not.toBeInTheDocument();

      vi.runOnlyPendingTimers();
      expect(screen.queryByTestId('splash-screen')).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId('main-menu-play'));
      expect(screen.getByTestId('lobby-screen')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('skips concept screens when ?mode=play is present', () => {
    updateSearch('?mode=play');

    render(<App />);

    expect(screen.getByTestId('game-app')).toBeInTheDocument();
    expect(screen.queryByTestId('micro-world-onboarding-flow')).not.toBeInTheDocument();
  });
});

