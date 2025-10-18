import React, { useCallback, useEffect, useMemo, useState } from 'react';
import SplashScreen from './SplashScreen.jsx';
import MainMenuScreen from './MainMenuScreen.jsx';
import LobbyScreen from './LobbyScreen.jsx';
import styles from './MicroWorldOnboardingFlow.module.css';

const STAGE_SEQUENCE = ['splash', 'menu', 'lobby'];

const isTestEnvironment =
  typeof import.meta !== 'undefined' && typeof import.meta.env !== 'undefined'
    ? import.meta.env.MODE === 'test'
    : false;

const STAGE_METADATA = {
  splash: {
    phaseLabel: 'Micr•Omega Boot Sequence',
    title: 'Sincronizando com o Núcleo',
    description:
      'Aperte os cintos: a ponte neural está estabelecendo o vínculo inicial enquanto as criaturas microscópicas despertam.',
    timelineLabel: 'Boot',
    status: 'Calibrando sensores e carregando ambiente.',
    autoAdvanceAfter: 5200,
  },
  menu: {
    phaseLabel: 'Centro de Comando',
    title: 'Hangar de Operações',
    description:
      'Revise seu esquadrão, verifique as recompensas do dia e prepare-se para mergulhar na próxima incursão.',
    timelineLabel: 'Comando',
    status: 'Aguardando confirmação do piloto para acessar o lobby.',
  },
  lobby: {
    phaseLabel: 'Coordenação de Missão',
    title: 'Lobby Micr•Omega',
    description:
      'Selecione a sala ideal, organize seu time e sincronize as regras de partida antes de iniciar a invasão.',
    timelineLabel: 'Lobby',
    status: 'Selecione uma sala pública para avançar para a configuração.',
  },
};

const MicroWorldOnboardingFlow = ({ onAdvance, onComplete }) => {
  const [activeStage, setActiveStage] = useState('splash');

  const stageConfig = useMemo(() => STAGE_METADATA[activeStage] ?? STAGE_METADATA.splash, [activeStage]);

  const goToStage = useCallback(
    (nextStage) => {
      if (!STAGE_SEQUENCE.includes(nextStage)) {
        return;
      }

      setActiveStage((current) => {
        if (current === nextStage) {
          return current;
        }
        const currentIndex = STAGE_SEQUENCE.indexOf(current);
        const nextIndex = STAGE_SEQUENCE.indexOf(nextStage);

        if (typeof onAdvance === 'function' && nextIndex !== -1) {
          onAdvance({
            currentIndex,
            currentStep: current,
            nextIndex,
            nextStep: nextStage,
          });
        }

        return nextStage;
      });
    },
    [onAdvance],
  );

  useEffect(() => {
    if (activeStage !== 'splash') {
      return undefined;
    }

    const { autoAdvanceAfter = 5200 } = STAGE_METADATA.splash;
    const splashDelay = isTestEnvironment ? 50 : autoAdvanceAfter;

    const timer = setTimeout(() => {
      goToStage('menu');
    }, Math.max(0, splashDelay));

    return () => {
      clearTimeout(timer);
    };
  }, [activeStage, goToStage]);

  const handlePlay = useCallback(() => {
    goToStage('lobby');
  }, [goToStage]);

  const handleEnterPublic = useCallback(() => {
    if (typeof onComplete === 'function') {
      onComplete({
        currentStage: 'lobby',
        currentIndex: STAGE_SEQUENCE.indexOf('lobby'),
      });
    }
  }, [onComplete]);

  const timelineItems = useMemo(
    () =>
      STAGE_SEQUENCE.map((key) => ({
        key,
        label: STAGE_METADATA[key]?.timelineLabel ?? key,
        active: key === activeStage,
      })),
    [activeStage],
  );

  return (
    <div className={styles.flowRoot} data-testid="micro-world-onboarding-flow">
      <div className={styles.backgroundLayer} />
      <header className={styles.header}>
        <span className={styles.phaseLabel}>{stageConfig.phaseLabel}</span>
        <h1 className={styles.title}>{stageConfig.title}</h1>
        <p className={styles.description}>{stageConfig.description}</p>
      </header>
      <div className={styles.stageArea}>
        <div className={styles.stageShell}>
          <div className={styles.stageGlow} />
          <div className={styles.stageContent}>
            {activeStage === 'splash' && <SplashScreen />}
            {activeStage === 'menu' && <MainMenuScreen onPlay={handlePlay} />}
            {activeStage === 'lobby' && <LobbyScreen onJoinPublic={handleEnterPublic} />}
          </div>
        </div>
      </div>
      <div className={styles.statusRow}>
        <div className={styles.statusPrimary}>
          <strong>Sequência atual</strong>
          <span>{stageConfig.status}</span>
        </div>
        <div className={styles.statusTimeline}>
          {timelineItems.map((item) => (
            <span key={item.key} data-active={item.active ? 'true' : 'false'}>
              {item.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MicroWorldOnboardingFlow;
