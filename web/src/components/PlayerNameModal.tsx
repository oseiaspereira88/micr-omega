import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ConnectionStatus,
  gameStore,
  useGameStore,
} from "../store/gameStore";
import {
  MAX_NAME_LENGTH,
  MIN_NAME_LENGTH,
  sanitizePlayerName,
} from "../utils/messageTypes";
import styles from "./PlayerNameModal.module.css";

const STORAGE_KEY = "micr-omega:player-name";

type PlayerNameModalProps = {
  isOpen?: boolean;
  onSubmit?: (name: string) => void;
};

const readStoredName = () => {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return "";
    }

    const sanitized = sanitizePlayerName(stored);
    return sanitized ?? "";
  } catch (err) {
    console.warn("Não foi possível ler o nome do jogador salvo", err);
    return "";
  }
};

const persistName = (name: string) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const sanitized = sanitizePlayerName(name);
    if (!sanitized) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, sanitized);
  } catch (err) {
    console.warn("Não foi possível salvar o nome do jogador", err);
  }
};

const getValidationMessage = (value: string) => {
  if (!value) {
    return "Informe um nome para entrar na sala.";
  }

  if (!sanitizePlayerName(value)) {
    return `Use entre ${MIN_NAME_LENGTH} e ${MAX_NAME_LENGTH} caracteres válidos (letras, números, espaços, hífens ou sublinhados).`;
  }

  return null;
};

const shouldShowModal = (
  isOpenProp: boolean | undefined,
  hasName: boolean,
  joinError: string | null,
  connectionStatus: ConnectionStatus
) => {
  if (typeof isOpenProp === "boolean") {
    return isOpenProp;
  }

  if (!hasName) {
    return true;
  }

  if (joinError) {
    return true;
  }

  return connectionStatus === "disconnected";
};

const PlayerNameModal = ({ isOpen, onSubmit }: PlayerNameModalProps) => {
  const connectionStatus = useGameStore((state) => state.connectionStatus);
  const storedName = useGameStore((state) => state.playerName);
  const joinError = useGameStore((state) => state.joinError);

  const [inputValue, setInputValue] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (storedName) {
      setInputValue(storedName);
      return;
    }

    const persisted = readStoredName();
    if (persisted) {
      setInputValue(persisted);
      gameStore.actions.setPlayerName(persisted);
    }
  }, [storedName]);

  const errorMessage = useMemo(
    () => localError ?? joinError ?? null,
    [joinError, localError]
  );

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = inputValue.trim();
      const validation = getValidationMessage(trimmed);

      if (validation) {
        setLocalError(validation);
        return;
      }

      const sanitized = sanitizePlayerName(trimmed);
      if (!sanitized) {
        setLocalError(
          `Use entre ${MIN_NAME_LENGTH} e ${MAX_NAME_LENGTH} caracteres válidos (letras, números, espaços, hífens ou sublinhados).`
        );
        return;
      }

      setLocalError(null);
      persistName(sanitized);
      if (storedName && storedName !== sanitized) {
        gameStore.actions.setPlayerId(null);
      }
      gameStore.actions.setPlayerName(sanitized);
      gameStore.actions.setJoinError(null);
      onSubmit?.(sanitized);
    },
    [inputValue, onSubmit, storedName]
  );

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setInputValue(event.target.value);
      if (localError) {
        setLocalError(null);
      }
      if (joinError) {
        gameStore.actions.setJoinError(null);
      }
    },
    [joinError, localError]
  );

  const modalVisible = shouldShowModal(
    isOpen,
    Boolean(storedName),
    joinError,
    connectionStatus
  );

  if (!modalVisible) {
    return null;
  }

  const isSubmitting =
    connectionStatus === "connecting" || connectionStatus === "reconnecting";

  return (
    <div className={styles.overlay} role="presentation">
      <div className={styles.modal} role="dialog" aria-modal="true">
        <header className={styles.header}>
          <h2 className={styles.title}>Entre na sala pública</h2>
          <p className={styles.subtitle}>
            Escolha um nome único para disputar o ranking em tempo real.
          </p>
        </header>
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.inputWrapper}>
            <label className={styles.label} htmlFor="player-name-input">
              Nome do jogador
            </label>
            <input
              id="player-name-input"
              className={`${styles.input} ${errorMessage ? styles.inputError : ""}`}
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              placeholder="Herói da Micro-Órbita"
              autoFocus
              autoComplete="off"
              maxLength={MAX_NAME_LENGTH}
              disabled={isSubmitting}
            />
            {errorMessage ? (
              <span className={styles.errorMessage} role="alert">
                {errorMessage}
              </span>
            ) : (
              <span className={styles.helperText}>
                Entre {MIN_NAME_LENGTH} e {MAX_NAME_LENGTH} caracteres. Letras, números, espaços,
                hífens e sublinhados são permitidos.
              </span>
            )}
          </div>
          <div className={styles.actions}>
            <button className={styles.primaryButton} type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Conectando..." : "Entrar na partida"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PlayerNameModal;
