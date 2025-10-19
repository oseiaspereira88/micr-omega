import React, { useMemo } from 'react';
import styles from './SplashScreen.module.css';

const SplashScreen = ({ variant = 'desktop' }) => {
  const testId = variant === 'mobile' ? 'splash-screen-mobile' : 'splash-screen';
  const className = [styles.root, variant === 'mobile' ? styles.mobile : ''].filter(Boolean).join(' ');

  const orbitRadii = useMemo(() => Array.from({ length: 6 }, (_, index) => 90 + index * 42), []);
  const pulseOffsets = useMemo(() => ['0s', '0.6s', '1.2s', '1.8s'], []);

  return (
    <section className={className} data-testid={testId} aria-label="Introdução a Micr•Omega">
      <svg className={styles.orbital} viewBox="0 0 600 600" role="img" aria-hidden="true">
        <defs>
          <radialGradient id="core-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(126, 249, 255, 0.92)" />
            <stop offset="55%" stopColor="rgba(126, 249, 255, 0.46)" />
            <stop offset="100%" stopColor="rgba(7, 26, 51, 0)" />
          </radialGradient>
          <linearGradient id="beam" x1="0%" x2="100%" y1="50%" y2="50%">
            <stop offset="0%" stopColor="rgba(55, 186, 255, 0)" />
            <stop offset="40%" stopColor="rgba(55, 186, 255, 0.55)" />
            <stop offset="60%" stopColor="rgba(143, 94, 255, 0.85)" />
            <stop offset="85%" stopColor="rgba(55, 186, 255, 0.55)" />
            <stop offset="100%" stopColor="rgba(55, 186, 255, 0)" />
          </linearGradient>
        </defs>
        <g className={styles.orbits}>
          {orbitRadii.map((radius) => (
            <circle key={radius} className={styles.orbit} cx="300" cy="300" r={radius} />
          ))}
        </g>
        <circle className={styles.core} cx="300" cy="300" r="78" fill="url(#core-glow)" />
        <g className={styles.beamRing}>
          <circle className={styles.beam} cx="300" cy="300" r="178" />
          <circle className={styles.beam} cx="300" cy="300" r="244" />
        </g>
        <g className={styles.energyFlow}>
          {pulseOffsets.map((delay) => (
            <circle key={delay} className={styles.pulse} cx="300" cy="300" r="210">
              <animate
                attributeName="stroke-dashoffset"
                values="0;-1240"
                dur="8s"
                begin={delay}
                repeatCount="indefinite"
              />
            </circle>
          ))}
        </g>
        <g className={styles.comets}>
          <circle className={styles.comet} r="6">
            <animateMotion dur="12s" repeatCount="indefinite" path="M300,100 C540,140 540,460 300,500 C80,460 80,140 300,100Z" />
          </circle>
          <circle className={styles.comet} r="5">
            <animateMotion dur="9s" begin="-2s" repeatCount="indefinite" path="M160,260 C260,120 440,120 440,260 C440,420 260,480 160,360 Z" />
          </circle>
        </g>
        <g className={styles.scanLines}>
          <rect className={styles.scan} x="140" y="140" width="320" height="320" rx="28" />
          <rect className={styles.scan} x="180" y="180" width="240" height="240" rx="18" />
        </g>
      </svg>
      <h1 className={styles.title}>MICR•OMEGA</h1>
      <p className={styles.tagline}>protocolo de fusão microbiótica iniciado</p>
      <p className={styles.status}>transmissão espectral — 73% sincronizada</p>
    </section>
  );
};

export default SplashScreen;
