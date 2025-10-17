import { afterEach, describe, expect, it, vi } from "vitest";
import * as Sentry from "@sentry/react";

import { reportClientError } from "./observability";

vi.mock("@sentry/react", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

describe("reportClientError", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("falls back to a safe string when serialization fails", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(() => reportClientError(circular)).not.toThrow();
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
    expect(Sentry.captureMessage).toHaveBeenCalledWith("[unserializable error]");
  });
});
