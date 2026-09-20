import test from "node:test";
import assert from "node:assert/strict";
import { calculateCardTotal, calculateCashBalance, formatCents } from "../calculator.js";
import { buildCashAdjustmentText } from "../cash-adjustments.js";

test("cash uses both shifts and both sets of supplementary records exactly once", () => {
  const early = calculateCardTotal([10010, 20]);
  const late = calculateCardTotal([20020, 30]);
  assert.equal(formatCents(early), "100.30");
  assert.equal(formatCents(late), "200.50");
  assert.equal(formatCents(early + late), "300.80");
  const cash = calculateCashBalance(35000n, early + late, 1000, [300, 500, 250, 120, 10]);
  assert.equal(formatCents(cash.differenceCents), "51.00");
  assert.equal(formatCents(cash.expectedCents), "299.00");
});

test("adjustment copy includes only nonzero entries and uses actual newline characters", () => {
  assert.equal(buildCashAdjustmentText({ "cash-bank-transfer": "10", "cash-rmb-payment": "0", "cash-card-payment": "2.05" }),
    "银行转账多收客人$10, 现金少$10\nCard支付多收客人$2.05, 现金少$2.05");
  assert.equal(buildCashAdjustmentText({ "cash-delivery": "3", "cash-rmb-payment": "0.10", "cash-expenses": "1.01", "cash-legacy-change": "4" }),
    "配送现金$3, 现金少$3\n人民币支付多收客人$0.10, 现金少$0.10\n其他支出$1.01, 现金少$1.01\n旧版未分类找零$4, 现金少$4");
  assert.equal(buildCashAdjustmentText({}), "");
  assert.equal(buildCashAdjustmentText({ "cash-bank-transfer": "0.001" }), null);
  assert.equal(buildCashAdjustmentText({ "cash-expenses": "20000.01" }), null);
});
