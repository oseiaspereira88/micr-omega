import React from 'react';
import styles from './GameOverScreen.module.css';

const GameOverScreen = ({ score, level, maxCombo, onRestart }) => {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Game Over</h1>

      <div className={styles.summaryCard}>
        <div className={styles.summaryLabel}>Pontuação Final</div>
        <div className={styles.summaryScore}>{score}</div>
        <span className={styles.summaryDetail}>🧬 Nível Alcançado: {level}</span>
        <span className={styles.summaryDetail}>🔥 Combo Máximo: x{maxCombo || 0}</span>
      </div>

      <button type="button" className={styles.restartButton} onClick={onRestart}>
        🔄 Jogar Novamente
      </button>
    </div>
  );
};

export default GameOverScreen;
