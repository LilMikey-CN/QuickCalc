import { createAmountState, parseAmountState, parseLegacyAmountState } from "./amount-state.js";

export const CASH_STORAGE_KEY = "no3-cash-calculator:state:v3";
export const CASH_PREVIOUS_STORAGE_KEY = "no3-cash-calculator:state:v2";
const oldNames = ["cash-morning", "cash-current", "cash-retained", "cash-delivery", "cash-extra-change", "cash-expenses"];
const names = ["cash-morning", "cash-current", "cash-retained", "cash-delivery", "cash-bank-transfer", "cash-rmb-payment", "cash-card-payment", "cash-expenses", "cash-legacy-change"];
export const createCashState = () => createAmountState(names);
function migrateOldCash(old) {
  if (!old) return null;
  const state = createCashState();
  for (const name of names) if (Object.hasOwn(old, name)) state[name] = old[name];
  state.extras = old.extras;
  state.nextExtraNumber = old.nextExtraNumber;
  state.adjustmentsOpen = old.adjustmentsOpen;
  // Do not guess which new payment category an existing cash adjustment belongs to.
  state["cash-legacy-change"] = old["cash-extra-change"];
  return state;
}
export function parseCashState(text) {
  let value;
  try { value = JSON.parse(text); } catch { return null; }
  return value?.version === 2 ? migrateOldCash(parseAmountState(text, oldNames)) : parseAmountState(text, names);
}
// Only editable amounts migrate. The drawer always comes from the note counter.
export const parseLegacyCashState = (text) => migrateOldCash(parseLegacyAmountState(text, oldNames));
