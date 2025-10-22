import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import TouchControls from '../TouchControls';
import styles from '../TouchControls.module.css';

if (typeof window.PointerEvent !== 'function') {
  class PointerEventPolyfill extends MouseEvent {
    constructor(type, params = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 0;
      this.pointerType = params.pointerType ?? 'mouse';
      this.isPrimary = params.isPrimary ?? true;
    }
  }

  window.PointerEvent = PointerEventPolyfill;
}

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

    const attackButton = getByRole('button', { name: 'Ataque' });

    fireEvent.touchCancel(attackButton);

    expect(onAttackRelease).toHaveBeenCalledTimes(1);
  });

  it('triggers attack release when pointer is cancelled', () => {
    const onAttackRelease = vi.fn();

    const { getByRole } = render(
      <TouchControls {...baseProps} onAttackRelease={onAttackRelease} />
    );

    const attackButton = getByRole('button', { name: 'Ataque' });

    fireEvent.pointerCancel(attackButton);

    expect(onAttackRelease).toHaveBeenCalledTimes(1);
  });

  it('triggers attack release on pointer up', () => {
    const onAttackRelease = vi.fn();

    const { getByRole } = render(
      <TouchControls {...baseProps} onAttackRelease={onAttackRelease} />
    );

    const attackButton = getByRole('button', { name: 'Ataque' });

    fireEvent.pointerUp(attackButton);

    expect(onAttackRelease).toHaveBeenCalledTimes(1);
  });

  it('triggers attack release when pointer leaves the button', () => {
    const onAttackRelease = vi.fn();

    const { getByRole } = render(
      <TouchControls {...baseProps} onAttackRelease={onAttackRelease} />
    );

    const attackButton = getByRole('button', { name: 'Ataque' });

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

    const expectedLabels = actionLabels.includes('Atk')
      ? ['Atk', 'Dash', 'Hab.', 'Troca', 'Evo.']
      : ['Ataque', 'Dash', 'Habilidade', 'Trocar', 'Evoluir'];

    expect(actionLabels).toHaveLength(expectedLabels.length);
    expectedLabels.forEach(label => {
      expect(actionLabels).toContain(label);
    });
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

  it('aplica a escala configurada aos estilos dos controles', () => {
    const { container, rerender } = render(<TouchControls {...baseProps} />);

    const layer = container.firstChild;
    const baseScale = Number.parseFloat(layer.style.getPropertyValue('--touch-scale'));
    const baseVertical = Number.parseFloat(
      layer.style.getPropertyValue('--touch-vertical-scale'),
    );
    const baseLegend = Number.parseInt(layer.style.getPropertyValue('--touch-legend-space'), 10);

    rerender(<TouchControls {...baseProps} touchControlScale={1.5} />);

    const scaledLayer = container.firstChild;
    expect(Number.parseFloat(scaledLayer.style.getPropertyValue('--touch-scale'))).toBeGreaterThan(
      baseScale,
    );
    expect(
      Number.parseFloat(scaledLayer.style.getPropertyValue('--touch-vertical-scale')),
    ).toBeGreaterThan(baseVertical);
    expect(
      Number.parseInt(scaledLayer.style.getPropertyValue('--touch-legend-space'), 10),
    ).toBeGreaterThan(baseLegend);
  });

  it('redimensiona o evento encaminhado conforme a sensibilidade do joystick', () => {
    const onJoystickMove = vi.fn();

    const { container } = render(
      <TouchControls
        {...baseProps}
        onJoystickMove={onJoystickMove}
        joystickSensitivity={0.5}
      />
    );

    const zone = container.querySelector(`.${styles.joystickZone}`);
    expect(zone).toBeTruthy();

    vi.spyOn(zone, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 120,
      bottom: 120,
      width: 120,
      height: 120,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(zone, {
      pointerType: 'touch',
      clientX: 70,
      clientY: 70,
    });

    fireEvent.pointerMove(zone, {
      pointerType: 'touch',
      clientX: 90,
      clientY: 60,
    });

    expect(onJoystickMove).toHaveBeenCalledTimes(1);
    const event = onJoystickMove.mock.calls[0][0];
    expect(event.clientX).toBeCloseTo(75, 5);
    expect(event.clientY).toBeCloseTo(60, 5);
    expect(typeof event.preventDefault).toBe('function');
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
