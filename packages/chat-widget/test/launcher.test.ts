// Where the floating button may sit and where the panel opens beside it: pure arithmetic, no browser needed.
import { describe, expect, test } from "bun:test";
import { clampLauncher, panelPlace } from "../src/chat";

const desktop = { w: 1280, h: 800 };

describe("the floating button", () => {
  test("it can't be dragged off the page", () => {
    expect(clampLauncher({ right: -50, bottom: -50 }, desktop)).toEqual({ right: 8, bottom: 8 });
    expect(clampLauncher({ right: 5000, bottom: 5000 }, desktop)).toEqual({ right: 1280 - 52 - 8, bottom: 800 - 52 - 8 });
    expect(clampLauncher({ right: 300, bottom: 200 }, desktop)).toEqual({ right: 300, bottom: 200 });
  });

  test("a window smaller than the button still gives a place", () => {
    expect(clampLauncher({ right: 100, bottom: 100 }, { w: 40, h: 40 })).toEqual({ right: 8, bottom: 8 });
  });
});

describe("the panel beside it", () => {
  test("from the starting corner it is where the stylesheet puts it", () => {
    expect(panelPlace({ right: 20, bottom: 20 }, desktop)).toEqual({ right: 20, bottom: 84, width: 400, height: 600 });
  });

  test("it opens above the button, lined up with its right edge", () => {
    expect(panelPlace({ right: 300, bottom: 100 }, desktop)).toMatchObject({ right: 300, bottom: 164 });
  });

  test("near the top it opens below the button instead", () => {
    // the button is 740px up a 1000px window: 600px of panel doesn't fit above it, but fits below
    const view = { w: 1280, h: 1000 };
    const p = panelPlace({ right: 300, bottom: 740 }, view);
    const buttonBottomFromTop = view.h - 740;
    expect(view.h - p.bottom - p.height).toBe(buttonBottomFromTop + 12); // 12px under the button
    expect(p.bottom).toBeGreaterThanOrEqual(8);
  });

  test("at the left edge it slides right so it stays on screen", () => {
    const p = panelPlace({ right: 1200, bottom: 20 }, desktop);
    expect(p.right).toBe(1280 - 400 - 8);
  });

  test("with no room above or below it stays on screen over the button", () => {
    const p = panelPlace({ right: 20, bottom: 300 }, { w: 1280, h: 700 });
    expect(p.bottom).toBeGreaterThanOrEqual(8);
    expect(700 - p.bottom - p.height).toBeGreaterThanOrEqual(8);
  });
});
