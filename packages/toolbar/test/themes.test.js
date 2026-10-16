import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BUILT_IN_THEMES,
  THEME_NAMES,
  contrastRatio,
  validateThemeTokens,
} from "../dist/index.js";

test("all built-in theme families satisfy text and focus contrast targets", () => {
  assert.equal(Object.isFrozen(THEME_NAMES), true);
  assert.deepEqual(
    Object.keys(BUILT_IN_THEMES).sort(),
    [...THEME_NAMES].sort(),
  );

  for (const theme of THEME_NAMES) {
    const result = validateThemeTokens(BUILT_IN_THEMES[theme]);
    assert.equal(result.ok, true, `${theme} must pass contrast validation`);
    assert.ok(
      contrastRatio(
        BUILT_IN_THEMES[theme].foreground,
        BUILT_IN_THEMES[theme].background,
      ) >= 4.5,
    );
    assert.ok(
      contrastRatio(
        BUILT_IN_THEMES[theme].focus,
        BUILT_IN_THEMES[theme].background,
      ) >= 3,
    );
  }
});

test("validates portable custom color tokens and rejects unsafe CSS values", () => {
  const valid = validateThemeTokens({
    background: "#FFFFFF",
    foreground: "#111111",
    border: "#555555",
    hover: "#EEEEEE",
    focus: "#005FCC",
    accent: "#0041A8",
  });
  assert.equal(valid.ok, true);
  if (valid.ok) assert.equal(Object.isFrozen(valid.value), true);

  const invalid = validateThemeTokens({
    background: "url(https://example.invalid/image)",
    foreground: "#111111",
    border: "#555555",
    hover: "#EEEEEE",
    focus: "#005FCC",
    accent: "#0041A8",
  });
  assert.equal(invalid.ok, false);
  if (!invalid.ok) {
    assert.ok(
      invalid.errors.some(({ code }) => code === "THEME_INVALID_COLOR"),
    );
  }
});

test("reports insufficient text and focus contrast", () => {
  const result = validateThemeTokens({
    background: "#FFFFFF",
    foreground: "#EEEEEE",
    border: "#AAAAAA",
    hover: "#DDDDDD",
    focus: "#EEEEEE",
    accent: "#333333",
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors.some(({ code }) => code === "THEME_TEXT_CONTRAST"));
    assert.ok(
      result.errors.some(({ code }) => code === "THEME_FOCUS_CONTRAST"),
    );
  }
});

test("rejects theme token accessors without invoking them", () => {
  let invoked = false;
  const input = Object.defineProperty(
    {
      background: "#FFFFFF",
      foreground: "#111111",
      border: "#555555",
      hover: "#EEEEEE",
      focus: "#005FCC",
    },
    "accent",
    {
      enumerable: true,
      get() {
        invoked = true;
        return "#0041A8";
      },
    },
  );

  const result = validateThemeTokens(input);
  assert.equal(result.ok, false);
  assert.equal(invoked, false);
  if (!result.ok) {
    assert.ok(result.errors.some(({ code }) => code === "THEME_ACCESSOR"));
  }
});
