import React from 'react';
import styles from './GameOverScreen.module.css';

const numberFormatter = new Intl.NumberFormat('pt-BR');

const GameOverScreen = ({ score, level, maxCombo, onRestart }) => {
  const formattedScore = numberFormatter.format(score ?? 0);
  const formattedLevel = numberFormatter.format(level ?? 0);
  const formattedMaxCombo = numberFormatter.format(maxCombo ?? 0);

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Game Over</h1>

      <div className={styles.summaryCard}>
        <div className={styles.summaryLabel}>Pontuação Final</div>
        <div className={styles.summaryScore}>{formattedScore}</div>
        <span className={styles.summaryDetail}>🧬 Nível Alcançado: {formattedLevel}</span>
        <span className={styles.summaryDetail}>🔥 Combo Máximo: x{formattedMaxCombo}</span>
      </div>

      <button type="button" className={styles.restartButton} onClick={onRestart}>
        🔄 Jogar Novamente
      </button>
    </div>
  );
};

export default GameOverScreen;
