import { formatCents, parseAmount } from "./calculator.js";

export const cashAdjustmentFields = [
  { id: "cash-delivery", label: "配送现金", description: "配送现金" },
  { id: "cash-bank-transfer", label: "银行转账多找客人", description: "银行转账多收客人" },
  { id: "cash-rmb-payment", label: "人民币支付多找客人", description: "人民币支付多收客人" },
  { id: "cash-card-payment", label: "Card 支付多找客人", description: "Card支付多收客人" },
  { id: "cash-expenses", label: "其他支出", description: "其他支出" },
].map((field) => ({ ...field, sign: "−" }));

export function buildCashAdjustmentText(values) {
  const fields = [...cashAdjustmentFields, { id: "cash-legacy-change", description: "旧版未分类找零" }];
  const lines = [];
  for (const field of fields) {
    const amount = parseAmount(values[field.id] ?? "");
    if (!amount.ok) return null;
    if (amount.cents === 0) continue;
    const money = formatCents(amount.cents).replace(/\.00$/, "");
    lines.push(`${field.description}$${money}, 现金少$${money}`);
  }
  return lines.join("\n");
}
