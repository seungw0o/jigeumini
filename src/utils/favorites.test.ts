import { describe, expect, it } from "vitest";
import { FAVORITES_LIMIT, favoriteToggle } from "./favorites";

const places = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}` }));

describe("favoriteToggle", () => {
  it("adds below the cap", () => {
    expect(favoriteToggle(places(FAVORITES_LIMIT - 1), "new")).toBe("add");
  });

  it("blocks a new place at 50", () => {
    expect(FAVORITES_LIMIT).toBe(50);
    expect(favoriteToggle(places(50), "new")).toBe("full");
  });

  it("still removes an existing place at the cap", () => {
    expect(favoriteToggle(places(50), "p7")).toBe("remove");
  });
});
