import type { HTMLAttributes } from "react";
import styles from "./TouchLayoutPreview.module.css";

type TouchLayout = "left" | "right";

type TouchLayoutPreviewProps = {
  layout: TouchLayout;
  disabled?: boolean;
} & HTMLAttributes<HTMLDivElement>;

const TouchLayoutPreview = ({
  layout,
  disabled = false,
  className,
  "aria-hidden": ariaHidden,
  ...rest
}: TouchLayoutPreviewProps) => {
  const containerClassName = [
    styles.root,
    disabled ? styles.rootDisabled : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  const activeLayout = layout === "left" ? "left" : "right";
  const options: TouchLayout[] = ["left", "right"];

  return (
    <div
      className={containerClassName}
      data-selected-layout={activeLayout}
      aria-hidden={ariaHidden ?? "true"}
      {...rest}
    >
      {options.map((option) => {
        const cardClassName = [
          styles.card,
          option === "left" ? styles.cardLeft : styles.cardRight,
          option === activeLayout ? styles.cardActive : styles.cardInactive,
        ]
          .filter(Boolean)
          .join(" ");

        const buttonsClassName = [
          styles.buttons,
          option === "left" ? styles.buttonsLeft : styles.buttonsRight,
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <div
            key={option}
            className={cardClassName}
            data-layout={option}
            data-active={option === activeLayout ? "true" : "false"}
          >
            <div className={styles.cardContent}>
              <div className={styles.stick} />
              <div className={buttonsClassName}>
                <span className={styles.button} />
                <span className={`${styles.button} ${styles.buttonSecondary}`} />
                <span className={`${styles.button} ${styles.buttonTertiary}`} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TouchLayoutPreview;
