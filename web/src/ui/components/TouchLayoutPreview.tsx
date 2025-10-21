import type { HTMLAttributes } from "react";

import styles from "./TouchLayoutPreview.module.css";

type TouchLayout = "left" | "right";

type TouchLayoutPreviewProps = {
  layout: TouchLayout;
  className?: string;
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
  "aria-label": ariaLabelProp,
  "aria-hidden": ariaHidden,
  ...rest
}: TouchLayoutPreviewProps) => {
  const combinedClassName = joinClassNames(styles.preview, className);
  const accessibleLabel =
    ariaHidden === true || ariaHidden === "true"
      ? undefined
      : ariaLabelProp ?? LAYOUT_LABELS[layout];

  return (
    <div
      role="img"
      {...rest}
      className={combinedClassName}
      data-layout={layout}
      aria-hidden={ariaHidden}
      aria-label={accessibleLabel}
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
    </div>
  );
};

export default TouchLayoutPreview;
