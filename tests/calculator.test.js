import test from "node:test";
import assert from "node:assert/strict";
import { calculateCashTotal, calculateNoteTotals, calculateTotal, formatCents, parseAmount, parseNoteCount } from "../calculator.js";

const cents = (text) => {
  const amount = parseAmount(text);
  assert.equal(amount.ok, true, text);
  return amount.cents;
};

test("parses decimal amounts and common editing forms exactly", () => {
  for (const [input, expected] of [
    ["", 0], ["  ", 0], ["0", 0], ["0.00", 0], [".01", 1], [".5", 50],
    ["1.", 100], ["0001.20", 120], [" 12.34 ", 1234], ["19.99", 1999],
    ["19999.99", 1999999], ["20000", 2000000], ["20000.00", 2000000],
  ]) assert.equal(cents(input), expected, input);
});

test("rejects out-of-range, over-precision and non-decimal input without rounding", () => {
  for (const input of ["-1", "-0.01", "20000.01", "20001", "1.001", "0.009", "1e2", "Infinity", "NaN", "1,000", "+1", ".", "1.2.3", "abc", "9".repeat(400)]) {
    assert.equal(parseAmount(input).ok, false, input);
  }
});

test("avoids floating-point artifacts and applies the requested formula", () => {
  assert.equal(formatCents(calculateTotal(cents("0.1"), cents("0.2"), 0, 0)), "0.30");
  assert.equal(formatCents(calculateTotal(cents("1.01"), cents("2.02"), cents("0.03"), cents("0.06"))), "3.00");
  assert.equal(formatCents(calculateTotal(cents("100.25"), cents("200.50"), cents("10.10"), cents("5.05"))), "305.80");
  assert.equal(formatCents(calculateTotal(cents("0.1"), cents("0.2"), 0, cents("0.3"))), "0.00");
});

test("handles maximum totals and negative totals without clamping the result", () => {
  assert.equal(formatCents(calculateTotal(2000000, 2000000, 2000000, 0), true), "60,000.00");
  assert.equal(formatCents(calculateTotal(0, 0, 0, 2000000), true), "−20,000.00");
  assert.equal(formatCents(calculateTotal(0, 0, 0, 1)), "−0.01");
});

test("rejects invalid internal amounts rather than propagating an imprecise result", () => {
  for (const invalid of [0.1, -1, 2000001, NaN, Infinity, "100"]) {
    assert.throws(() => calculateTotal(invalid, 0, 0, 0), RangeError);
  }
  assert.throws(() => formatCents(0.1), TypeError);
});

test("cash adds retained cash, subtracts expenses and then the drawer balance exactly once", () => {
  const values = ["100.25", "200.50", "10.10", "20.20", "5.05", "15.15", "250.00"].map(cents);
  const result = calculateCashTotal(...values);
  assert.equal(formatCents(result.expectedCents), "290.65");
  assert.equal(formatCents(result.differenceCents), "40.65");
  assert.equal(calculateCashTotal(100, 200, 10, 20, 30, 40, 240).differenceCents, 0);
  assert.equal(calculateCashTotal(100, 200, 10, 20, 30, 40, 241).differenceCents, -1);
});

test("cash handles boundaries and validates all seven amounts", () => {
  assert.deepEqual(calculateCashTotal(2000000, 2000000, 0, 2000000, 0, 0, 0), {
    expectedCents: 6000000, differenceCents: 6000000,
  });
  assert.deepEqual(calculateCashTotal(0, 0, 2000000, 0, 2000000, 2000000, 2000000), {
    expectedCents: -6000000, differenceCents: -8000000,
  });
  for (let index = 0; index < 7; index += 1) {
    const values = Array(7).fill(0);
    values[index] = 2000001;
    assert.throws(() => calculateCashTotal(...values), RangeError);
  }
});

test("note counts accept only non-negative whole-number text", () => {
  for (const [input, expected] of [["", 0n], ["  ", 0n], ["0", 0n], ["1", 1n], ["0002", 2n], [" 25 ", 25n]]) {
    assert.deepEqual(parseNoteCount(input), { ok: true, count: expected });
  }
  for (const input of ["-1", "-0", "+1", "1.0", "0.5", ".", "1e2", "1,000", "abc", "Infinity"]) {
    assert.equal(parseNoteCount(input).ok, false, input);
  }
});

test("note totals include all denominations and the small-note subtotal excludes 100 and 50", () => {
  assert.deepEqual(calculateNoteTotals([1n, 2n, 3n, 4n, 5n]), {
    totalCents: 32500n, smallNotesCents: 12500n,
  });
  assert.deepEqual(calculateNoteTotals([1n, 1n, 0n, 0n, 0n]), {
    totalCents: 15000n, smallNotesCents: 0n,
  });
  assert.deepEqual(calculateNoteTotals([0n, 0n, 0n, 0n, 0n]), {
    totalCents: 0n, smallNotesCents: 0n,
  });
  assert.throws(() => calculateNoteTotals([0n, 0n, -1n, 0n, 0n]), RangeError);
  assert.throws(() => calculateNoteTotals([0, 0, 0, 0, 0]), RangeError);
});

test("large note counts and currency formatting remain exact", () => {
  const count = parseNoteCount("9007199254740993");
  assert.equal(count.ok, true);
  const totals = calculateNoteTotals([count.count, 0n, 0n, 0n, 0n]);
  assert.equal(formatCents(totals.totalCents, true), "900,719,925,474,099,300.00");
  assert.equal(formatCents(-1n), "−0.01");
});
