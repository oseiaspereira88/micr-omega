import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import TouchControls from '../TouchControls';

describe('TouchControls', () => {
  const joystick = { isTouchActive: false, position: { x: 0, y: 0 } };

  const baseProps = {
    joystick,
    onJoystickStart: vi.fn(),
    onJoystickMove: vi.fn(),
    onJoystickEnd: vi.fn(),
    onAttackPress: vi.fn(),
    onAttack: vi.fn(),
    onDash: vi.fn(),
    dashCharge: 0,
    onUseSkill: vi.fn(),
    skillDisabled: false,
    skillCoolingDown: false,
    skillCooldownLabel: '',
    skillCooldownPercent: 0,
    currentSkillIcon: null,
    currentSkillCost: 0,
    hasCurrentSkill: false,
    onOpenEvolutionMenu: vi.fn(),
    canEvolve: false,
  };

  it('triggers attack release when touch is cancelled', () => {
    const onAttackRelease = vi.fn();

    const { getByRole } = render(
      <TouchControls {...baseProps} onAttackRelease={onAttackRelease} />
    );

    const attackButton = getByRole('button', { name: 'Executar ataque básico' });

    fireEvent.touchCancel(attackButton);

    expect(onAttackRelease).toHaveBeenCalledTimes(1);
  });
});
