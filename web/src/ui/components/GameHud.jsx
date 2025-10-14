import React from 'react';
import HudBar from './HudBar';
import BossHealthBar from './BossHealthBar';
import SkillWheel from './SkillWheel';
import Notifications from './Notifications';
import TouchControls from './TouchControls';
import CameraControls from './CameraControls';
import styles from './GameHud.module.css';
import RankingPanel from '../../components/RankingPanel';
import ConnectionStatusOverlay from '../../components/ConnectionStatusOverlay';

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
  bossActive,
  bossHealth,
  bossMaxHealth,
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
}) => {
  const currentSkill = skillData?.currentSkill ?? null;

  return (
    <div className={styles.hud}>
      <div className={styles.sidebar}>
        <RankingPanel />
        <ConnectionStatusOverlay />
        <CameraControls zoom={cameraZoom} onChange={onCameraZoomChange} />
      </div>

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
      />

      <BossHealthBar active={bossActive} health={bossHealth} maxHealth={bossMaxHealth} />

      <SkillWheel
        currentSkill={currentSkill}
        skillList={skillData?.skillList ?? []}
        hasMultipleSkills={skillData?.hasMultipleSkills}
        skillCooldownLabel={skillData?.skillCooldownLabel ?? 'Sem habilidade'}
        skillReadyPercent={skillData?.skillReadyPercent ?? 0}
        onCycleSkill={onCycleSkill}
      />

      <Notifications notifications={notifications} />

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
          skillDisabled={skillData?.skillDisabled}
          skillCoolingDown={skillData?.skillCoolingDown}
          skillCooldownLabel={skillData?.skillCooldownLabel}
          skillCooldownPercent={skillData?.skillCooldownPercent ?? 0}
          currentSkillIcon={currentSkill?.icon}
          currentSkillCost={currentSkill?.cost}
          hasCurrentSkill={Boolean(currentSkill)}
          onOpenEvolutionMenu={onOpenEvolutionMenu}
          canEvolve={canEvolve}
        />
      ) : null}
    </div>
  );
};

export default GameHud;
