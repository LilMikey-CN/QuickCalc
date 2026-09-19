export const MAX_CENTS = 2_000_000;

/** Convert decimal text directly into integer cents; never multiply a float by 100. */
export function parseAmount(value) {
  const text = value.trim();
  if (text === "") return { ok: true, cents: 0 };

  if (!/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(text)) {
    return { ok: false, error: "请输入 0–20,000，最多 2 位小数" };
  }

  const [whole = "0", fraction = ""] = text.split(".");
  const wholeNumber = Number(whole);
  if (wholeNumber > 20_000) {
    return { ok: false, error: "金额不能超过 20,000.00" };
  }

  const cents = wholeNumber * 100 + Number(fraction.padEnd(2, "0"));
  if (cents > MAX_CENTS) {
    return { ok: false, error: "金额不能超过 20,000.00" };
  }

  return { ok: true, cents };
}

export function calculateTotal(morning, current, overcharged, undercharged) {
  const amounts = [morning, current, overcharged, undercharged];
  validateAmounts(amounts);
  return morning + current + overcharged - undercharged;
}

function validateAmounts(amounts) {
  if (amounts.some((amount) => !Number.isSafeInteger(amount) || amount < 0 || amount > MAX_CENTS)) {
    throw new RangeError("Amounts must be integer cents between 0 and 2,000,000.");
  }
}

export function calculateCashTotal(morning, current, delivery, retained, extraChange, expenses, drawer) {
  validateAmounts([morning, current, delivery, retained, extraChange, expenses, drawer]);
  const expectedCents = morning + current - delivery + retained - extraChange - expenses;
  return { expectedCents, differenceCents: expectedCents - drawer };
}

/** Counts remain integers even beyond Number.MAX_SAFE_INTEGER. */
export function parseNoteCount(value) {
  const text = value.trim();
  if (text === "") return { ok: true, count: 0n };
  if (!/^\d+$/.test(text)) {
    return { ok: false, error: "请输入 0、1、2… 张数，不含小数" };
  }
  return { ok: true, count: BigInt(text) };
}

export function calculateNoteTotals(counts) {
  if (!Array.isArray(counts) || counts.length !== 5
    || counts.some((count) => typeof count !== "bigint" || count < 0n)) {
    throw new RangeError("Expected five non-negative integer note counts.");
  }
  const denominations = [100n, 50n, 20n, 10n, 5n];
  const values = counts.map((count, index) => count * denominations[index] * 100n);
  return {
    totalCents: values.reduce((total, value) => total + value, 0n),
    smallNotesCents: values[2] + values[3] + values[4],
  };
}

/** Format number or bigint cents using only integer division and remainder. */
export function formatCents(cents, grouped = false) {
  if (typeof cents !== "bigint" && !Number.isSafeInteger(cents)) {
    throw new TypeError("Expected integer cents.");
  }
  const integer = BigInt(cents);
  const absolute = integer < 0n ? -integer : integer;
  let whole = String(absolute / 100n);
  if (grouped) whole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${integer < 0n ? "−" : ""}${whole}.${String(absolute % 100n).padStart(2, "0")}`;
}
