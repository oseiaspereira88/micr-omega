import React, { useCallback, useState } from 'react';
import SplashScreen from '../onboarding/SplashScreen.jsx';
import MainMenuScreen from '../onboarding/MainMenuScreen.jsx';
import LobbyScreen from '../onboarding/LobbyScreen.jsx';
import styles from './MicroWorldConceptScreens.module.css';

const ScreenPreview = ({ title, orientation = 'desktop', canvasClass, children }) => {
  const resolution = orientation === 'mobile' ? '1080 × 1920' : '1920 × 1080';

  return (
    <div className={styles.previewCard}>
      <div
        className={[
          styles.previewViewport,
          orientation === 'mobile' ? styles.mobileViewport : styles.desktopViewport,
          canvasClass,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className={styles.previewGlow} />
        <div className={styles.previewContent}>{children}</div>
      </div>
      <div className={styles.previewMeta}>
        <span className={styles.previewTitle}>{title}</span>
        <span className={styles.previewResolution}>{resolution}</span>
      </div>
    </div>
  );
};

const conceptSteps = [
  {
    key: 'splash',
    label: 'Splash Screen',
    render: () => (
      <section className={styles.section}>
        <div className={styles.sectionCopy}>
          <h2>Splash Screen</h2>
          <p>
            A cinematic entry with radiant logo, responsive progress feedback, and ambient micro-fauna
            silhouettes that hint at the life waiting inside each session.
          </p>
          <ul>
            <li>Dynamic glow around the game emblem with subtle parallax particles.</li>
            <li>Sequential loading messages for world-building immersion.</li>
            <li>Bioluminescent micro-creatures orbiting within the glass layers.</li>
          </ul>
        </div>
        <div className={styles.sectionGallery}>
          <ScreenPreview title="Splash Screen — Desktop" canvasClass={styles.splashCanvas}>
            <SplashScreen />
          </ScreenPreview>
          <ScreenPreview
            title="Splash Screen — Mobile"
            orientation="mobile"
            canvasClass={`${styles.splashCanvas} ${styles.mobileSplash}`}
          >
            <SplashScreen variant="mobile" />
          </ScreenPreview>
        </div>
      </section>
    ),
  },
  {
    key: 'menu',
    label: 'Main Menu',
    render: () => (
      <section className={styles.section}>
        <div className={styles.sectionCopy}>
          <h2>Main Menu</h2>
          <p>
            A glassmorphic command center highlighting immediate play, personalised progression, and
            animated world updates.
          </p>
          <ul>
            <li>Primary “Play” call-to-action with animated neon breathing edge.</li>
            <li>Modular cards for profile, missions, shop, and social presence.</li>
            <li>Responsive news ticker with holographic banners and subtle depth.</li>
          </ul>
        </div>
        <div className={styles.sectionGallery}>
          <ScreenPreview title="Main Menu — Desktop" canvasClass={styles.menuCanvas}>
            <MainMenuScreen />
          </ScreenPreview>
          <ScreenPreview
            title="Main Menu — Mobile"
            orientation="mobile"
            canvasClass={`${styles.menuCanvas} ${styles.menuMobileCanvas}`}
          >
            <MainMenuScreen variant="mobile" />
          </ScreenPreview>
        </div>
      </section>
    ),
  },
  {
    key: 'lobby',
    label: 'Lobby',
    render: () => (
      <section className={styles.section}>
        <div className={styles.sectionCopy}>
          <h2>Lobby — Seleção de Salas</h2>
          <p>
            Salas exibidas em cards translúcidos com indicadores claros de disponibilidade, ping e
            recompensas, mantendo a leitura fluida entre desktop e mobile.
          </p>
          <ul>
            <li>Aba lateral para criar sala com destaque em neon cristalino.</li>
            <li>Filtros por região, idioma e modo com feedback ativo.</li>
            <li>Cards premium com cadeado e ação de desbloqueio com moeda 💎.</li>
          </ul>
        </div>
        <div className={styles.sectionGallery}>
          <ScreenPreview title="Lobby — Desktop" canvasClass={styles.lobbyCanvas}>
            <LobbyScreen />
          </ScreenPreview>
          <ScreenPreview
            title="Lobby — Mobile"
            orientation="mobile"
            canvasClass={`${styles.lobbyCanvas} ${styles.lobbyMobileCanvas}`}
          >
            <LobbyScreen variant="mobile" />
          </ScreenPreview>
        </div>
      </section>
    ),
  },
];

const MicroWorldConceptScreens = ({ onAdvance, onContinue }) => {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const totalSteps = conceptSteps.length;
  const safeIndex = Math.min(Math.max(activeStepIndex, 0), totalSteps - 1);
  const activeStep = conceptSteps[safeIndex] ?? conceptSteps[0];
  const StepContent = activeStep.render;

  const handleAdvance = useCallback(() => {
    if (safeIndex < totalSteps - 1) {
      const nextIndex = safeIndex + 1;
      setActiveStepIndex(nextIndex);
      if (typeof onAdvance === 'function') {
        onAdvance({
          currentIndex: safeIndex,
          currentStep: activeStep.key,
          nextIndex,
          nextStep: conceptSteps[nextIndex].key,
        });
      }
      return;
    }

    if (typeof onContinue === 'function') {
      onContinue({
        currentIndex: safeIndex,
        currentStep: activeStep.key,
      });
    }
  }, [safeIndex, totalSteps, onAdvance, onContinue, activeStep]);

  const ctaLabel = safeIndex === totalSteps - 1 ? 'Entrar no jogo' : 'Próximo';

  return (
    <div className={styles.page}>
      <div className={styles.backgroundAura} />
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Micr•Omega — Interface Vision</p>
          <h1 className={styles.heading}>Evolving Microworlds UI Kit</h1>
          <p className={styles.subtitle}>
            Futuristic-bioluminescent aesthetics crafted for a cross-platform multiplayer experience.
            Each screen blends organic motion, sci-fi clarity, and responsive comfort.
          </p>
        </div>
        <div className={styles.themePalette}>
          <span className={styles.themeChip}>Dark Flux</span>
          <span className={`${styles.themeChip} ${styles.themeChipAlt}`}>Luminous Drift</span>
          <span className={`${styles.themeChip} ${styles.themeChipOutline}`}>Glass Neon</span>
        </div>
      </header>
      <StepContent />
      <div className={styles.actionsBar}>
        <div className={styles.stepMeta}>
          <span className={styles.stepTitle}>
            Etapa {safeIndex + 1} de {totalSteps}
          </span>
          <span className={styles.stepDescription}>{activeStep.label}</span>
        </div>
        <button type="button" className={styles.primaryCta} onClick={handleAdvance}>
          {ctaLabel}
        </button>
      </div>
    </div>
  );
};

export default MicroWorldConceptScreens;
