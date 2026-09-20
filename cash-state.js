import { createAmountState, parseAmountState, parseLegacyAmountState } from "./amount-state.js";

export const CASH_STORAGE_KEY = "no3-cash-calculator:state:v2";
const names = ["cash-morning", "cash-current", "cash-retained", "cash-delivery", "cash-extra-change", "cash-expenses"];
export const createCashState = () => createAmountState(names);
export const parseCashState = (text) => parseAmountState(text, names);
// Only editable amounts migrate. The drawer always comes from the note counter.
export const parseLegacyCashState = (text) => parseLegacyAmountState(text, names);
