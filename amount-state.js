export function createAmountState(amountNames) {
  return {
    version: 2,
    ...Object.fromEntries(amountNames.map((name) => [name, ""])),
    extras: [],
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
  if (!value || value.version !== 2
    || !amountNames.every((name) => typeof value[name] === "string")
    || !Array.isArray(value.extras)
    || !Number.isSafeInteger(value.nextExtraNumber) || value.nextExtraNumber < 1
    || typeof value.adjustmentsOpen !== "boolean") return null;

  const ids = new Set();
  for (const extra of value.extras) {
    if (!extra || !Number.isSafeInteger(extra.id) || extra.id < 1
      || extra.id >= value.nextExtraNumber || ids.has(extra.id)
      || typeof extra.value !== "string") return null;
    ids.add(extra.id);
  }

  // Restore text exactly, including unfinished or invalid input for normal UI validation.
  return {
    ...createAmountState(amountNames),
    ...Object.fromEntries(amountNames.map((name) => [name, value[name]])),
    extras: value.extras.map(({ id, value: amount }) => ({ id, value: amount })),
    nextExtraNumber: value.nextExtraNumber,
    adjustmentsOpen: value.adjustmentsOpen,
  };
}

export function parseLegacyAmountState(text, amountNames) {
  const value = parseObject(text);
  if (!value || !amountNames.every((name) => typeof value[name] === "string")) return null;
  return { ...createAmountState(amountNames), ...Object.fromEntries(amountNames.map((name) => [name, value[name]])) };
}
