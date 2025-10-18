import React from 'react';
import styles from '../concepts/MicroWorldConceptScreens.module.css';

const SplashScreen = ({ variant = 'desktop' }) => {
  if (variant === 'mobile') {
    return (
      <div className={styles.splashSceneMobile} data-testid="splash-screen-mobile">
        <div className={styles.logoStackCompact}>
          <span className={styles.gameMark}>MICR•OMEGA</span>
          <span className={styles.gameVersion}>Phase Shift Loading</span>
        </div>
        <div className={styles.progressRailMobile}>
          <div className={styles.progressPulse} />
        </div>
        <div className={styles.loadingFeedMobile}>
          <span>Calibrating senses...</span>
          <span>Syncing data...</span>
        </div>
        <div className={styles.poweredBy}>Powered by CloseApps</div>
        <div className={styles.mobileOrbits}>
          <span className={`${styles.microOrb} ${styles.orbFour}`} />
          <span className={`${styles.microOrb} ${styles.orbFive}`} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.splashScene} data-testid="splash-screen">
      <div className={styles.logoStack}>
        <span className={styles.gameMark}>MICR•OMEGA</span>
        <span className={styles.gameVersion}>Evolution Protocol v2.1</span>
      </div>
      <div className={styles.progressRail}>
        <div className={styles.progressPulse} />
      </div>
      <div className={styles.loadingFeed}>
        <span>Loading environment...</span>
        <span>Syncing data...</span>
        <span>Stabilising biomes...</span>
      </div>
      <div className={styles.poweredBy}>Powered by CloseApps</div>
      <div className={styles.microSwarm}>
        <span className={`${styles.microOrb} ${styles.orbOne}`} />
        <span className={`${styles.microOrb} ${styles.orbTwo}`} />
        <span className={`${styles.microOrb} ${styles.orbThree}`} />
      </div>
    </div>
  );
};

export default SplashScreen;
