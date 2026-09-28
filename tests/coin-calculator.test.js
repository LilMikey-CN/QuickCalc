import test from "node:test";
import assert from "node:assert/strict";
import { calculateNoteTotals } from "../calculator.js";
import { parseCoinCount, calculateCoinTotal, buildCashReport, createCoinState, parseCoinState } from "../coin-calculator.js";

test("coin counts accept whole non-negative numbers and preserve large counts exactly", () => {
  for (const [text, count] of [["", 0n], ["0", 0n], [" 007 ", 7n], ["9007199254740993", 9007199254740993n]]) {
    assert.deepEqual(parseCoinCount(text), { ok: true, count });
  }
  for (const text of ["-1", "1.5", "1.0", "+2", "1e2", "Infinity", "abc"]) assert.equal(parseCoinCount(text).ok, false);
  assert.equal(calculateCoinTotal([7n, 0n, 1n, 28n, 11n, 4n]), 2140n);
  assert.equal(calculateCoinTotal([0n, 0n, 0n, 0n, 1n, 1n]), 15n);
  assert.equal(calculateCoinTotal([9007199254740993n, 0n, 0n, 0n, 0n, 0n]), 1801439850948198600n);
  assert.throws(() => calculateCoinTotal([0n, 0n, 0n, 0n, 0n, -1n]), RangeError);
});

test("cash report keeps coins separate and retains only small denomination notes", () => {
  const notes = calculateNoteTotals([20n, 0n, 10n, 2n, 1n]);
  assert.equal(buildCashReport({
    cardCents: 555180n, noteCents: notes.totalCents, retainedCents: notes.smallNotesCents,
    coinCounts: [7n, 0n, 1n, 28n, 11n, 4n], date: new Date(2026, 8, 28),
  }), "日期：9.28\nCard：$5551.80\nCash：$2225（留$225）\nCoins：$21.4\n$2x 7  $1x 0  $0.5x 1\n$0.2x 28  $0.1x 11  $0.05x 4");
});

test("cash report preserves cents and refuses invalid source values", () => {
  const amounts = { cardCents: -5n, noteCents: 0n, retainedCents: 0n, coinCounts: [0n, 0n, 0n, 0n, 0n, 1n], date: new Date(2027, 0, 1) };
  assert.equal(buildCashReport(amounts), "日期：1.1\nCard：$-0.05\nCash：$0（留$0）\nCoins：$0.05\n$2x 0  $1x 0  $0.5x 0\n$0.2x 0  $0.1x 0  $0.05x 1");
  for (const field of ["cardCents", "noteCents", "retainedCents", "coinCounts"]) assert.equal(buildCashReport({ ...amounts, [field]: null }), null);
});

test("coin storage preserves counts, unfinished input and disclosure state", () => {
  const state = createCoinState();
  assert.equal(state.open, false);
  state.counts["coins-200"] = "007";
  state.counts["coins-5"] = "1.";
  state.open = true;
  assert.deepEqual(parseCoinState(JSON.stringify(state)), state);
  for (const text of [null, "broken", "{}", JSON.stringify({ ...state, counts: {} }), JSON.stringify({ ...state, version: 2 })]) {
    assert.equal(parseCoinState(text), null);
  }
});
