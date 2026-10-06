import { NOTE_DENOMINATIONS } from "./calculator.js";

export const RETENTION_STORAGE_KEY = "no3-note-counter:retention:v1";

/** An empty saved selection means no retention; null means use the defaults. */
export function parseRetentionSelection(text) {
  let state;
  try { state = JSON.parse(text); } catch { return null; }
  if (!state || state.version !== 1 || !Array.isArray(state.denominations)
    || state.denominations.some((value) => !NOTE_DENOMINATIONS.includes(value))
    || new Set(state.denominations).size !== state.denominations.length) return null;
  return NOTE_DENOMINATIONS.filter((value) => state.denominations.includes(value));
}
