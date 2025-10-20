import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const viewportMocks = vi.hoisted(() => ({
  useMenuViewportVariant: vi.fn(() => 'desktop'),
}));

vi.mock('../useMenuViewportVariant.ts', () => ({
  __esModule: true,
  default: viewportMocks.useMenuViewportVariant,
}));

import MicroWorldOnboardingFlow from '../MicroWorldOnboardingFlow.jsx';

describe('MicroWorldOnboardingFlow viewport variants', () => {
  beforeEach(() => {
    viewportMocks.useMenuViewportVariant.mockReturnValue('desktop');
  });

  it('renders desktop variants for menu and lobby stages', async () => {
    const user = userEvent.setup();
    const { container } = render(<MicroWorldOnboardingFlow />);

    const menu = await screen.findByTestId('main-menu-screen');
    expect(menu).toBeInTheDocument();
    expect(menu).toMatchSnapshot('desktop-main-menu');

    await user.click(screen.getByTestId('main-menu-play'));

    const lobby = await screen.findByTestId('lobby-screen');
    expect(lobby).toBeInTheDocument();
    expect(lobby).toMatchSnapshot('desktop-lobby');

    expect(container).toMatchSnapshot('desktop-flow');
  });

  it('renders mobile variants for menu and lobby stages', async () => {
    viewportMocks.useMenuViewportVariant.mockReturnValue('mobile');
    const user = userEvent.setup();
    const { container } = render(<MicroWorldOnboardingFlow />);

    const menu = await screen.findByTestId('main-menu-screen-mobile');
    expect(menu).toBeInTheDocument();
    expect(menu).toMatchSnapshot('mobile-main-menu');

    await user.click(screen.getByTestId('main-menu-play'));

    const lobby = await screen.findByTestId('lobby-screen-mobile');
    expect(lobby).toBeInTheDocument();
    expect(lobby).toMatchSnapshot('mobile-lobby');

    expect(container).toMatchSnapshot('mobile-flow');
  });
});
