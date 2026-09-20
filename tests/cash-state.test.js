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
  const { "cash-extra-change": oldChange, ...retained } = amounts;
  assert.deepEqual(migrated, { ...createCashState(), ...retained, "cash-legacy-change": oldChange });
  assert.equal(Object.hasOwn(migrated, "cash-extra-change"), false);
  assert.equal(Object.hasOwn(migrated, "cash-drawer"), false);
});

test("cash records survive saving with their order, stable numbers and raw amounts", () => {
  const state = {
    ...createCashState(), "cash-morning": "0.1", "cash-expenses": "5.05",
    extras: { early: [{ id: 1, value: "12." }], late: [{ id: 3, value: "0.001" }] }, nextExtraNumber: 4, adjustmentsOpen: true,
  };
  assert.deepEqual(parseCashState(JSON.stringify(state)), state);
  assert.deepEqual(parseCashState(JSON.stringify(createCashState())), createCashState());
  assert.equal(parseCashState(JSON.stringify({ ...state, extras: { early: [{ id: 4, value: "1" }], late: [] } })), null);
  assert.equal(parseCashState("broken json"), null);
  assert.equal(parseLegacyCashState('{"cash-morning":"100"}'), null);
});

test("v2 cash migration preserves old adjustments without guessing a payment method", () => {
  const old = { version: 2, "cash-morning": "100", "cash-current": "200", "cash-retained": "10", "cash-delivery": "3", "cash-extra-change": "5.50", "cash-expenses": "2", extras: [{ id: 2, value: "25" }], nextExtraNumber: 3, adjustmentsOpen: false };
  const state = parseCashState(JSON.stringify(old));
  assert.equal(state.version, 3);
  assert.deepEqual(state.extras, { early: old.extras, late: [] });
  assert.equal(state["cash-legacy-change"], "5.50");
  assert.equal(state["cash-bank-transfer"], "");
  assert.equal(state["cash-rmb-payment"], "");
  assert.equal(state["cash-card-payment"], "");
  assert.deepEqual(parseCashState(JSON.stringify(state)), state);
});

test("supplementary cash increases expected cash and reduces the difference exactly", () => {
  const result = calculateCashTotal(32500n, 10000, 15000, 3000, 1000, 500, 2000, [2500, 10, 20]);
  assert.equal(formatCents(result.expectedCents), "340.30");
  assert.equal(formatCents(result.differenceCents), "−15.30");
  assert.equal(calculateCashTotal(30n, 10, 0, 0, 0, 0, 0, [20]).differenceCents, 0n);
  assert.equal(formatCents(calculateCashTotal(0n, 0, 0, 0, 0, 0, 0, Array(100).fill(2000000)).differenceCents), "−2000000.00");
  for (const invalid of [-1, 0.1, 2000001]) {
    assert.throws(() => calculateCashTotal(0n, 0, 0, 0, 0, 0, 0, [invalid]), RangeError);
  }
});
