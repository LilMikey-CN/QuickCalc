import test from "node:test";
import assert from "node:assert/strict";
import { fieldScrollDelta } from "../focus-scroll.js";

test("focus positioning stays between sticky tabs and a resized keyboard viewport", () => {
  const viewport = { offsetTop: 0, height: 400 };
  const field = { top: 640, height: 88 };
  const delta = fieldScrollDelta(field, viewport, 56);
  const top = field.top - delta;
  assert.equal(top, 180);
  assert.ok(top >= 68);
  assert.ok(top + field.height <= viewport.height - 20);
});

test("iOS viewport panning is included and an already centered field stays still", () => {
  assert.equal(fieldScrollDelta({ top: 220, height: 88 }, { offsetTop: 40, height: 400 }, 56), 0);
  assert.equal(fieldScrollDelta({ top: 260, height: 88 }, { offsetTop: 40, height: 400 }, 56), 40);
});

test("a tall error field starts below the tabs when the visible space is short", () => {
  const field = { top: 500, height: 180 };
  const top = field.top - fieldScrollDelta(field, { offsetTop: 0, height: 220 }, 56);
  assert.equal(top, 68);
});
