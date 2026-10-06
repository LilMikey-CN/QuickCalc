import test from "node:test";
import assert from "node:assert/strict";
import { NOTE_DENOMINATIONS, calculateNoteTotals } from "../calculator.js";
import { parseRetentionSelection } from "../note-retention.js";

test("all 32 retention selections preserve the full note total and count each selected denomination once", () => {
  const amounts = [10000n, 10000n, 6000n, 4000n, 2500n];
  for (let mask = 0; mask < 32; mask++) {
    const selected = NOTE_DENOMINATIONS.filter((_, index) => mask & (1 << index));
    const expected = amounts.reduce((total, amount, index) => mask & (1 << index) ? total + amount : total, 0n);
    assert.deepEqual(calculateNoteTotals([1n, 2n, 3n, 4n, 5n], selected), { totalCents: 32500n, retainedCents: expected });
  }
  assert.equal(calculateNoteTotals([9007199254740993n, 0n, 0n, 0n, 0n], [100]).retainedCents, 90071992547409930000n);
  for (const selected of [[1], [10, 10], ["5"], null]) assert.throws(() => calculateNoteTotals([0n, 0n, 0n, 0n, 0n], selected), RangeError);
});

test("retention settings preserve an intentional empty selection and reject damaged preferences", () => {
  const saved = (denominations) => JSON.stringify({ version: 1, denominations });
  assert.deepEqual(parseRetentionSelection(saved([5, 100, 10])), [100, 10, 5]);
  assert.deepEqual(parseRetentionSelection(saved([])), []);
  for (const text of [null, "bad json", "{}", saved([20, 20]), saved([1]), saved(["10"]), saved(null), '{"version":2,"denominations":[10,5]}']) {
    assert.equal(parseRetentionSelection(text), null);
  }
});
