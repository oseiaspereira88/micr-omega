import { memo } from "react";
import styles from "./ToastStack.module.css";

type Toast = {
  id: string;
  message: string;
};

type ToastStackProps = {
  toasts: Toast[];
  onDismiss: (id: string) => void;
};

const ToastStack = ({ toasts, onDismiss }: ToastStackProps) => {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className={styles.container} aria-live="assertive">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={styles.toast}
          role="alert"
          aria-atomic="true"
        >
          <span className={styles.toastIcon} aria-hidden="true">
            ⚠️
          </span>
          <div className={styles.toastContent}>{toast.message}</div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={() => onDismiss(toast.id)}
            aria-label="Fechar alerta"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
};

export default memo(ToastStack);
