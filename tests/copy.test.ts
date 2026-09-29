import { describe, it, expect } from "vitest";
import { validateCopyLimits } from "../src/text/copy";

describe("Copy character limit validation", () => {
  it("verifies all text copy adheres to exact length restrictions", () => {
    const { valid, errors } = validateCopyLimits();
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });
});
