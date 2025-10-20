import React, { useEffect, useId, useRef, useState } from 'react';
import styles from './GameOverScreen.module.css';

const numberFormatter = new Intl.NumberFormat('pt-BR');

const formatStat = (value) => {
  const numericValue = Number(value);

  if (Number.isFinite(numericValue)) {
    return numberFormatter.format(numericValue);
  }

  return numberFormatter.format(0);
};

const focusableSelectors =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

const GameOverScreen = ({ score, level, maxCombo, onRestart, onQuit }) => {
  const dialogRef = useRef(null);
  const focusableElementsRef = useRef([]);
  const formattedScore = formatStat(score);
  const formattedLevel = formatStat(level);
  const formattedMaxCombo = formatStat(maxCombo);
  const titleId = useId();
  const descriptionId = useId();
  const hasQuitAction = Boolean(onQuit);
  const [viewportState, setViewportState] = useState({
    isMobile: false,
    isCompact: false,
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const mobileQuery = window.matchMedia('(max-width: 600px)');
    const compactQuery = window.matchMedia('(max-height: 720px)');

    const updateViewportState = () => {
      setViewportState((prevState) => {
        const nextState = {
          isMobile: mobileQuery.matches,
          isCompact: compactQuery.matches,
        };

        if (
          prevState.isMobile === nextState.isMobile &&
          prevState.isCompact === nextState.isCompact
        ) {
          return prevState;
        }

        return nextState;
      });
    };

    updateViewportState();

    const handleChange = () => {
      updateViewportState();
    };

    const attachListener = (query) => {
      if (typeof query.addEventListener === 'function') {
        query.addEventListener('change', handleChange);
        return () => query.removeEventListener('change', handleChange);
      }

      query.addListener(handleChange);
      return () => query.removeListener(handleChange);
    };

    const detachMobile = attachListener(mobileQuery);
    const detachCompact = attachListener(compactQuery);

    return () => {
      detachMobile();
      detachCompact();
    };
  }, []);

  const { isMobile, isCompact } = viewportState;
  const containerClassName = [
    styles.container,
    isMobile ? styles.mobile : '',
    isCompact ? styles.compact : '',
  ]
    .filter(Boolean)
    .join(' ');

  const stats = [
    {
      key: 'level',
      label: 'Nível Alcançado',
      value: formattedLevel,
      icon: '🧬',
    },
    {
      key: 'maxCombo',
      label: 'Combo Máximo',
      value: `x${formattedMaxCombo}`,
      icon: '🔥',
    },
  ];

  useEffect(() => {
    if (!dialogRef.current) {
      return;
    }

    const focusableElements = Array.from(
      dialogRef.current.querySelectorAll(focusableSelectors)
    ).filter((element) => !element.hasAttribute('disabled'));

    focusableElementsRef.current = focusableElements;

    const firstFocusable = focusableElementsRef.current[0];

    if (firstFocusable) {
      firstFocusable.focus();
      return;
    }

    dialogRef.current.focus();
  }, [hasQuitAction]);

  const handleKeyDown = (event) => {
    if (event.key !== 'Tab' || !dialogRef.current) {
      return;
    }

    const focusableElements = focusableElementsRef.current;

    if (!focusableElements.length) {
      return;
    }

    const { activeElement } = document;
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey) {
      if (activeElement === firstElement || !dialogRef.current.contains(activeElement)) {
        event.preventDefault();
        lastElement.focus();
      }
      return;
    }

    if (activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  return (
    <div className={styles.backdrop}>
      <div
        className={containerClassName}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onKeyDown={handleKeyDown}
        ref={dialogRef}
        tabIndex={-1}
      >
        <h1 id={titleId} className={styles.title}>
          Game Over
        </h1>

        <section id={descriptionId} className={styles.summaryCard}>
          <header className={styles.summaryHeader}>
            <p className={styles.summaryLabel}>Pontuação Final</p>
            <p className={styles.summaryScore}>{formattedScore}</p>
          </header>

          <ul className={styles.statsList}>
            {stats.map((stat) => (
              <li key={stat.key} className={styles.statCard}>
                <span className={styles.statIcon} aria-hidden="true">
                  {stat.icon}
                </span>
                <div className={styles.statContent}>
                  <span className={styles.statLabel}>{stat.label}</span>
                  <span className={styles.statValue}>{stat.value}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <div className={styles.actions}>
          <button type="button" className={styles.restartButton} onClick={onRestart}>
            🔄 Jogar Novamente
          </button>

          {onQuit ? (
            <button type="button" className={styles.quitButton} onClick={onQuit}>
              🚪 Sair da sala
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default GameOverScreen;
