import { describe, expect, it } from "vitest";
import { errorMessageSchema } from "./messageTypes";

describe("errorMessageSchema", () => {
  it("accepts room_full as a valid error reason", () => {
    const parsed = errorMessageSchema.safeParse({
      type: "error",
      reason: "room_full"
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.reason).toBe("room_full");
    }
  });
});
