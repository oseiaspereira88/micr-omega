import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  JOYSTICK_SENSITIVITY_MAX,
  JOYSTICK_SENSITIVITY_MIN,
  TOUCH_CONTROL_SCALE_MAX,
  TOUCH_CONTROL_SCALE_MIN,
} from '../../store/gameSettings';
import styles from './TouchControls.module.css';

const joinClassNames = (...classes) => classes.filter(Boolean).join(' ');

const clamp = (value, min, max) => {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
};

const clampWithFallback = (value, min, max, fallback) => {
  const numericValue = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  if (numericValue < min) {
    return min;
  }

  if (numericValue > max) {
    return max;
  }

  return Number(numericValue);
};

const getViewportSize = () => {
  if (typeof window === 'undefined') {
    return { width: 768, height: 1024 };
  }

  const visualViewport = window.visualViewport;
  if (visualViewport) {
    return {
      width: visualViewport.width,
      height: visualViewport.height,
    };
  }

  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
};

const clampProgress = value => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(numericValue)));
};

const getEventClientPosition = (event) => {
  const touch = event.touches?.[0] ?? event.changedTouches?.[0];
  if (touch && Number.isFinite(touch.clientX) && Number.isFinite(touch.clientY)) {
    return { clientX: touch.clientX, clientY: touch.clientY };
  }

  if (Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
    return { clientX: event.clientX, clientY: event.clientY };
  }

  return null;
};

const createSyntheticTouchList = (coords, originalList) => {
  const baseTouch = {
    identifier: (originalList && originalList[0]?.identifier) ?? 0,
    clientX: coords.clientX,
    clientY: coords.clientY,
    pageX: coords.clientX,
    pageY: coords.clientY,
    screenX: coords.clientX,
    screenY: coords.clientY,
  };

  const touches = [baseTouch];

  if (originalList && typeof originalList.length === 'number' && originalList.length > 1) {
    for (let index = 1; index < originalList.length; index += 1) {
      const touch = typeof originalList.item === 'function'
        ? originalList.item(index)
        : originalList[index];
      if (touch) {
        touches.push({
          identifier: touch.identifier ?? index,
          clientX: touch.clientX,
          clientY: touch.clientY,
          pageX: touch.pageX ?? touch.clientX,
          pageY: touch.pageY ?? touch.clientY,
          screenX: touch.screenX ?? touch.clientX,
          screenY: touch.screenY ?? touch.clientY,
        });
      }
    }
  }

  touches.item = (index) => touches[index] ?? null;
  return touches;
};

const decorateJoystickEvent = (event, sensitivity) => {
  if (!Number.isFinite(sensitivity) || Math.abs(sensitivity - 1) < 0.0001) {
    return event;
  }

  const target = event.currentTarget;
  if (!target || typeof target.getBoundingClientRect !== 'function') {
    return event;
  }

  const rect = target.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const coordinates = getEventClientPosition(event);
  if (!coordinates) {
    return event;
  }

  const deltaX = coordinates.clientX - centerX;
  const deltaY = coordinates.clientY - centerY;
  const scaledCoords = {
    clientX: centerX + deltaX * sensitivity,
    clientY: centerY + deltaY * sensitivity,
  };

  if (
    Math.abs(scaledCoords.clientX - coordinates.clientX) < 0.0001 &&
    Math.abs(scaledCoords.clientY - coordinates.clientY) < 0.0001
  ) {
    return event;
  }

  const touches = event.touches && event.touches.length
    ? createSyntheticTouchList(scaledCoords, event.touches)
    : undefined;
  const changedTouches = event.changedTouches && event.changedTouches.length
    ? createSyntheticTouchList(scaledCoords, event.changedTouches)
    : touches;

  return {
    type: event.type,
    pointerId: event.pointerId,
    pointerType: event.pointerType,
    isPrimary: event.isPrimary,
    buttons: event.buttons,
    button: event.button,
    clientX: scaledCoords.clientX,
    clientY: scaledCoords.clientY,
    pageX: scaledCoords.clientX,
    pageY: scaledCoords.clientY,
    screenX: scaledCoords.clientX,
    screenY: scaledCoords.clientY,
    altKey: event.altKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey,
    preventDefault: (...args) => event.preventDefault?.(...args),
    stopPropagation: (...args) => event.stopPropagation?.(...args),
    currentTarget: target,
    target: event.target,
    nativeEvent: event.nativeEvent ?? event,
    touches,
    changedTouches,
  };
};

