import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

const createStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
};

if (typeof window !== "undefined") {
  Object.defineProperty(window, "localStorage", {
    value: createStorageMock(),
    writable: true,
    configurable: true,
  });

  Object.defineProperty(window, "sessionStorage", {
    value: createStorageMock(),
    writable: true,
    configurable: true,
  });
}

afterEach(() => {
  cleanup();
  if (typeof window !== "undefined") {
    window.localStorage?.clear();
    window.sessionStorage?.clear();
  }
});
