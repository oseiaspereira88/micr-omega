import { memo } from "react";
import styles from "./ToastStack.module.css";

type ToastVariant = "error" | "warning" | "info" | "success";

type Toast = {
  id: string;
  message: string;
  variant: ToastVariant;
};

type ToastStackProps = {
  toasts: Toast[];
  onDismiss: (id: string) => void;
};

const variantIconMap: Record<ToastVariant, string> = {
  error: "⛔",
  warning: "⚠️",
  info: "ℹ️",
  success: "✅",
};

const variantClassMap: Record<ToastVariant, string> = {
  error: styles.toastError,
  warning: styles.toastWarning,
  info: styles.toastInfo,
  success: styles.toastSuccess,
};

const ToastStack = ({ toasts, onDismiss }: ToastStackProps) => {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className={styles.container} aria-live="assertive">
      {toasts.map((toast) => {
        const variant = variantClassMap[toast.variant] ? toast.variant : "info";

        return (
          <div
            key={toast.id}
            className={`${styles.toast} ${variantClassMap[variant]}`}
            role="alert"
            aria-atomic="true"
          >
            <span className={styles.toastIcon} aria-hidden="true">
              {variantIconMap[variant]}
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
        );
      })}
    </div>
  );
};

export default memo(ToastStack);
