import { formatCents } from "./calculator.js";
import { createTextCopyButton } from "./clipboard.js";
import { COIN_STORAGE_KEY, coinDenominations, parseCoinCount, calculateCoinTotal, buildCashReport, createCoinState, parseCoinState } from "./coin-calculator.js";

export function createCoinCounter(form, { getSummaryAmounts, onChange, onStorageStatus }) {
  let state = createCoinState();
  let counts = coinDenominations.map(() => 0n);
  const details = document.createElement("details");
  details.id = "coin-counter";
  details.className = "amount-adjustments coin-counter";
  details.innerHTML = `
    <summary><span>硬币统计</span><span class="adjustment-status">可选</span></summary>
    <p class="adjustment-hint" id="coins-hint">输入各面额枚数，空白按 0 计算 · 仅限整数</p>
    <div class="fields coin-fields"></div>
    <div class="derived-summary coin-total-row">
      <label for="coins-total">硬币总额 · AUD</label>
      <output id="coins-total" class="derived-value" aria-live="polite" aria-atomic="true">0.00</output>
    </div>
    <section class="cash-report" aria-labelledby="cash-report-heading">
      <div class="section-heading"><h2 id="cash-report-heading">现金汇总</h2><p>日期自动更新</p></div>
      <p class="adjustment-hint">Card 为结算合计；Cash 为纸币总额；留存按上方勾选的纸币面额计算。</p>
      <pre id="cash-report-text" tabindex="0" aria-label="现金汇总文本"></pre>
    </section>`;
  form.append(details);
  const status = details.querySelector(".adjustment-status");
  const total = details.querySelector("#coins-total");
  const preview = details.querySelector("#cash-report-text");

  const inputs = coinDenominations.map((coin, index) => {
    const row = document.querySelector("#field-template").content.firstElementChild.cloneNode(true);
    row.id = `${coin.id}-field`;
    row.classList.add("note-field");
    const label = row.querySelector("label");
    label.htmlFor = coin.id;
    label.textContent = `$${coin.label} 硬币枚数`;
    const input = row.querySelector("input");
    input.id = coin.id;
    input.name = coin.id;
    input.inputMode = "numeric";
    input.placeholder = "0";
    input.enterKeyHint = index === coinDenominations.length - 1 ? "done" : "next";
    input.setAttribute("aria-describedby", `coins-hint ${coin.id}-error`);
    row.querySelector(".field-error").id = `${coin.id}-error`;
    row.querySelector(".operator").textContent = `$${coin.label}`;
    row.querySelector(".field-index").textContent = "枚";
    row.addEventListener("click", (event) => {
      if (event.target !== input) input.focus({ preventScroll: true });
    });
    input.addEventListener("focus", () => input.select());
    input.addEventListener("input", () => { update(); save(); });
    input.addEventListener("blur", () => {
      const amount = parseCoinCount(input.value);
      if (amount.ok && input.value.trim() !== "") input.value = String(amount.count);
      update();
      save();
    });
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      if (!parseCoinCount(input.value).ok) return;
      if (inputs[index + 1]) inputs[index + 1].focus({ preventScroll: true });
      else input.blur();
    });
    details.querySelector(".coin-fields").append(row);
    return input;
  });
  total.setAttribute("for", inputs.map((input) => input.id).join(" "));

  function readReport() {
    return buildCashReport({ ...getSummaryAmounts(), coinCounts: counts });
  }

  // Read the date again inside the user gesture, including across midnight.
  const copy = createTextCopyButton("cash-report", "现金汇总", readReport);
  copy.button.classList.add("copy-adjustments-button");
  const copyLabel = document.createElement("span");
  copyLabel.textContent = "复制现金汇总";
  copy.button.append(copyLabel);
  details.querySelector(".cash-report").append(copy.button);

  function refreshSummary() {
    const amounts = getSummaryAmounts();
    const text = buildCashReport({ ...amounts, coinCounts: counts });
    preview.textContent = text ?? (amounts.cardCents === null ? "请先修正 Card 页金额后复制汇总。"
      : amounts.noteCents === null ? "请先修正纸币张数后复制汇总。" : "请先修正硬币枚数后复制汇总。");
    preview.classList.toggle("report-invalid", text === null);
    copy.refresh();
  }

  function update() {
    const parsed = inputs.map((input) => {
      const amount = parseCoinCount(input.value);
      input.setAttribute("aria-invalid", String(!amount.ok));
      input.closest(".field").classList.toggle("invalid", !amount.ok);
      const error = details.querySelector(`#${input.id}-error`);
      error.hidden = amount.ok;
      error.textContent = amount.ok ? "" : amount.error;
      return amount;
    });
    counts = parsed.every((amount) => amount.ok) ? parsed.map((amount) => amount.count) : null;
    const cents = counts === null ? null : calculateCoinTotal(counts);
    total.textContent = cents === null ? "—" : formatCents(cents, true);
    status.textContent = cents === null ? "请检查枚数" : cents === 0n ? "可选" : `$${formatCents(cents, true)}`;
    status.classList.toggle("invalid-adjustment", cents === null);
    refreshSummary();
    onChange();
  }

  function save() {
    state.open = details.open;
    state.counts = Object.fromEntries(inputs.map((input) => [input.id, input.value]));
    try {
      localStorage.setItem(COIN_STORAGE_KEY, JSON.stringify(state));
      onStorageStatus(true);
    } catch { onStorageStatus(false); }
  }

  function restore() {
    try {
      state = parseCoinState(localStorage.getItem(COIN_STORAGE_KEY)) || createCoinState();
      onStorageStatus(true);
    } catch { onStorageStatus(false); return; }
    inputs.forEach((input) => { input.value = state.counts[input.id]; });
    details.open = state.open;
    update();
  }

  function updateDisclosure() {
    refreshSummary();
    onChange();
    if (details.open !== state.open) save();
  }
  details.querySelector("summary").addEventListener("click", (event) => {
    // Persist in the user gesture: the native toggle event is queued and can be
    // lost if the page closes or reloads immediately after the disclosure changes.
    event.preventDefault();
    details.open = !details.open;
    updateDisclosure();
  });
  details.addEventListener("toggle", updateDisclosure);

  let dateTimer;
  function refreshDate() {
    clearTimeout(dateTimer);
    refreshSummary();
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    dateTimer = setTimeout(refreshDate, midnight.getTime() - now.getTime() + 50);
  }
  window.addEventListener("focus", refreshDate);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshDate();
  });
  // Defer the first refresh until the parent has finished setting up its state.
  queueMicrotask(refreshDate);

  return {
    inputs, restore, refreshSummary,
    isOpen: () => details.open,
    hasValues: () => details.open || inputs.some((input) => input.value !== ""),
    reset() {
      state = createCoinState();
      inputs.forEach((input) => { input.value = ""; });
      details.open = false;
      update();
      save();
    },
  };
}
