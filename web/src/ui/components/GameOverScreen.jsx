import React, { useEffect, useRef } from 'react';
import styles from './GameOverScreen.module.css';

const numberFormatter = new Intl.NumberFormat('pt-BR');

const formatStat = (value) => {
  const numericValue = Number(value);

  if (Number.isFinite(numericValue)) {
    return numberFormatter.format(numericValue);
  }

  return numberFormatter.format(0);
};

const GameOverScreen = ({ score, level, maxCombo, onRestart, onQuit }) => {
  const restartButtonRef = useRef(null);
  const quitButtonRef = useRef(null);
  const formattedScore = formatStat(score);
  const formattedLevel = formatStat(level);
  const formattedMaxCombo = formatStat(maxCombo);

  useEffect(() => {
    if (restartButtonRef.current) {
      restartButtonRef.current.focus();
      return;
    }

    if (quitButtonRef.current) {
      quitButtonRef.current.focus();
    }
  }, []);

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Game Over</h1>

      <div className={styles.summaryCard}>
        <div className={styles.summaryLabel}>Pontuação Final</div>
        <div className={styles.summaryScore}>{formattedScore}</div>
        <span className={styles.summaryDetail}>🧬 Nível Alcançado: {formattedLevel}</span>
        <span className={styles.summaryDetail}>🔥 Combo Máximo: x{formattedMaxCombo}</span>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.restartButton}
          onClick={onRestart}
          ref={restartButtonRef}
        >
          🔄 Jogar Novamente
        </button>

        {onQuit ? (
          <button
            type="button"
            className={styles.quitButton}
            onClick={onQuit}
            ref={quitButtonRef}
          >
            🚪 Sair da sala
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default GameOverScreen;
