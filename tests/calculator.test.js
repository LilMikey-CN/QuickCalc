import test from "node:test";
import assert from "node:assert/strict";
import { calculateTotal, formatCents, parseAmount } from "../calculator.js";

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
