import { describe, it, expect } from "vitest";
import { normalizeProductType, isKnownProductType } from "./productTypes";

describe("normalizeProductType", () => {
  it("maps values saved by the old admin form (lowercase) to the shared options", () => {
    expect(normalizeProductType("electronics")).toBe("Electronics");
    expect(normalizeProductType("shoes")).toBe("Shoes");
    expect(normalizeProductType(" beauty ")).toBe("Beauty");
  });

  it("keeps customer-form values as they are", () => {
    expect(normalizeProductType("Health")).toBe("Health");
  });

  it("keeps unknown categories instead of dropping them", () => {
    expect(normalizeProductType("general")).toBe("general");
    expect(isKnownProductType("general")).toBe(false);
  });

  it("returns an empty string when there is no category", () => {
    expect(normalizeProductType(undefined)).toBe("");
    expect(normalizeProductType(null)).toBe("");
  });
});
