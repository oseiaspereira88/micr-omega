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
    onCycleSkill: vi.fn(),
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

    fireEvent.touchStart(attackButton);
    fireEvent.touchCancel(attackButton);

    expect(onAttackRelease).toHaveBeenCalledTimes(1);
  });

  it('triggers attack release when pointer leaves the button', () => {
    const onAttackRelease = vi.fn();
    const onAttackPress = vi.fn();

    const { getByRole } = render(
      <TouchControls
        {...baseProps}
        onAttackPress={onAttackPress}
        onAttackRelease={onAttackRelease}
      />
    );

    const attackButton = getByRole('button', { name: 'Executar ataque básico' });

    fireEvent.pointerDown(attackButton, { pointerType: 'mouse' });
    fireEvent.pointerLeave(attackButton, { pointerType: 'mouse' });

    expect(onAttackPress).toHaveBeenCalledTimes(1);
    expect(onAttackRelease).toHaveBeenCalledTimes(1);
  });

  it('permite trocar de habilidade quando uma habilidade está equipada', () => {
    const onCycleSkill = vi.fn();

    const { getByRole } = render(
      <TouchControls
        {...baseProps}
        onCycleSkill={onCycleSkill}
        hasCurrentSkill
        currentSkillIcon="🔥"
      />
    );

    const cycleButton = getByRole('button', { name: 'Trocar habilidade equipada' });

    fireEvent.click(cycleButton);

    expect(onCycleSkill).toHaveBeenCalledTimes(1);
  });
});
