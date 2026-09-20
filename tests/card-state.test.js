import test from "node:test";
import assert from "node:assert/strict";
import { createCardState, parseCardState, parseLegacyCardState } from "../card-state.js";
import { calculateCardTotal, formatCents } from "../calculator.js";

test("new Card state has no additional rows and customer adjustments start closed", () => {
  const state = createCardState();
  assert.deepEqual(state.extras, []);
  assert.equal(state.adjustmentsOpen, false);
  assert.equal(state.morning, "");
  assert.equal(state.current, "");
  assert.equal(state.nextExtraNumber, 1);
});

test("saved records retain their order, stable numbers and unfinished decimal text", () => {
  const state = {
    ...createCardState(), morning: "0.1", current: "12.",
    extras: [{ id: 1, value: ".5" }, { id: 3, value: "0.001" }], nextExtraNumber: 4,
    overcharged: "5.00", undercharged: "2.00", adjustmentsOpen: true,
  };
  assert.deepEqual(parseCardState(JSON.stringify(state)), state);
});

test("legacy Card amounts migrate without losing either customer adjustment", () => {
  assert.deepEqual(parseLegacyCardState(JSON.stringify({
    morning: "100.25", current: "200.50", overcharged: "10.10", undercharged: "5.05",
  })), { ...createCardState(), morning: "100.25", current: "200.50", overcharged: "10.10", undercharged: "5.05" });
});

test("empty v2 state remains a valid saved reset", () => {
  assert.deepEqual(parseCardState(JSON.stringify(createCardState())), createCardState());
});

test("damaged state, duplicate IDs and unsafe record numbers are rejected", () => {
  for (const text of ["bad json", "null", "[]", "{}", JSON.stringify({ ...createCardState(), morning: 10 })]) {
    assert.equal(parseCardState(text), null);
  }
  for (const extras of [
    [{ id: 1, value: "1" }, { id: 1, value: "2" }],
    [{ id: -1, value: "1" }],
    [{ id: 2, value: 100 }],
    [{ id: Number.MAX_SAFE_INTEGER + 1, value: "1" }],
    [{ id: 3, value: "1" }],
  ]) assert.equal(parseCardState(JSON.stringify({ ...createCardState(), extras, nextExtraNumber: 3 })), null);
  assert.equal(parseLegacyCardState('{"morning":"100"}'), null);
});

test("multiple Card records and adjustments calculate exactly without limiting the total", () => {
  assert.equal(formatCents(calculateCardTotal([10000, 2500, 1000, 20000])), "335.00");
  assert.equal(formatCents(calculateCardTotal([10, 20])), "0.30");
  assert.equal(formatCents(calculateCardTotal([10000, 2500, 1000, 20000, 505], 105)), "339.00");
  assert.equal(formatCents(calculateCardTotal([0, 0], 1)), "−0.01");
  assert.equal(formatCents(calculateCardTotal(Array(100).fill(2000000)), true), "2,000,000.00");
  assert.throws(() => calculateCardTotal([1, 2000001]), RangeError);
  assert.throws(() => calculateCardTotal([1, 0.1]), RangeError);
  assert.throws(() => calculateCardTotal([1], -1), RangeError);
});
