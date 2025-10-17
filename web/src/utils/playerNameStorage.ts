import { MAX_NAME_LENGTH, MIN_NAME_LENGTH, sanitizePlayerName } from "./messageTypes";

const STORAGE_KEY = "micr-omega:player-name";

export const INVALID_PLAYER_NAME_MESSAGE = `Use entre ${MIN_NAME_LENGTH} e ${MAX_NAME_LENGTH} caracteres válidos (letras, incluindo acentos, números, espaços, hífens ou sublinhados).`;

export const readStoredName = (): string => {
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

export const persistName = (name: string) => {
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

export const getValidationMessage = (value: string): string | null => {
  if (!value) {
    return "Informe um nome para entrar na sala.";
  }

  if (!sanitizePlayerName(value)) {
    return INVALID_PLAYER_NAME_MESSAGE;
  }

  return null;
};
