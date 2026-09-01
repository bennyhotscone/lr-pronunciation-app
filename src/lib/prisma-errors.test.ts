import { describe, expect, it } from "vitest";
import { isPrismaSchemaMissingError } from "./prisma-errors";

describe("isPrismaSchemaMissingError", () => {
  it("detects Prisma missing-table errors", () => {
    expect(isPrismaSchemaMissingError({ code: "P2021" })).toBe(true);
    expect(isPrismaSchemaMissingError({ code: "P2022" })).toBe(true);
  });

  it("ignores other errors", () => {
    expect(isPrismaSchemaMissingError({ code: "P2002" })).toBe(false);
    expect(isPrismaSchemaMissingError(new Error("fail"))).toBe(false);
    expect(isPrismaSchemaMissingError(null)).toBe(false);
  });
});