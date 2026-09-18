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
  if (amounts.some((amount) => !Number.isSafeInteger(amount) || amount < 0 || amount > MAX_CENTS)) {
    throw new RangeError("Amounts must be integer cents between 0 and 2,000,000.");
  }
  return morning + current + overcharged - undercharged;
}

/** Format using integer division and remainder, including negative results. */
export function formatCents(cents, grouped = false) {
  if (!Number.isSafeInteger(cents)) throw new TypeError("Expected integer cents.");
  const absolute = Math.abs(cents);
  let whole = String(Math.floor(absolute / 100));
  if (grouped) whole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${cents < 0 ? "−" : ""}${whole}.${String(absolute % 100).padStart(2, "0")}`;
}
