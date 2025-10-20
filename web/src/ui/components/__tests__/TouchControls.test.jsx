import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import TouchControls from '../TouchControls';
import styles from '../TouchControls.module.css';

describe('TouchControls', () => {
  const joystick = { isPointerActive: false, position: { x: 0, y: 0 } };

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

  it('aplica o layout informado', () => {
    const { container, rerender } = render(
      <TouchControls {...baseProps} touchLayout="left" />
    );

    expect(container.firstChild).toHaveClass(styles.layoutLeft);

    rerender(<TouchControls {...baseProps} touchLayout="right" />);

    expect(container.firstChild).toHaveClass(styles.layoutRight);
  });

  it('inverte o layout quando solicitado para evitar o painel lateral', () => {
    const { container } = render(
      <TouchControls
        {...baseProps}
        touchLayout="right"
        autoInvertWhenSidebarOpen
        isSidebarOpen
      />
    );

    expect(container.firstChild).toHaveClass(styles.layoutLeft);
  });

  it('triggers attack release when touch is cancelled', () => {
    const onAttackRelease = vi.fn();

    const { getByRole } = render(
      <TouchControls {...baseProps} onAttackRelease={onAttackRelease} />
    );

    const attackButton = getByRole('button', { name: 'Executar ataque básico' });

    fireEvent.touchCancel(attackButton);

    expect(onAttackRelease).toHaveBeenCalledTimes(1);
  });

  it('triggers attack release when pointer is cancelled', () => {
    const onAttackRelease = vi.fn();

    const { getByRole } = render(
      <TouchControls {...baseProps} onAttackRelease={onAttackRelease} />
    );

    const attackButton = getByRole('button', { name: 'Executar ataque básico' });

    fireEvent.pointerCancel(attackButton);

    expect(onAttackRelease).toHaveBeenCalledTimes(1);
  });

  it('triggers attack release on pointer up', () => {
    const onAttackRelease = vi.fn();

    const { getByRole } = render(
      <TouchControls {...baseProps} onAttackRelease={onAttackRelease} />
    );

    const attackButton = getByRole('button', { name: 'Executar ataque básico' });

    fireEvent.pointerUp(attackButton);

    expect(onAttackRelease).toHaveBeenCalledTimes(1);
  });

  it('triggers attack release when pointer leaves the button', () => {
    const onAttackRelease = vi.fn();

    const { getByRole } = render(
      <TouchControls {...baseProps} onAttackRelease={onAttackRelease} />
    );

    const attackButton = getByRole('button', { name: 'Executar ataque básico' });

    fireEvent.mouseLeave(attackButton);

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

  it('exibe o texto de recarga do dash e não usa atributos ARIA inválidos no botão', () => {
    const { getByRole, getByText } = render(
      <TouchControls
        {...baseProps}
        dashCharge={20}
      />
    );

    expect(getByText('20%')).toBeInTheDocument();
    expect(getByText('Dash carregando: 20%')).toBeInTheDocument();

    const dashButton = getByRole('button', { name: 'Usar dash — carregando' });

    expect(dashButton).not.toHaveAttribute('aria-valuemin');
    expect(dashButton).not.toHaveAttribute('aria-valuemax');
    expect(dashButton).not.toHaveAttribute('aria-valuenow');
  });

  it('exibe rótulos visíveis em todos os botões de ação', () => {
    const { container } = render(<TouchControls {...baseProps} />);

    const actionLabels = Array.from(
      container.querySelectorAll(`.${styles.buttonLabel}`),
    ).map(node => node.textContent.trim());

    expect(actionLabels).toEqual(
      expect.arrayContaining(['Ataque', 'Dash', 'Habilidade', 'Trocar', 'Evoluir']),
    );
  });

  it('exibe o texto de recarga da habilidade e não usa atributos ARIA inválidos no botão', () => {
    const { getByRole, getByText } = render(
      <TouchControls
        {...baseProps}
        hasCurrentSkill
        skillCoolingDown
        skillDisabled
        skillCooldownLabel="5s"
        skillCooldownPercent={42}
        currentSkillIcon="🔥"
        currentSkillCost={30}
      />
    );

    expect(getByText('5s')).toBeInTheDocument();
    expect(getByText('Habilidade em recarga: 5s')).toBeInTheDocument();

    const skillButton = getByRole('button', { name: 'Usar habilidade — em recarga' });

    expect(skillButton).not.toHaveAttribute('aria-valuemin');
    expect(skillButton).not.toHaveAttribute('aria-valuemax');
    expect(skillButton).not.toHaveAttribute('aria-valuenow');
  });

  it('não dispara a habilidade ao tocar quando estiver desabilitada', () => {
    const onUseSkill = vi.fn();

    const { getByRole } = render(
      <TouchControls
        {...baseProps}
        onUseSkill={onUseSkill}
        hasCurrentSkill
        currentSkillIcon="🔥"
        skillDisabled
      />
    );

    const skillButton = getByRole('button', { name: 'Usar habilidade — indisponível' });

    fireEvent.touchStart(skillButton);

    expect(onUseSkill).not.toHaveBeenCalled();
  });
});
