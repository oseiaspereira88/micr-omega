import React, { useCallback, useMemo, useState } from 'react';
import SplashScreen from './SplashScreen.jsx';
import MainMenuScreen from './MainMenuScreen.jsx';
import LobbyScreen from './LobbyScreen.jsx';
import conceptStyles from '../concepts/MicroWorldConceptScreens.module.css';
import styles from './MicroWorldOnboardingFlow.module.css';

const onboardingSteps = [
  {
    key: 'splash',
    title: 'Micr•Omega Activation',
    description:
      'Inicie a ligação neural com o centro de comando. Observe a biometria estabilizar enquanto o mundo é gerado.',
    ctaLabel: 'Próximo',
    render: () => (
      <div className={`${styles.viewportCanvas} ${conceptStyles.splashCanvas}`}>
        <SplashScreen />
      </div>
    ),
  },
  {
    key: 'menu',
    title: 'Escolha seu caminho',
    description:
      'Configure seu esquadrão, verifique os destaques da temporada e pulse Play para mergulhar na batalha.',
    ctaLabel: 'Próximo',
    render: () => (
      <div className={`${styles.viewportCanvas} ${conceptStyles.menuCanvas}`}>
        <MainMenuScreen />
      </div>
    ),
  },
  {
    key: 'lobby',
    title: 'Localize a sala ideal',
    description:
      'Use filtros de região e modo para encontrar o clã certo. Quando estiver pronto, entre e lidere a evolução.',
    ctaLabel: 'Entrar no jogo',
    render: () => (
      <div className={`${styles.viewportCanvas} ${conceptStyles.lobbyCanvas}`}>
        <LobbyScreen />
      </div>
    ),
  },
];

const MicroWorldOnboardingFlow = ({ onAdvance, onComplete }) => {
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  const { activeStep, activeIndex, totalSteps, isFinalStep } = useMemo(() => {
    const total = onboardingSteps.length;
    const safeIndex = Math.min(Math.max(activeStepIndex, 0), total - 1);
    return {
      activeStep: onboardingSteps[safeIndex],
      activeIndex: safeIndex,
      totalSteps: total,
      isFinalStep: safeIndex === total - 1,
    };
  }, [activeStepIndex]);

  const handleAdvance = useCallback(() => {
    if (!activeStep) {
      return;
    }

    const currentIndex = activeIndex;
    const nextIndex = currentIndex + 1;

    if (nextIndex < onboardingSteps.length) {
      setActiveStepIndex(nextIndex);
      if (typeof onAdvance === 'function') {
        onAdvance({
          currentIndex,
          currentStep: activeStep.key,
          nextIndex,
          nextStep: onboardingSteps[nextIndex].key,
        });
      }
      return;
    }

    if (typeof onComplete === 'function') {
      onComplete({
        currentIndex,
        currentStep: activeStep.key,
      });
    }
  }, [activeStep, activeIndex, onAdvance, onComplete]);

  if (!activeStep) {
    return null;
  }

  return (
    <div className={styles.flowRoot} data-testid="micro-world-onboarding-flow">
      <div className={styles.aura} />
      <header className={styles.header}>
        <p className={styles.kicker}>Micr•Omega Protocol</p>
        <h1 className={styles.heading}>{activeStep.title}</h1>
        <p className={styles.subheading}>{activeStep.description}</p>
      </header>
      <div className={styles.stage}>
        <div className={styles.viewport} data-testid="onboarding-stage">
          {activeStep.render()}
        </div>
      </div>
      <div className={styles.controls}>
        <div className={styles.stepMeta}>
          <span className={styles.stepLabel}>
            Etapa {activeIndex + 1} de {totalSteps}
          </span>
          <span className={styles.stepTitle}>{activeStep.title}</span>
        </div>
        <div className={styles.progressTrack}>
          {onboardingSteps.map((step) => {
            const isActive = step.key === activeStep.key;
            return (
              <span
                key={step.key}
                className={`${styles.progressDot} ${isActive ? styles.progressDotActive : ''}`.trim()}
              />
            );
          })}
        </div>
        <button
          type="button"
          className={styles.primaryCta}
          onClick={handleAdvance}
          data-testid="onboarding-cta"
        >
          {activeStep.ctaLabel ?? (isFinalStep ? 'Entrar no jogo' : 'Próximo')}
        </button>
      </div>
    </div>
  );
};

export default MicroWorldOnboardingFlow;
