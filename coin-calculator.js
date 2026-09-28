import { formatCents, parseNoteCount } from "./calculator.js";

export const COIN_STORAGE_KEY = "no3-coin-counter:state:v1";
export const coinDenominations = [
  { cents: 200n, label: "2" }, { cents: 100n, label: "1" },
  { cents: 50n, label: "0.5" }, { cents: 20n, label: "0.2" },
  { cents: 10n, label: "0.1" }, { cents: 5n, label: "0.05" },
].map((coin) => ({ ...coin, id: `coins-${coin.cents}` }));

export function parseCoinCount(value) {
  const amount = parseNoteCount(value);
  return amount.ok ? amount : { ok: false, error: "请输入 0、1、2… 枚数，不含小数" };
}

export function calculateCoinTotal(counts) {
  if (!Array.isArray(counts) || counts.length !== coinDenominations.length
    || counts.some((count) => typeof count !== "bigint" || count < 0n)) {
    throw new RangeError("Expected six non-negative integer coin counts.");
  }
  return counts.reduce((sum, count, index) => sum + count * coinDenominations[index].cents, 0n);
}

function compactMoney(cents) {
  return formatCents(cents).replace("−", "-").replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

export function buildCashReport({ cardCents, noteCents, retainedCents, coinCounts, date = new Date() }) {
  if (cardCents === null || noteCents === null || retainedCents === null || coinCounts === null) return null;
  const coins = calculateCoinTotal(coinCounts);
  const lines = coinDenominations.map((coin, index) => `$${coin.label}x ${coinCounts[index]}`);
  return [
    `日期：${date.getMonth() + 1}.${date.getDate()}`,
    `Card：$${formatCents(cardCents).replace("−", "-")}`,
    `Cash：$${compactMoney(noteCents)}（留$${compactMoney(retainedCents)}）`,
    `Coins：$${compactMoney(coins)}`,
    lines.slice(0, 3).join("  "),
    lines.slice(3).join("  "),
  ].join("\n");
}

export function createCoinState() {
  return { version: 1, open: false, counts: Object.fromEntries(coinDenominations.map(({ id }) => [id, ""])) };
}

export function parseCoinState(text) {
  let state;
  try { state = JSON.parse(text); } catch { return null; }
  if (!state || state.version !== 1 || typeof state.open !== "boolean"
    || !state.counts || !coinDenominations.every(({ id }) => typeof state.counts[id] === "string")) return null;
  return { version: 1, open: state.open, counts: Object.fromEntries(coinDenominations.map(({ id }) => [id, state.counts[id]])) };
}
