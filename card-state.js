import { createAmountState, parseAmountState, parseLegacyAmountState } from "./amount-state.js";

export const CARD_STORAGE_KEY = "no3-card-calculator:state:v2";
const names = ["morning", "current", "overcharged", "undercharged"];
export const createCardState = () => createAmountState(names);
export const parseCardState = (text) => parseAmountState(text, names);
export const parseLegacyCardState = (text) => parseLegacyAmountState(text, names);
