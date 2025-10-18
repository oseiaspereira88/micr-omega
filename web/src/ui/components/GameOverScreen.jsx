import React, { useEffect, useId, useRef } from 'react';
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
        className={styles.container}
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

        <div id={descriptionId} className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Pontuação Final</div>
          <div className={styles.summaryScore}>{formattedScore}</div>
          <span className={styles.summaryDetail}>🧬 Nível Alcançado: {formattedLevel}</span>
          <span className={styles.summaryDetail}>🔥 Combo Máximo: x{formattedMaxCombo}</span>
        </div>

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
