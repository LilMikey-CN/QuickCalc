import test from "node:test";
import assert from "node:assert/strict";
import { createCashState, parseCashState, parseLegacyCashState } from "../cash-state.js";
import { calculateCashTotal, formatCents } from "../calculator.js";

test("cash migration preserves all six editable amounts and ignores the old manual drawer", () => {
  const amounts = {
    "cash-morning": "100.25", "cash-current": "200.50", "cash-retained": "20.20",
    "cash-delivery": "10.10", "cash-extra-change": "5.05", "cash-expenses": "15.15",
  };
  const migrated = parseLegacyCashState(JSON.stringify({ ...amounts, "cash-drawer": "999.99" }));
  assert.deepEqual(migrated, { ...createCashState(), ...amounts });
  assert.equal(Object.hasOwn(migrated, "cash-drawer"), false);
});

test("cash records survive saving with their order, stable numbers and raw amounts", () => {
  const state = {
    ...createCashState(), "cash-morning": "0.1", "cash-expenses": "5.05",
    extras: [{ id: 1, value: "12." }, { id: 3, value: "0.001" }], nextExtraNumber: 4, adjustmentsOpen: true,
  };
  assert.deepEqual(parseCashState(JSON.stringify(state)), state);
  assert.deepEqual(parseCashState(JSON.stringify(createCashState())), createCashState());
  assert.equal(parseCashState(JSON.stringify({ ...state, extras: [{ id: 4, value: "1" }] })), null);
  assert.equal(parseCashState("broken json"), null);
  assert.equal(parseLegacyCashState('{"cash-morning":"100"}'), null);
});

test("supplementary cash increases expected cash and reduces the difference exactly", () => {
  const result = calculateCashTotal(32500n, 10000, 15000, 3000, 1000, 500, 2000, [2500, 10, 20]);
  assert.equal(formatCents(result.expectedCents), "270.30");
  assert.equal(formatCents(result.differenceCents), "54.70");
  assert.equal(calculateCashTotal(30n, 10, 0, 0, 0, 0, 0, [20]).differenceCents, 0n);
  assert.equal(formatCents(calculateCashTotal(0n, 0, 0, 0, 0, 0, 0, Array(100).fill(2000000)).differenceCents), "−2000000.00");
  for (const invalid of [-1, 0.1, 2000001]) {
    assert.throws(() => calculateCashTotal(0n, 0, 0, 0, 0, 0, 0, [invalid]), RangeError);
  }
});
