import React from 'react';
import styles from '../concepts/MicroWorldConceptScreens.module.css';

const MainMenuScreen = ({ variant = 'desktop' }) => {
  if (variant === 'mobile') {
    return (
      <div className={styles.menuLayoutMobile} data-testid="main-menu-screen-mobile">
        <div className={styles.profileSummaryMobile}>
          <div className={styles.avatarRingSmall}>
            <div className={styles.avatarGlow} />
            <span className={styles.avatarInitials}>AR</span>
          </div>
          <div>
            <p className={styles.profileName}>Artemis_Rift</p>
            <p className={styles.profileMeta}>Lvl 42 • XP 78%</p>
          </div>
        </div>
        <button type="button" className={styles.playButtonMobile}>
          Play
        </button>
        <div className={styles.mobileActionsRow}>
          <button type="button" className={styles.secondaryActionCompact}>⚙️</button>
          <button type="button" className={styles.secondaryActionCompact}>🛒</button>
          <button type="button" className={styles.secondaryActionCompact}>⭐</button>
          <button type="button" className={styles.secondaryActionCompact}>👥</button>
        </div>
        <div className={styles.newsStackMobile}>
          <div className={styles.newsBannerMobile}>
            <span className={styles.bannerTitle}>Nova mutação liberada</span>
            <span className={styles.bannerMeta}>Evento Eclipse Azul</span>
          </div>
          <div className={styles.newsBannerMobile}>
            <span className={styles.bannerTitle}>Temporada Genesis ++</span>
            <span className={styles.bannerMeta}>Reset em 3 dias</span>
          </div>
        </div>
        <footer className={styles.menuFooterMobile}>v1.3.0 • Privacy Policy</footer>
      </div>
    );
  }

  return (
    <div className={styles.menuLayout} data-testid="main-menu-screen">
      <div className={styles.menuTopRow}>
        <div className={styles.profileCard}>
          <div className={styles.avatarRing}>
            <div className={styles.avatarGlow} />
            <span className={styles.avatarInitials}>AR</span>
          </div>
          <div>
            <p className={styles.profileName}>Artemis_Rift</p>
            <p className={styles.profileMeta}>Lvl 42 • XP 78%</p>
          </div>
        </div>
        <button type="button" className={styles.playButton}>
          Play
        </button>
      </div>
      <div className={styles.secondaryGrid}>
        <button type="button" className={styles.secondaryAction}>⚙️ Settings</button>
        <button type="button" className={styles.secondaryAction}>🛒 Loja</button>
        <button type="button" className={styles.secondaryAction}>⭐ Missões</button>
        <button type="button" className={styles.secondaryAction}>👥 Amigos</button>
      </div>
      <div className={styles.newsPanel}>
        <div className={styles.newsBanner}>
          <span className={styles.bannerTitle}>Nova mutação liberada</span>
          <span className={styles.bannerMeta}>Evento Eclipse Azul • 02h restantes</span>
        </div>
        <div className={styles.newsBanner}>
          <span className={styles.bannerTitle}>Temporada Genesis ++</span>
          <span className={styles.bannerMeta}>Ranked reset em 3 dias</span>
        </div>
      </div>
      <footer className={styles.menuFooter}>
        <span>v1.3.0</span>
        <span>•</span>
        <span>Privacy Policy</span>
      </footer>
    </div>
  );
};

export default MainMenuScreen;
