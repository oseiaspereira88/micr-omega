import React from 'react';
import styles from './SplashScreen.module.css';

const SplashScreen = ({ variant = 'desktop' }) => {
  const testId = variant === 'mobile' ? 'splash-screen-mobile' : 'splash-screen';
  const className = [styles.root, variant === 'mobile' ? styles.mobile : ''].filter(Boolean).join(' ');

  return (
    <div className={className} data-testid={testId}>
      <div className={styles.glowLayer} />
      <div className={styles.gridLayer} />
      <div className={styles.orbLayer}>
        <span className={`${styles.particle} ${styles.particleOne}`} />
        <span className={`${styles.particle} ${styles.particleSecondary} ${styles.particleTwo}`} />
        <span className={`${styles.particle} ${styles.particleAccent} ${styles.particleThree}`} />
      </div>
      <div className={styles.content}>
        <span className={styles.protocol}>Micr•Omega Protocol</span>
        <h1 className={styles.title}>MICR•OMEGA</h1>
        <p className={styles.tagline}>Sincronizando com o núcleo biológico do campo de batalha.</p>
        <div className={styles.progressTrack}>
          <span className={styles.progressMeter} />
        </div>
        <div className={styles.statusFeed}>
          <span>Bio-scan alinhado</span>
          <span>Matriz neural calibrada</span>
          <span>Gerando ecossistemas dinâmicos</span>
        </div>
        <div className={styles.footer}>
          <span className={styles.signature}>CloseApps Neural Link</span>
          <span>Fluxo de ativação em progresso...</span>
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
