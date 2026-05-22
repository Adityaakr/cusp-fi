import { describe, expect, it } from "vitest";

import { WAITLIST_DISPLAY_OFFSET, getWaitlistErrorMessage } from "@/hooks/useWaitlistSignup";

describe("waitlist signup helpers", () => {
  it("maps duplicate-email errors to a friendly message", () => {
    expect(getWaitlistErrorMessage("23505")).toBe("This email is already registered.");
  });

  it("falls back to a generic message for unknown errors", () => {
    expect(getWaitlistErrorMessage("other")).toBe("Something went wrong. Please try again.");
  });

  it("keeps the public waitlist count offset stable", () => {
    expect(25 + WAITLIST_DISPLAY_OFFSET).toBe(125);
  });
});
