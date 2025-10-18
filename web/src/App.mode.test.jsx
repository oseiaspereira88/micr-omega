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

  it('renders onboarding flow by default', () => {
    render(<App />);

    expect(screen.getByTestId('micro-world-onboarding-flow')).toBeInTheDocument();
    expect(screen.getByTestId('splash-screen')).toBeInTheDocument();
    expect(screen.getByTestId('onboarding-cta')).toHaveTextContent('Próximo');
  });

  it('advances through onboarding steps before entering the game', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByTestId('splash-screen')).toBeInTheDocument();

    await user.click(screen.getByTestId('onboarding-cta'));
    expect(screen.getByTestId('main-menu-screen')).toBeInTheDocument();

    await user.click(screen.getByTestId('onboarding-cta'));
    expect(screen.getByTestId('lobby-screen')).toBeInTheDocument();

    const finalCta = screen.getByTestId('onboarding-cta');
    await user.click(finalCta);

    expect(screen.getByTestId('game-app')).toBeInTheDocument();
  });

  it('skips concept screens when ?mode=play is present', () => {
    updateSearch('?mode=play');

    render(<App />);

    expect(screen.getByTestId('game-app')).toBeInTheDocument();
    expect(screen.queryByTestId('micro-world-onboarding-flow')).not.toBeInTheDocument();
  });
});

