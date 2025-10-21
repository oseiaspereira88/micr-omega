import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import styles from './TouchControls.module.css';
import {
  JOYSTICK_SENSITIVITY_MAX,
  JOYSTICK_SENSITIVITY_MIN,
  TOUCH_CONTROL_SCALE_MAX,
  TOUCH_CONTROL_SCALE_MIN,
} from '../../config/touchControls';

const joinClassNames = (...classes) => classes.filter(Boolean).join(' ');

const clamp = (value, min, max) => {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
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
  touchControlScale = 1,
  joystickSensitivity = 1,
  className,
  ...a11yProps
}) => {
  const [viewport, setViewport] = useState(getViewportSize);
  const actionGroupRef = useRef(null);

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

  const effectiveTouchMultiplier = useMemo(() => {
    const clampedMultiplier = clamp(
      touchControlScale,
      TOUCH_CONTROL_SCALE_MIN,
      TOUCH_CONTROL_SCALE_MAX,
    );
    return clampedMultiplier;
  }, [touchControlScale]);

  const effectiveJoystickSensitivity = useMemo(
    () => clamp(joystickSensitivity, JOYSTICK_SENSITIVITY_MIN, JOYSTICK_SENSITIVITY_MAX),
    [joystickSensitivity],
  );

  const decorateJoystickEvent = useCallback(
    event => {
      if (!event) {
        return event;
      }

      const sensitivity = effectiveJoystickSensitivity;
      try {
        // eslint-disable-next-line no-param-reassign
        event.micrOmegaJoystickSensitivity = sensitivity;
      } catch (error) {
        // Ignore if event is immutable
      }

      const nativeEvent = event?.nativeEvent;
      if (nativeEvent && typeof nativeEvent === 'object') {
        try {
          // eslint-disable-next-line no-param-reassign
          nativeEvent.micrOmegaJoystickSensitivity = sensitivity;
        } catch (error) {
          // Ignore if nativeEvent is immutable
        }
      }

      return event;
    },
    [effectiveJoystickSensitivity],
  );

  const effectiveTouchScale = useMemo(
    () => touchScale * effectiveTouchMultiplier,
    [effectiveTouchMultiplier, touchScale],
  );

  const touchVerticalScale = useMemo(
    () => effectiveTouchScale * heightScale,
    [effectiveTouchScale, heightScale],
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
  const dashReady = dashCharge >= 30;
  const dashChargePercent = clampProgress(dashCharge);
  const dashValueText = dashReady
    ? 'Dash carregado'
    : `Dash carregando: ${dashChargePercent}%`;
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

  const handleAttackReleaseEvent = event => {
    event.preventDefault();
    onAttackRelease?.();
  };

  const handleDashTouchEnd = event => {
    event.preventDefault();
  };

  const handleSkillTouchEnd = event => {
    event.preventDefault();
  };

  const handleCycleSkillTouchEnd = event => {
    event.preventDefault();
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
  }, [effectiveLayout, effectiveTouchScale, showButtonLegends]);

  const isTouchLikePointer = event => {
    const pointerType =
      typeof event.pointerType === 'string' ? event.pointerType.toLowerCase() : event.pointerType;

    return pointerType === 'touch' || pointerType === 'pen' || pointerType === '';
  };

  const handleJoystickPointerStart = event => {
    if (!isTouchLikePointer(event)) return;
    decorateJoystickEvent(event);
    onJoystickStart?.(event);
  };

  const handleJoystickPointerMove = event => {
    if (!isTouchLikePointer(event)) return;
    decorateJoystickEvent(event);
    onJoystickMove?.(event);
  };

  const handleJoystickPointerEnd = event => {
    if (!isTouchLikePointer(event)) return;
    decorateJoystickEvent(event);
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
        '--touch-scale': effectiveTouchScale.toFixed(3),
        '--touch-vertical-scale': touchVerticalScale.toFixed(3),
        '--touch-legend-space': showButtonLegends
          ? `${Math.round(effectiveTouchScale * 26)}px`
          : '0px',
      }}
    >
      <div
        className={styles.joystickZone}
        onPointerDown={handleJoystickPointerStart}
        onPointerMove={handleJoystickPointerMove}
        onPointerUp={handleJoystickPointerEnd}
        onPointerCancel={handleJoystickPointerEnd}
        onTouchStart={onJoystickStart}
        onTouchMove={onJoystickMove}
        onTouchEnd={onJoystickEnd}
        onTouchCancel={onJoystickEnd}
        data-joystick-sensitivity={effectiveJoystickSensitivity.toFixed(3)}
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
          className={joinClassNames(styles.button, styles.attackButton)}
          aria-label="Executar ataque básico"
          onTouchStart={event => {
            event.preventDefault();
            onAttackPress?.();
          }}
          onTouchEnd={handleAttackReleaseEvent}
          onTouchCancel={handleAttackReleaseEvent}
          onPointerUp={handleAttackReleaseEvent}
          onPointerCancel={handleAttackReleaseEvent}
          onMouseDown={onAttackPress}
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
          <span className={styles.buttonLabel} aria-hidden="true">
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
          )}
          onClick={onDash}
          aria-label={dashAriaLabel}
          aria-disabled={!dashReady}
          aria-describedby={dashStatusId}
          onTouchStart={event => {
            event.preventDefault();
            if (dashReady) {
              onDash?.();
            }
          }}
          onTouchEnd={handleDashTouchEnd}
          onTouchCancel={handleDashTouchEnd}
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
            {dashReady ? 'Pronto' : `${dashChargePercent}%`}
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
          )}
          onClick={onUseSkill}
          aria-label={skillAriaLabel}
          aria-disabled={skillDisabled}
          aria-describedby={skillStatusId}
          onTouchStart={event => {
            event.preventDefault();
            if (!skillDisabled) {
              onUseSkill?.();
            }
          }}
          onTouchEnd={handleSkillTouchEnd}
          onTouchCancel={handleSkillTouchEnd}
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
              onCycleSkill?.();
            }
          }}
          onTouchEnd={handleCycleSkillTouchEnd}
          onTouchCancel={handleCycleSkillTouchEnd}
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
          )}
          onClick={onOpenEvolutionMenu}
          aria-label={evolveAriaLabel}
          aria-disabled={!canEvolve}
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
