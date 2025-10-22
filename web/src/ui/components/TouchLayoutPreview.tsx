import type { CSSProperties, HTMLAttributes } from "react";

import {
  JOYSTICK_SENSITIVITY_MAX,
  JOYSTICK_SENSITIVITY_MIN,
  TOUCH_CONTROL_SCALE_MAX,
  TOUCH_CONTROL_SCALE_MIN,
} from "../../store/gameSettings";

import styles from "./TouchLayoutPreview.module.css";

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
  style,
  ...rest
}: TouchLayoutPreviewProps) => {
  const combinedClassName = joinClassNames(styles.preview, className);
  const accessibleLabel =
    ariaHidden === true || ariaHidden === "true"
      ? undefined
      : ariaLabelProp ?? LAYOUT_LABELS[layout];
  const normalizedScale = Number.isFinite(scale)
    ? Math.min(TOUCH_CONTROL_SCALE_MAX, Math.max(TOUCH_CONTROL_SCALE_MIN, scale))
    : 1;
  const normalizedSensitivity = Number.isFinite(joystickSensitivity)
    ? Math.min(
        JOYSTICK_SENSITIVITY_MAX,
        Math.max(JOYSTICK_SENSITIVITY_MIN, joystickSensitivity),
      )
    : 1;
  const previewStyle: CSSProperties = {
    ...(style ?? {}),
    '--touch-preview-scale': normalizedScale.toFixed(3),
    '--touch-preview-sensitivity': normalizedSensitivity.toFixed(3),
  } as CSSProperties;
  const scalePercent = `${Math.round(normalizedScale * 100)}%`;
  const sensitivityPercent = `${Math.round(normalizedSensitivity * 100)}%`;

  return (
    <div
      role="img"
      {...rest}
      className={combinedClassName}
      data-layout={layout}
      data-touch-scale={normalizedScale.toFixed(3)}
      data-touch-sensitivity={normalizedSensitivity.toFixed(3)}
      aria-hidden={ariaHidden}
      aria-label={accessibleLabel}
      style={previewStyle}
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
      <div className={styles.previewMeters} aria-hidden="true">
        <div className={styles.previewMeter}>
          <span className={styles.previewMeterLabel}>Tamanho</span>
          <div className={styles.previewMeterTrack}>
            <span
              className={styles.previewMeterFill}
              style={{ width: scalePercent }}
            />
          </div>
        </div>
        <div className={styles.previewMeter}>
          <span className={styles.previewMeterLabel}>Sensibilidade</span>
          <div className={styles.previewMeterTrack}>
            <span
              className={styles.previewMeterFill}
              data-variant="sensitivity"
              style={{ width: sensitivityPercent }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TouchLayoutPreview;
