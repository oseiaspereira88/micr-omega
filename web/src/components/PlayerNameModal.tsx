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
import styles from "./PlayerNameModal.module.css";

const STORAGE_KEY = "micr-omega:player-name";
const NAME_REGEX = /^[A-Za-z0-9]{3,16}$/;

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
    return stored ?? "";
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
    window.localStorage.setItem(STORAGE_KEY, name);
  } catch (err) {
    console.warn("Não foi possível salvar o nome do jogador", err);
  }
};

const getValidationMessage = (value: string) => {
  if (!value) {
    return "Informe um nome para entrar na sala.";
  }

  if (!NAME_REGEX.test(value)) {
    return "Use apenas letras e números entre 3 e 16 caracteres.";
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

      setLocalError(null);
      persistName(trimmed);
      if (storedName && storedName !== trimmed) {
        gameStore.actions.setPlayerId(null);
      }
      gameStore.actions.setPlayerName(trimmed);
      gameStore.actions.setJoinError(null);
      onSubmit?.(trimmed);
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
              maxLength={16}
              disabled={isSubmitting}
            />
            {errorMessage ? (
              <span className={styles.errorMessage} role="alert">
                {errorMessage}
              </span>
            ) : (
              <span className={styles.helperText}>
                Entre 3 e 16 caracteres. Apenas letras e números são permitidos.
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
