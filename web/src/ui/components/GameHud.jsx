import React, { useCallback, useId, useMemo, useState } from 'react';
import HudBar from './HudBar';
import BossHealthBar from './BossHealthBar';
import SkillWheel from './SkillWheel';
import Notifications from './Notifications';
import TouchControls from './TouchControls';
import CameraControls from './CameraControls';
import styles from './GameHud.module.css';
import RankingPanel from '../../components/RankingPanel';
import ConnectionStatusOverlay from '../../components/ConnectionStatusOverlay';
import { shallowEqual, useGameStore } from '../../store/gameStore';

const GameHud = ({
  level,
  score,
  energy,
  health,
  maxHealth,
  dashCharge,
  combo,
  maxCombo,
  activePowerUps,
  xp,
  geneticMaterial,
  characteristicPoints,
  geneFragments,
  stableGenes,
  evolutionSlots,
  reroll,
  dropPity,
  recentRewards,
  bossActive,
  bossHealth,
  bossMaxHealth,
  element,
  affinity,
  elementLabel,
  affinityLabel,
  resistances,
  statusEffects = [],
  skillData,
  notifications,
  joystick,
  onJoystickStart,
  onJoystickMove,
  onJoystickEnd,
  onAttackPress,
  onAttackRelease,
  onAttack,
  onDash,
  onUseSkill,
  onCycleSkill,
  onOpenEvolutionMenu,
  canEvolve,
  showTouchControls = false,
  cameraZoom = 1,
  onCameraZoomChange,
  onQuit,
  opponents = [],
}) => {
  const { connectionStatus, joinError } = useGameStore(
    (state) => ({
      connectionStatus: state.connectionStatus,
      joinError: state.joinError,
    }),
    shallowEqual,
  );

  const currentSkill = skillData?.currentSkill ?? null;
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const sidebarId = useId();

  const handleToggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  const opponentSummaries = useMemo(() => {
    if (!Array.isArray(opponents) || opponents.length === 0) {
      return [];
    }

    return opponents.map((opponent) => {
      const ratio = opponent.maxHealth
        ? Math.max(0, Math.min(1, opponent.health / opponent.maxHealth))
        : 0;

      return {
        id: opponent.id,
        name: opponent.name,
        elementLabel: opponent.elementLabel ?? opponent.element ?? '—',
        affinityLabel: opponent.affinityLabel ?? opponent.affinity ?? '—',
        combatState: opponent.combatState,
        barStyle: {
          width: `${ratio * 100}%`,
          background: opponent.palette?.base ?? '#47c2ff',
        },
      };
    });
  }, [opponents]);

  const hasOpponents = opponentSummaries.length > 0;

  const statusMessages = useMemo(
    () => ({
      idle: 'Preparando conexão ao servidor…',
      connecting: 'Conectando ao servidor…',
      reconnecting: 'Reconectando ao servidor…',
      disconnected: 'Conexão perdida. Tentando reconectar…',
    }),
    [],
  );

  const statusHints = useMemo(
    () => ({
      connecting: 'Isso pode levar alguns instantes.',
      reconnecting: 'Segure firme enquanto restabelecemos a conexão.',
      disconnected: 'Verifique sua rede ou tente novamente em instantes.',
    }),
    [],
  );

  const showStatusOverlay = connectionStatus !== 'connected';
  const statusTitle = statusMessages[connectionStatus] ?? 'Problemas de conexão';
  const statusHint = statusHints[connectionStatus];

  return (
    <>
      <button
        type="button"
        className={styles.sidebarToggle}
        onClick={handleToggleSidebar}
        aria-expanded={isSidebarOpen}
        aria-controls={sidebarId}
      >
        {isSidebarOpen ? 'Ocultar painel' : 'Mostrar painel'}
      </button>

      <div className={styles.hud}>
        <div
          className={`${styles.canvasOverlay} ${
            showStatusOverlay ? styles.canvasOverlayVisible : ''
          }`}
          role="status"
          aria-live="polite"
          aria-label="Estado da conexão do jogo"
          aria-hidden={showStatusOverlay ? undefined : true}
        >
          {showStatusOverlay ? (
            <div className={styles.canvasOverlayContent}>
              <h2 className={styles.canvasOverlayTitle}>{statusTitle}</h2>
              {joinError ? (
                <p className={styles.canvasOverlayMessage}>{joinError}</p>
              ) : null}
              {statusHint ? (
                <p className={styles.canvasOverlayHint}>{statusHint}</p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div
          id={sidebarId}
          className={`${styles.sidebar} ${
            isSidebarOpen ? styles.sidebarOpen : styles.sidebarClosed
          }`}
          role="complementary"
          aria-label="Painel lateral do jogo"
          aria-hidden={isSidebarOpen ? undefined : true}
          hidden={!isSidebarOpen}
          tabIndex={isSidebarOpen ? undefined : -1}
        >
          <RankingPanel />
          <ConnectionStatusOverlay />
          {hasOpponents ? (
            <div className={styles.opponentPanel}>
              <h3 className={styles.opponentHeading}>Oponentes</h3>
              <ul className={styles.opponentList}>
                {opponentSummaries.map((opponent) => (
                  <li key={opponent.id} className={styles.opponentItem}>
                    <div className={styles.opponentName}>{opponent.name}</div>
                    <div className={styles.opponentMeta}>
                      <span className={styles.opponentTag}>{opponent.elementLabel}</span>
                      <span className={`${styles.opponentTag} ${styles.opponentAffinity}`}>
                        {opponent.affinityLabel}
                      </span>
                    </div>
                    <div className={styles.opponentHealthBar}>
                      <div className={styles.opponentHealthFill} style={opponent.barStyle} />
                    </div>
                    <div className={styles.opponentStatus}>{opponent.combatState}</div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <CameraControls zoom={cameraZoom} onChange={onCameraZoomChange} />
          {onQuit ? (
            <button type="button" className={styles.leaveButton} onClick={onQuit}>
              Sair da sala
            </button>
          ) : null}
        </div>

        <div className={styles.mainHud}>
          <HudBar
            level={level}
            score={score}
            energy={energy}
            health={health}
            maxHealth={maxHealth}
            dashCharge={dashCharge}
            combo={combo}
            maxCombo={maxCombo}
            activePowerUps={activePowerUps}
            xp={xp}
            geneticMaterial={geneticMaterial}
            characteristicPoints={characteristicPoints}
            geneFragments={geneFragments}
            stableGenes={stableGenes}
            evolutionSlots={evolutionSlots}
            reroll={reroll}
            dropPity={dropPity}
            recentRewards={recentRewards}
            element={element}
            affinity={affinity}
            elementLabel={elementLabel}
            affinityLabel={affinityLabel}
            resistances={resistances}
            statusEffects={statusEffects}
          />

          <BossHealthBar active={bossActive} health={bossHealth} maxHealth={bossMaxHealth} />

          <SkillWheel
            currentSkill={currentSkill}
            skillList={skillData?.skillList ?? []}
            hasMultipleSkills={skillData?.hasMultipleSkills}
            skillCooldownLabel={skillData?.skillCooldownLabel ?? 'Sem habilidade'}
            skillReadyPercent={skillData?.skillReadyPercent ?? 0}
            onCycleSkill={onCycleSkill}
            touchControlsActive={showTouchControls}
          />

          <Notifications notifications={notifications} />
        </div>

        {showTouchControls ? (
          <TouchControls
            joystick={joystick}
            onJoystickStart={onJoystickStart}
            onJoystickMove={onJoystickMove}
            onJoystickEnd={onJoystickEnd}
            onAttackPress={onAttackPress}
            onAttackRelease={onAttackRelease}
            onAttack={onAttack}
            onDash={onDash}
            dashCharge={dashCharge}
            onUseSkill={onUseSkill}
            onCycleSkill={onCycleSkill}
            skillDisabled={skillData?.skillDisabled}
            skillCoolingDown={skillData?.skillCoolingDown}
            skillCooldownLabel={skillData?.skillCooldownLabel}
            skillCooldownPercent={skillData?.skillCooldownPercent ?? 0}
            currentSkillIcon={currentSkill?.icon}
            currentSkillCost={skillData?.costLabel ?? '0⚡'}
            hasCurrentSkill={Boolean(currentSkill)}
            onOpenEvolutionMenu={onOpenEvolutionMenu}
            canEvolve={canEvolve}
          />
        ) : null}
      </div>
    </>
  );
};

export default GameHud;
