import type { CSSProperties, HTMLAttributes } from "react";

import styles from "./TouchLayoutPreview.module.css";
import {
  JOYSTICK_SENSITIVITY_MAX,
  JOYSTICK_SENSITIVITY_MIN,
  TOUCH_CONTROL_SCALE_MAX,
  TOUCH_CONTROL_SCALE_MIN,
} from "../../config/touchControls";

type TouchLayout = "left" | "right";

type TouchLayoutPreviewProps = {
  layout: TouchLayout;
  className?: string;
  scale?: number;
  joystickSensitivity?: number;
} & HTMLAttributes<HTMLDivElement>;

const LAYOUT_LABELS: Record<TouchLayout, string> = {
  left: "Prévia do layout com botões à esquerda",
  right: "Prévia do layout com botões à direita",
};

const joinClassNames = (
  ...classes: Array<string | false | null | undefined>
): string => classes.filter(Boolean).join(" ");

const TouchLayoutPreview = ({
  layout,
  className,
  scale = 1,
  joystickSensitivity = 1,
  "aria-label": ariaLabelProp,
  "aria-hidden": ariaHidden,
  style: inlineStyle,
  ...rest
}: TouchLayoutPreviewProps) => {
  const combinedClassName = joinClassNames(styles.preview, className);
  const accessibleLabel =
    ariaHidden === true || ariaHidden === "true"
      ? undefined
      : ariaLabelProp ?? LAYOUT_LABELS[layout];

  const normalize = (value: number, min: number, max: number, fallback: number) => {
    if (!Number.isFinite(value)) {
      return fallback;
    }
    if (value < min) {
      return min;
    }
    if (value > max) {
      return max;
    }
    return value;
  };

  const normalizedScale = normalize(
    scale,
    TOUCH_CONTROL_SCALE_MIN,
    TOUCH_CONTROL_SCALE_MAX,
    1,
  );
  const normalizedSensitivity = normalize(
    joystickSensitivity,
    JOYSTICK_SENSITIVITY_MIN,
    JOYSTICK_SENSITIVITY_MAX,
    1,
  );

  const styleWithScale: CSSProperties & {
    "--touch-preview-scale"?: number;
    "--touch-preview-joystick-sensitivity"?: number;
  } = {
    ...inlineStyle,
    "--touch-preview-scale": normalizedScale,
    "--touch-preview-joystick-sensitivity": normalizedSensitivity,
  };

  const sensitivityRange = JOYSTICK_SENSITIVITY_MAX - JOYSTICK_SENSITIVITY_MIN || 1;
  const sensitivityProgress = (normalizedSensitivity - JOYSTICK_SENSITIVITY_MIN) / sensitivityRange;
  const clampedProgress = Math.min(Math.max(sensitivityProgress, 0), 1);
  const sensitivityFill = `${Math.round(clampedProgress * 100)}%`;

  const sensitivityStyle: CSSProperties & {
    "--touch-preview-sensitivity-fill"?: string;
  } = {
    "--touch-preview-sensitivity-fill": sensitivityFill,
  };

  return (
    <div
      role="img"
      {...rest}
      className={combinedClassName}
      data-layout={layout}
      aria-hidden={ariaHidden}
      aria-label={accessibleLabel}
      style={styleWithScale}
    >
      <div className={styles.device}>
        <div className={joinClassNames(styles.side, styles.leftSide)}>
          <div className={styles.joystickRing}>
            <div className={styles.joystickHandle} />
          </div>
          <div className={styles.utilityRow}>
            <span className={styles.utilityButton} aria-hidden="true" />
            <span className={styles.utilityBar} aria-hidden="true" />
          </div>
        </div>
        <div className={joinClassNames(styles.side, styles.rightSide)}>
          <div className={styles.actionCluster}>
            <span className={styles.actionButton} aria-hidden="true" />
            <span className={styles.actionButton} aria-hidden="true" />
            <span className={styles.actionButton} aria-hidden="true" />
          </div>
          <span className={styles.skillButton} aria-hidden="true" />
        </div>
      </div>
      <div className={styles.labels} aria-hidden="true">
        <span className={joinClassNames(styles.label, styles.leftLabel)}>
          Joystick
        </span>
        <span className={joinClassNames(styles.label, styles.rightLabel)}>
          Ações
        </span>
      </div>
      <div className={styles.sensitivityMeter} aria-hidden="true">
        <span className={styles.sensitivityLabel}>Sensibilidade</span>
        <span className={styles.sensitivityBar} style={sensitivityStyle} />
      </div>
    </div>
  );
};

export default TouchLayoutPreview;
