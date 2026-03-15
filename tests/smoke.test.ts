import { describe, expect, it } from "vitest";

import { start } from "../src";

describe("bootstrap smoke", () => {
  it("starts without throwing", () => {
    expect(() => start()).not.toThrow();
  });
});
