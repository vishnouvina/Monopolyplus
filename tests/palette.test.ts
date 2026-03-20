import { describe, expect, test } from "vitest";
import { COLOR_GROUP_COLORS, SPECIAL_TILE_COLORS } from "@/lib/board/display";

describe("board color palette", () => {
  test("all property color groups use unique colors", () => {
    const colors = Object.values(COLOR_GROUP_COLORS);
    expect(new Set(colors).size).toBe(colors.length);
  });

  test("special tile colors are unique and distinct from property groups", () => {
    const specialColors = Object.values(SPECIAL_TILE_COLORS).filter((color) => color !== SPECIAL_TILE_COLORS.DEFAULT);
    const groupColors = Object.values(COLOR_GROUP_COLORS);

    expect(new Set(specialColors).size).toBe(specialColors.length);
    for (const color of specialColors) {
      expect(groupColors.includes(color)).toBe(false);
    }
  });
});
