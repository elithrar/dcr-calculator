import { describe, expect, it } from "vitest";

import { parseOptionalNumber, parseRequiredNumber } from "./form-numbers";

describe("parseRequiredNumber", () => {
  it("returns undefined for empty input", () => {
    expect(parseRequiredNumber("")).toBeUndefined();
    expect(parseRequiredNumber("   ")).toBeUndefined();
  });

  it("parses valid numbers", () => {
    expect(parseRequiredNumber("70.4")).toBe(70.4);
  });
});

describe("parseOptionalNumber", () => {
  it("returns null for empty input", () => {
    expect(parseOptionalNumber("")).toBeNull();
  });

  it("parses valid numbers", () => {
    expect(parseOptionalNumber("127.8")).toBe(127.8);
  });
});