const TouchControls = ({
  joystick,
  onJoystickStart,
  onJoystickMove,
  onJoystickEnd,
  onAttackPress,
  onAttackRelease,
  onAttack,
  onDash,
  dashCharge,
  onUseSkill,
  onCycleSkill,
  skillDisabled,
  skillCoolingDown,
  skillCooldownLabel,
  skillCooldownPercent,
  currentSkillIcon,
  currentSkillCost,
  hasCurrentSkill,
  onOpenEvolutionMenu,
  canEvolve,
  touchLayout = 'right',
  isSidebarOpen = false,
  autoInvertWhenSidebarOpen = false,
  touchControlScale: touchControlScaleProp = 1,
  joystickSensitivity: joystickSensitivityProp = 1,
  className,
  ...a11yProps
}) => {
  const [viewport, setViewport] = useState(getViewportSize);
  const [activeButtons, setActiveButtons] = useState({
    attack: false,
    dash: false,
    skill: false,
    cycle: false,
    evolve: false,
  });
  const actionGroupRef = useRef(null);
  const normalizedTouchControlScale = useMemo(
    () =>
      clampWithFallback(
        touchControlScaleProp,
        TOUCH_CONTROL_SCALE_MIN,
        TOUCH_CONTROL_SCALE_MAX,
        1,
      ),
    [touchControlScaleProp],
  );
  const normalizedJoystickSensitivity = useMemo(
    () =>
      clampWithFallback(
        joystickSensitivityProp,
        JOYSTICK_SENSITIVITY_MIN,
        JOYSTICK_SENSITIVITY_MAX,
        1,
      ),
    [joystickSensitivityProp],
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const scheduleFrame =
      typeof window.requestAnimationFrame === 'function'
        ? window.requestAnimationFrame.bind(window)
        : callback => window.setTimeout(callback, 0);
    const cancelFrame =
      typeof window.cancelAnimationFrame === 'function'
        ? window.cancelAnimationFrame.bind(window)
        : window.clearTimeout.bind(window);

    let animationFrameId = null;
    const handleResize = () => {
      if (animationFrameId !== null) {
        cancelFrame(animationFrameId);
      }

      animationFrameId = scheduleFrame(() => {
        animationFrameId = null;
        setViewport(getViewportSize());
      });
    };

    handleResize();

    window.addEventListener('resize', handleResize);

    const visualViewport = window.visualViewport;
    if (visualViewport) {
      visualViewport.addEventListener('resize', handleResize);
    }

    return () => {
      if (animationFrameId !== null) {
        cancelFrame(animationFrameId);
      }

      window.removeEventListener('resize', handleResize);
      if (visualViewport) {
        visualViewport.removeEventListener('resize', handleResize);
      }
    };
  }, []);

  const touchScale = useMemo(
    () => clamp(viewport.width / 600, 0.8, 1.1),
    [viewport.width],
  );

  const heightScale = useMemo(
    () => clamp(viewport.height / 800, 0.7, 1),
    [viewport.height],
  );

  const touchVerticalScale = useMemo(
    () => touchScale * heightScale,
    [heightScale, touchScale],
  );

  const configuredTouchScale = useMemo(
    () => touchScale * normalizedTouchControlScale,
    [touchScale, normalizedTouchControlScale],
  );

  const configuredTouchVerticalScale = useMemo(
    () => touchVerticalScale * normalizedTouchControlScale,
    [touchVerticalScale, normalizedTouchControlScale],
  );

  const isLandscape = viewport.width > viewport.height;
  const showButtonLegends = !isLandscape || viewport.height >= 600;

  const effectiveLayout = useMemo(() => {
    if (!(autoInvertWhenSidebarOpen && isSidebarOpen)) {
      return touchLayout;
    }

    return touchLayout === 'left' ? 'right' : 'left';
  }, [autoInvertWhenSidebarOpen, isSidebarOpen, touchLayout]);

  const dashStatusId = useId();
  const skillStatusId = useId();
  const DASH_CHARGE_THRESHOLD = 30;
  const dashChargeNumeric = Number(dashCharge);
  const dashChargeValue = Number.isFinite(dashChargeNumeric) ? dashChargeNumeric : 0;
  const dashReady = dashChargeValue >= DASH_CHARGE_THRESHOLD;
  const dashChargeClamped = Math.max(
    0,
    Math.min(dashChargeValue, DASH_CHARGE_THRESHOLD),
  );
  const dashChargePercent = clampProgress(
    (dashChargeClamped / DASH_CHARGE_THRESHOLD) * 100,
  );
  const dashChargeDisplay = `${Math.round(dashChargeClamped)}/${DASH_CHARGE_THRESHOLD}`;
  const dashValueText = dashReady
    ? 'Dash carregado'
    : `Dash carregando: ${dashChargeDisplay}`;
  const dashAriaLabel = dashReady ? 'Usar dash — pronto' : 'Usar dash — carregando';

  let skillAriaLabel = 'Usar habilidade';
  if (!hasCurrentSkill) {
    skillAriaLabel = 'Usar habilidade — nenhuma habilidade equipada';
  } else if (skillDisabled) {
    skillAriaLabel = skillCoolingDown
      ? 'Usar habilidade — em recarga'
      : 'Usar habilidade — indisponível';
  } else {
    skillAriaLabel = 'Usar habilidade — pronta';
  }

  const skillCooldownPercentClamped = clampProgress(skillCooldownPercent);
  const showSkillCooldown = Boolean(hasCurrentSkill && skillCoolingDown);
  const skillCooldownDisplay = showSkillCooldown
    ? skillCooldownLabel || `${skillCooldownPercentClamped}%`
    : null;
  const skillLabelColorClass = !hasCurrentSkill || skillDisabled
    ? styles.skillLabelDisabled
    : styles.skillLabelReady;
  const skillValueText = !hasCurrentSkill
    ? 'Nenhuma habilidade equipada'
    : showSkillCooldown
    ? `Habilidade em recarga: ${skillCooldownDisplay}`
    : 'Habilidade pronta';

  const evolveAriaLabel = canEvolve
    ? 'Abrir menu de evolução'
    : 'Abrir menu de evolução — indisponível';

  const cycleSkillAriaLabel = hasCurrentSkill
    ? 'Trocar habilidade equipada'
    : 'Trocar habilidade — nenhuma habilidade equipada';

  const setButtonActive = useCallback((buttonKey, isActive) => {
    setActiveButtons(previousState => {
      if (previousState[buttonKey] === isActive) {
        return previousState;
      }

      return { ...previousState, [buttonKey]: isActive };
    });
  }, []);

  const handleAttackReleaseEvent = event => {
    event.preventDefault();
    setButtonActive('attack', false);
    onAttackRelease?.();
  };

  const handleDashTouchEnd = event => {
    event.preventDefault();
    setButtonActive('dash', false);
  };

  const handleSkillTouchEnd = event => {
    event.preventDefault();
    setButtonActive('skill', false);
  };

  const handleCycleSkillTouchEnd = event => {
    event.preventDefault();
    setButtonActive('cycle', false);
  };

  const layoutClass =
    effectiveLayout === 'left' ? styles.layoutLeft : styles.layoutRight;
  const orientationClass = isLandscape ? styles.landscape : null;

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const group = actionGroupRef.current;
    if (!group) {
      return undefined;
    }

    const hudElement = group.closest('[data-mobile-hud]');
    if (!hudElement) {
      return undefined;
    }

    let frameId = null;
    const scheduleFrame =
      typeof window.requestAnimationFrame === 'function'
        ? window.requestAnimationFrame.bind(window)
        : callback => window.setTimeout(callback, 0);
    const cancelFrame =
      typeof window.cancelAnimationFrame === 'function'
        ? window.cancelAnimationFrame.bind(window)
        : window.clearTimeout.bind(window);

    const measureFootprint = () => {
      frameId = null;

      const interactiveElements = group.querySelectorAll(
        'button, [data-touch-legend="true"]',
      );
      if (!interactiveElements.length) {
        hudElement.style.removeProperty('--touch-controls-footprint');
        hudElement.style.removeProperty('--touch-controls-footprint-height');
        return;
      }

      let minLeft = Infinity;
      let maxRight = -Infinity;
      let minTop = Infinity;
      let maxBottom = -Infinity;

      interactiveElements.forEach(element => {
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
          return;
        }

        minLeft = Math.min(minLeft, rect.left);
        maxRight = Math.max(maxRight, rect.right);
        minTop = Math.min(minTop, rect.top);
        maxBottom = Math.max(maxBottom, rect.bottom);
      });

      const horizontalValid =
        Number.isFinite(minLeft) && Number.isFinite(maxRight) && maxRight > minLeft;
      const verticalValid =
        Number.isFinite(minTop) && Number.isFinite(maxBottom) && maxBottom > minTop;

      if (!horizontalValid) {
        hudElement.style.removeProperty('--touch-controls-footprint');
      } else {
        const horizontalFootprint = Math.ceil(maxRight - minLeft);
        hudElement.style.setProperty(
          '--touch-controls-footprint',
          `${horizontalFootprint}px`,
        );
      }

      if (verticalValid) {
        const verticalFootprint = Math.ceil(maxBottom - minTop);
        hudElement.style.setProperty(
          '--touch-controls-footprint-height',
          `${verticalFootprint}px`,
        );
      } else {
        hudElement.style.removeProperty('--touch-controls-footprint-height');
      }
    };

    const scheduleMeasure = () => {
      if (frameId !== null) {
        return;
      }

      frameId = scheduleFrame(measureFootprint);
    };

    scheduleMeasure();

    let resizeObserver = null;

    if (typeof window.ResizeObserver === 'function') {
      resizeObserver = new window.ResizeObserver(scheduleMeasure);
      resizeObserver.observe(group);
      group
        .querySelectorAll('button, [data-touch-legend="true"]')
        .forEach(element => {
          resizeObserver?.observe(element);
        });
    }

    window.addEventListener('resize', scheduleMeasure);

    return () => {
      window.removeEventListener('resize', scheduleMeasure);
      if (frameId !== null) {
        cancelFrame(frameId);
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      hudElement.style.removeProperty('--touch-controls-footprint');
      hudElement.style.removeProperty('--touch-controls-footprint-height');
    };
  }, [effectiveLayout, configuredTouchScale, showButtonLegends]);

  const isTouchLikePointer = event => {
    const pointerType =
      typeof event.pointerType === 'string' ? event.pointerType.toLowerCase() : event.pointerType;

    return pointerType === 'touch' || pointerType === 'pen' || pointerType === '';
  };

  const forwardJoystickStartEvent = (event) => {
    const decoratedEvent = decorateJoystickEvent(event, normalizedJoystickSensitivity);
    onJoystickStart?.(decoratedEvent);
  };

  const forwardJoystickMoveEvent = (event) => {
    const decoratedEvent = decorateJoystickEvent(event, normalizedJoystickSensitivity);
    onJoystickMove?.(decoratedEvent);
  };

  const handleJoystickPointerStart = event => {
    if (!isTouchLikePointer(event)) return;
    forwardJoystickStartEvent(event);
  };

  const handleJoystickPointerMove = event => {
    if (!isTouchLikePointer(event)) return;
    forwardJoystickMoveEvent(event);
  };

  const handleJoystickPointerEnd = event => {
    if (!isTouchLikePointer(event)) return;
    onJoystickEnd?.(event);
  };

  return (
    <div
      {...a11yProps}
      className={joinClassNames(
        styles.touchLayer,
        layoutClass,
        orientationClass,
        isSidebarOpen ? styles.sidebarHidden : null,
        showButtonLegends ? styles.showLegends : null,
        className,
      )}
      style={{
        '--touch-scale': configuredTouchScale.toFixed(3),
        '--touch-vertical-scale': configuredTouchVerticalScale.toFixed(3),
        '--touch-legend-space': showButtonLegends
          ? `${Math.round(configuredTouchScale * 26)}px`
          : '0px',
      }}
    >
      <div
        className={styles.joystickZone}
        onPointerDown={handleJoystickPointerStart}
        onPointerMove={handleJoystickPointerMove}
        onPointerUp={handleJoystickPointerEnd}
        onPointerCancel={handleJoystickPointerEnd}
        onTouchStart={forwardJoystickStartEvent}
        onTouchMove={forwardJoystickMoveEvent}
        onTouchEnd={onJoystickEnd}
        onTouchCancel={onJoystickEnd}
      >
        <div
          className={styles.joystickKnob}
          style={{
            background: joystick.isPointerActive
              ? 'rgba(0, 217, 255, 0.7)'
              : 'rgba(255, 255, 255, 0.4)',
            boxShadow: joystick.isPointerActive ? '0 0 20px rgba(0, 217, 255, 0.8)' : 'none',
            transform: `translate(${joystick.position.x}px, ${joystick.position.y}px)`,
            transition: joystick.isPointerActive ? 'none' : 'transform 0.2s',
          }}
        />
      </div>

      <div ref={actionGroupRef} className={styles.actionGroup}>
        <button
          type="button"
          className={joinClassNames(
            styles.button,
            styles.attackButton,
            activeButtons.attack ? styles.buttonActive : null,
            activeButtons.attack ? styles.attackButtonActive : null,
          )}
          onTouchStart={event => {
            event.preventDefault();
            setButtonActive('attack', true);
            onAttackPress?.();
          }}
          onTouchEnd={handleAttackReleaseEvent}
          onTouchCancel={handleAttackReleaseEvent}
          onPointerDown={event => {
            if (isTouchLikePointer(event)) {
              setButtonActive('attack', true);
            }
          }}
          onPointerUp={handleAttackReleaseEvent}
          onPointerCancel={handleAttackReleaseEvent}
          onMouseDown={event => {
            setButtonActive('attack', true);
            onAttackPress?.(event);
          }}
          onMouseUp={handleAttackReleaseEvent}
          onMouseLeave={handleAttackReleaseEvent}
          onClick={event => {
            event.preventDefault();
            onAttack?.();
          }}
        >
          <span className={styles.buttonIcon} aria-hidden="true">
            ⚔️
          </span>
          <span className={styles.buttonLabel}>
            Ataque
          </span>
          {showButtonLegends && (
            <span
              className={styles.buttonLegend}
              aria-hidden="true"
              data-touch-legend="true"
            >
              Ataque
            </span>
          )}
        </button>

        <button
          type="button"
          className={joinClassNames(
            styles.button,
            styles.dashButton,
            dashReady ? styles.chargeReady : styles.chargeEmpty,
            dashReady ? null : styles.cooldownState,
            dashReady ? null : styles.disabled,
            activeButtons.dash ? styles.buttonActive : null,
            activeButtons.dash ? styles.dashButtonActive : null,
          )}
          onClick={onDash}
          aria-label={dashAriaLabel}
          aria-disabled={!dashReady}
          aria-describedby={dashStatusId}
          onTouchStart={event => {
            event.preventDefault();
            if (dashReady) {
              setButtonActive('dash', true);
              onDash?.();
            }
          }}
          onTouchEnd={handleDashTouchEnd}
          onTouchCancel={handleDashTouchEnd}
          onPointerDown={event => {
            if (!dashReady || !isTouchLikePointer(event)) {
              return;
            }

            setButtonActive('dash', true);
          }}
          onPointerUp={event => {
            if (isTouchLikePointer(event)) {
              handleDashTouchEnd(event);
            }
          }}
          onPointerCancel={event => {
            if (isTouchLikePointer(event)) {
              handleDashTouchEnd(event);
            }
          }}
          disabled={!dashReady}
        >
          {!dashReady && (
            <div
              className={styles.cooldownOverlay}
              aria-hidden="true"
              style={{ '--cooldown-progress': `${100 - dashChargePercent}%` }}
            />
          )}
          <span className={styles.buttonIcon} aria-hidden="true">💨</span>
          <span className={joinClassNames(styles.cooldownLabel, styles.dashLabel)}>
            {dashReady ? 'Pronto' : dashChargeDisplay}
          </span>
          <span
            className={joinClassNames(styles.buttonLabel, styles.buttonLabelBottom)}
            aria-hidden="true"
          >
            Dash
          </span>
          {showButtonLegends && (
            <span
              className={styles.buttonLegend}
              aria-hidden="true"
              data-touch-legend="true"
            >
              Dash
            </span>
          )}
        </button>
        <span
          id={dashStatusId}
          className={styles.visuallyHidden}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {dashValueText}
        </span>

        <button
          type="button"
          className={joinClassNames(
            styles.button,
            styles.skillButton,
            skillDisabled ? styles.skillDisabled : styles.skillReady,
            showSkillCooldown ? styles.cooldownState : null,
            skillDisabled ? styles.disabled : null,
            activeButtons.skill ? styles.buttonActive : null,
            activeButtons.skill ? styles.skillButtonActive : null,
          )}
          onClick={onUseSkill}
          aria-label={skillAriaLabel}
          aria-disabled={skillDisabled}
          aria-describedby={skillStatusId}
          onTouchStart={event => {
            event.preventDefault();
            if (!skillDisabled) {
              setButtonActive('skill', true);
              onUseSkill?.();
            }
          }}
          onTouchEnd={handleSkillTouchEnd}
          onTouchCancel={handleSkillTouchEnd}
          onPointerDown={event => {
            if (skillDisabled || !isTouchLikePointer(event)) {
              return;
            }

            setButtonActive('skill', true);
          }}
          onPointerUp={event => {
            if (isTouchLikePointer(event)) {
              handleSkillTouchEnd(event);
            }
          }}
          onPointerCancel={event => {
            if (isTouchLikePointer(event)) {
              handleSkillTouchEnd(event);
            }
          }}
          disabled={skillDisabled}
          title={skillAriaLabel}
        >
          {showSkillCooldown && (
            <div
              className={joinClassNames(styles.cooldownOverlay, styles.skillCooldownOverlay)}
              aria-hidden="true"
              style={{ '--cooldown-progress': `${100 - skillCooldownPercentClamped}%` }}
            />
          )}
          <span className={styles.buttonIcon} aria-hidden="true">
            {hasCurrentSkill ? currentSkillIcon : '🌀'}
          </span>
          {showSkillCooldown && (
            <span
              className={joinClassNames(styles.cooldownLabel, styles.skillCooldownLabel)}
            >
              {skillCooldownDisplay}
            </span>
          )}
          <span
            className={joinClassNames(
              styles.skillLabel,
              showSkillCooldown ? styles.skillLabelHidden : styles.skillCostLabel,
              skillLabelColorClass,
            )}
            aria-live="polite"
            aria-atomic="true"
          >
            {hasCurrentSkill ? (showSkillCooldown ? '' : currentSkillCost) : '--'}
          </span>
          <span
            className={joinClassNames(
              styles.buttonLabel,
              styles.buttonLabelTop,
              hasCurrentSkill && !skillDisabled
                ? styles.buttonLabelHighlight
                : styles.buttonLabelMuted,
            )}
            aria-hidden="true"
          >
            Habilidade
          </span>
          {showButtonLegends && (
            <span
              className={styles.buttonLegend}
              aria-hidden="true"
              data-touch-legend="true"
            >
              Habilidade
            </span>
          )}
        </button>
        <span
          id={skillStatusId}
          className={styles.visuallyHidden}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {skillValueText}
        </span>

        <button
          type="button"
          className={joinClassNames(
            styles.button,
            styles.cycleSkillButton,
            hasCurrentSkill ? styles.cycleSkillReady : styles.disabled,
            activeButtons.cycle ? styles.buttonActive : null,
            activeButtons.cycle ? styles.cycleSkillButtonActive : null,
          )}
          onClick={event => {
            event.preventDefault();
            onCycleSkill?.();
          }}
          aria-label={cycleSkillAriaLabel}
          aria-disabled={!hasCurrentSkill}
          onTouchStart={event => {
            event.preventDefault();
            if (hasCurrentSkill) {
              setButtonActive('cycle', true);
              onCycleSkill?.();
            }
          }}
          onTouchEnd={handleCycleSkillTouchEnd}
          onTouchCancel={handleCycleSkillTouchEnd}
          onPointerDown={event => {
            if (!hasCurrentSkill || !isTouchLikePointer(event)) {
              return;
            }

            setButtonActive('cycle', true);
          }}
          onPointerUp={event => {
            if (isTouchLikePointer(event)) {
              handleCycleSkillTouchEnd(event);
            }
          }}
          onPointerCancel={event => {
            if (isTouchLikePointer(event)) {
              handleCycleSkillTouchEnd(event);
            }
          }}
          disabled={!hasCurrentSkill}
        >
          <span className={styles.buttonIcon} aria-hidden="true">
            🔄
          </span>
          <span
            className={joinClassNames(styles.buttonLabel, styles.buttonLabelBottom)}
            aria-hidden="true"
          >
            Trocar
          </span>
          {showButtonLegends && (
            <span
              className={styles.buttonLegend}
              aria-hidden="true"
              data-touch-legend="true"
            >
              Trocar
            </span>
          )}
        </button>

        <button
          type="button"
          className={joinClassNames(
            styles.button,
            styles.evolveButton,
            canEvolve ? styles.evolveReady : styles.evolveLocked,
            canEvolve ? null : styles.disabled,
            activeButtons.evolve ? styles.buttonActive : null,
            activeButtons.evolve ? styles.evolveButtonActive : null,
          )}
          onClick={onOpenEvolutionMenu}
          aria-label={evolveAriaLabel}
          aria-disabled={!canEvolve}
          onTouchStart={() => {
            if (canEvolve) {
              setButtonActive('evolve', true);
            }
          }}
          onTouchEnd={() => {
            setButtonActive('evolve', false);
          }}
          onTouchCancel={() => {
            setButtonActive('evolve', false);
          }}
          onPointerDown={event => {
            if (!canEvolve || !isTouchLikePointer(event)) {
              return;
            }

            setButtonActive('evolve', true);
          }}
          onPointerUp={event => {
            if (isTouchLikePointer(event)) {
              setButtonActive('evolve', false);
            }
          }}
          onPointerCancel={event => {
            if (isTouchLikePointer(event)) {
              setButtonActive('evolve', false);
            }
          }}
          disabled={!canEvolve}
        >
          <span className={styles.buttonIcon} aria-hidden="true">
            🧬
          </span>
          <span
            className={joinClassNames(styles.buttonLabel, styles.buttonLabelBottom)}
            aria-hidden="true"
          >
            Evoluir
          </span>
          {showButtonLegends && (
            <span
              className={styles.buttonLegend}
              aria-hidden="true"
              data-touch-legend="true"
            >
              Evoluir
            </span>
          )}
        </button>
      </div>
    </div>
  );
};

export default TouchControls;
