export function createAmountState(amountNames) {
  return {
    version: 3,
    ...Object.fromEntries(amountNames.map((name) => [name, ""])),
    extras: { early: [], late: [] },
    nextExtraNumber: 1,
    adjustmentsOpen: false,
  };
}

function parseObject(text) {
  try {
    const value = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

export function parseAmountState(text, amountNames) {
  const value = parseObject(text);
  if (!value || ![2, 3].includes(value.version)
    || !amountNames.every((name) => typeof value[name] === "string")
    || !Number.isSafeInteger(value.nextExtraNumber) || value.nextExtraNumber < 1
    || typeof value.adjustmentsOpen !== "boolean") return null;

  const extras = value.version === 2 ? { early: value.extras, late: [] } : value.extras;
  if (!extras || !Array.isArray(extras.early) || !Array.isArray(extras.late)) return null;
  const ids = new Set();
  for (const extra of [...extras.early, ...extras.late]) {
    if (!extra || !Number.isSafeInteger(extra.id) || extra.id < 1
      || extra.id >= value.nextExtraNumber || ids.has(extra.id)
      || typeof extra.value !== "string") return null;
    ids.add(extra.id);
  }

  // Restore text exactly, including unfinished or invalid input for normal UI validation.
  return {
    ...createAmountState(amountNames),
    ...Object.fromEntries(amountNames.map((name) => [name, value[name]])),
    extras: Object.fromEntries(["early", "late"].map((shift) => [shift,
      extras[shift].map(({ id, value: amount }) => ({ id, value: amount })),
    ])),
    nextExtraNumber: value.nextExtraNumber,
    adjustmentsOpen: value.adjustmentsOpen,
  };
}

export function parseLegacyAmountState(text, amountNames) {
  const value = parseObject(text);
  if (!value || !amountNames.every((name) => typeof value[name] === "string")) return null;
  return { ...createAmountState(amountNames), ...Object.fromEntries(amountNames.map((name) => [name, value[name]])) };
}
