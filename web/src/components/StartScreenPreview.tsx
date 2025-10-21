import { useEffect, useRef } from "react";

import styles from "./StartScreen.module.css";

type StartScreenPreviewProps = {
  isMobile: boolean;
};

const PARTICLE_COUNT = 42;

const StartScreenPreview = ({ isMobile }: StartScreenPreviewProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (isMobile) {
      return undefined;
    }

    if (typeof window === "undefined") {
      return undefined;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return undefined;
    }

    let animationFrameId = 0;

    const particles = new Array(PARTICLE_COUNT).fill(null).map(() => ({
      x: Math.random(),
      y: Math.random(),
      radius: 1 + Math.random() * 3,
      speed: 0.15 + Math.random() * 0.35,
      angle: Math.random() * Math.PI * 2,
      drift: Math.random() * 0.002 + 0.001,
    }));

    const resize = () => {
      const { clientWidth, clientHeight } = canvas;
      const dpr = window.devicePixelRatio || 1;

      canvas.width = Math.max(Math.floor(clientWidth * dpr), 1);
      canvas.height = Math.max(Math.floor(clientHeight * dpr), 1);

      context.setTransform(1, 0, 0, 1, 0, 0);
      context.scale(dpr, dpr);
    };

    resize();

    const handleResize = () => {
      resize();
    };

    window.addEventListener("resize", handleResize);

    const draw = (time: number) => {
      const { clientWidth: width, clientHeight: height } = canvas;

      context.fillStyle = "rgba(6, 9, 20, 0.88)";
      context.fillRect(0, 0, width, height);

      particles.forEach((particle, index) => {
        particle.angle += particle.drift + Math.sin(time / 2400 + index) * 0.0006;
        particle.x += Math.cos(particle.angle) * particle.speed;
        particle.y += Math.sin(particle.angle) * particle.speed;

        if (particle.x < -0.1) particle.x = 1.1;
        if (particle.x > 1.1) particle.x = -0.1;
        if (particle.y < -0.1) particle.y = 1.1;
        if (particle.y > 1.1) particle.y = -0.1;

        const px = particle.x * width;
        const py = particle.y * height;
        const glowRadius = particle.radius * 14;

        const gradient = context.createRadialGradient(px, py, 0, px, py, glowRadius);
        gradient.addColorStop(0, "rgba(115, 196, 255, 0.75)");
        gradient.addColorStop(0.4, "rgba(119, 129, 255, 0.45)");
        gradient.addColorStop(1, "rgba(18, 23, 46, 0)");

        context.fillStyle = gradient;
        context.beginPath();
        context.arc(px, py, particle.radius * 6, 0, Math.PI * 2);
        context.fill();
      });

      animationFrameId = window.requestAnimationFrame(draw);
    };

    animationFrameId = window.requestAnimationFrame(draw);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
    };
  }, [isMobile]);

  const containerClassName = [
    styles.previewContainer,
    isMobile ? styles.mobilePreview : styles.desktopPreview,
  ]
    .filter(Boolean)
    .join(" ");

  if (isMobile) {
    return (
      <div className={containerClassName} aria-hidden="true">
        <div className={styles.previewFallback} />
        <div className={styles.previewOverlay} />
      </div>
    );
  }

  return (
    <div className={containerClassName} aria-hidden="true">
      <canvas ref={canvasRef} className={styles.preview} />
      <div className={styles.previewOverlay} />
    </div>
  );
};

export default StartScreenPreview;
