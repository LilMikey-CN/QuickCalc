import { calculateCardTotal, calculateCashBalance, formatCents, parseAmount } from "./calculator.js";
import { CARD_STORAGE_KEY, CARD_PREVIOUS_STORAGE_KEY, createCardState, parseCardState, parseLegacyCardState } from "./card-state.js";
import { CASH_STORAGE_KEY, CASH_PREVIOUS_STORAGE_KEY, createCashState, parseCashState, parseLegacyCashState } from "./cash-state.js";
import { copyAmount, createAmountCopyButton, createTextCopyButton } from "./clipboard.js";
import { buildCashAdjustmentText } from "./cash-adjustments.js";

export function createAmountCalculator(name, panel, config, { resetButton, isActive, getDrawerCents }) {
  const isCash = name === "cash";
  const storageKey = isCash ? CASH_STORAGE_KEY : CARD_STORAGE_KEY;
  const previousKey = isCash ? CASH_PREVIOUS_STORAGE_KEY : CARD_PREVIOUS_STORAGE_KEY;
  const createState = isCash ? createCashState : createCardState;
  const parseState = isCash ? parseCashState : parseCardState;
  const parseLegacyState = isCash ? parseLegacyCashState : parseLegacyCardState;
  const optionalFields = config.fields.slice(isCash ? 4 : 2);
  const adjustmentLabel = isCash ? "现金支出调整" : "客人金额调整";
  let state = createState();
  let currentTotal = 0n;
  let systemTotal = 0n;
  let adjustmentText = "";
  let copyFeedbackTimer;
  const fieldCopyControls = new Map();

  panel.append(document.querySelector("#calculator-template").content.cloneNode(true));
  const get = (selector) => panel.querySelector(selector);
  const form = get("form");
  form.id = isCash ? "cash-form" : "calculator-form";
  get(".input-hint").id = `${name}-hint`;
  get(".result-title").textContent = config.resultTitle;
  get(".result-title").id = `${name}-result-heading`;
  get(".result-card").setAttribute("aria-labelledby", `${name}-result-heading`);
  get(".cash-summary").hidden = !isCash;
  get(".balance-status").hidden = !isCash;
  const result = get(".result-value");
  result.id = isCash ? "cash-result" : "result";
  const copyButton = get(".copy-button");
  const copyLabel = get(".copy-label");
  const actionStatus = get(".action-status");
  const storageStatus = get(".storage-status");
  const fieldList = get(".fields");

  function makeButton(text, className) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = text;
    return button;
  }

  function makeSummary(id, labelText, hintText, readCents) {
    const row = document.createElement("div");
    row.id = `${id}-field`;
    row.className = "derived-summary";
    const caption = document.createElement("div");
    const label = document.createElement("label");
    label.htmlFor = id;
    label.textContent = labelText;
    const hint = document.createElement("p");
    hint.textContent = hintText;
    caption.append(label, hint);
    const output = document.createElement("output");
    output.id = id;
    output.className = "derived-value";
    output.setAttribute("aria-live", "polite");
    output.setAttribute("aria-atomic", "true");
    const control = createAmountCopyButton(id, labelText, readCents);
    const valueGroup = document.createElement("div");
    valueGroup.className = "copy-value-group";
    valueGroup.append(output, control.button);
    row.append(caption, valueGroup);
    return { row, output, control };
  }

  const shifts = [
    { key: "early", label: "早班", field: config.fields[isCash ? 1 : 0] },
    { key: "late", label: "晚班", field: config.fields[isCash ? 2 : 1] },
  ].map((shift) => {
    shift.total = 0n;
    shift.rows = document.createElement("section");
    shift.rows.className = "fields shift-group";
    shift.rows.id = `${name}-${shift.key}`;
    shift.rows.setAttribute("aria-label", `${shift.label}记录`);
    shift.add = makeButton(`＋ 添加${shift.label}补充记录`, "add-record-button");
    shift.add.id = `add-${name}-${shift.key}-record`;
    shift.add.addEventListener("click", () => addRecord(shift));
    shift.summary = makeSummary(`${name}-${shift.key}-total`, `${shift.label}合计`,
      isCash ? "系统现金 + 补充记录" : "记录 + 补充记录", () => shift.total);
    return shift;
  });
  const daily = isCash ? makeSummary("cash-daily", "系统现金总和", "早班合计 + 晚班合计", () => systemTotal) : null;
  daily?.row.classList.add("daily-summary");

  const adjustments = document.createElement("details");
  adjustments.className = "amount-adjustments";
  adjustments.id = `${name}-adjustments`;
  const summary = document.createElement("summary");
  const summaryLabel = document.createElement("span");
  summaryLabel.textContent = adjustmentLabel;
  const adjustmentStatus = document.createElement("span");
  adjustmentStatus.className = "adjustment-status";
  summary.append(summaryLabel, adjustmentStatus);
  const adjustmentFields = document.createElement("div");
  adjustmentFields.className = "fields adjustment-fields";
  adjustments.append(summary);
  if (isCash) {
    const hint = document.createElement("p");
    hint.className = "adjustment-hint";
    hint.textContent = "填写因非现金多收而找给客人的现金金额，所有金额以澳元填写。";
    adjustments.append(hint);
  }
  adjustments.append(adjustmentFields);
  form.append(adjustments);

  const legacyPanel = document.createElement("div");
  legacyPanel.className = "legacy-adjustment";
  legacyPanel.hidden = true;
  const legacyText = document.createElement("p");
  const legacyValue = document.createElement("output");
  legacyValue.id = "cash-legacy-change";
  const clearLegacy = makeButton("已分类，移除此项", "resolve-legacy-button");
  clearLegacy.addEventListener("click", () => {
    state["cash-legacy-change"] = "";
    update();
    saveInputs();
  });
  legacyPanel.append(legacyText, legacyValue, clearLegacy);
  const adjustmentPreview = document.createElement("pre");
  adjustmentPreview.className = "adjustment-preview";
  const copyAdjustments = isCash ? createTextCopyButton("cash-adjustments", "全部调整记录", () => adjustmentText) : null;
  if (copyAdjustments) {
    copyAdjustments.button.classList.add("copy-adjustments-button");
    const label = document.createElement("span");
    label.textContent = "复制全部调整记录";
    copyAdjustments.button.append(label);
    adjustments.append(legacyPanel, adjustmentPreview, copyAdjustments.button);
  }

  function editableInputs() { return [...form.querySelectorAll("input:not([readonly])")]; }
  function visibleInputs() { return editableInputs().filter((input) => !adjustments.contains(input) || adjustments.open); }

  function showStorageStatus(available) {
    storageStatus.textContent = available ? "本页输入自动保存在此浏览器" : "浏览器无法保存，关闭后输入可能丢失";
    storageStatus.classList.toggle("storage-warning", !available);
  }

  function saveInputs() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
      showStorageStatus(true);
    } catch { showStorageStatus(false); return; }
    // Remove previous copies only after the migrated state has been stored.
    try { localStorage.removeItem(previousKey); localStorage.removeItem(config.storageKey); } catch { /* Retry later. */ }
  }

  function refreshReset() {
    if (isActive()) resetButton.disabled = shifts.every((shift) => state.extras[shift.key].length === 0)
      && !state.adjustmentsOpen && config.fields.filter((field) => !field.readOnly).every((field) => state[field.id] === "")
      && (!isCash || state["cash-legacy-change"] === "");
  }

  function updateSummary(view, cents, ids) {
    view.output.textContent = cents === null ? "—" : formatCents(cents, true);
    view.output.setAttribute("for", ids.join(" "));
    view.control.refresh();
  }

  function update() {
    clearTimeout(copyFeedbackTimer);
    copyLabel.textContent = "复制结果";
    actionStatus.textContent = "";
    const inputs = [...form.querySelectorAll("input")];
    const parsed = new Map(inputs.map((input) => {
      let amount;
      if (input.readOnly) {
        const drawer = getDrawerCents();
        input.value = drawer === null ? "—" : formatCents(drawer);
        amount = drawer === null ? { ok: false, error: "请在点钞页修正纸币张数" } : { ok: true, cents: drawer };
      } else amount = parseAmount(input.value);
      input.setAttribute("aria-invalid", String(!amount.ok));
      input.closest(".field").classList.toggle("invalid", !amount.ok);
      const error = get(`#${input.id}-error`);
      error.hidden = amount.ok;
      error.textContent = amount.ok ? "" : amount.error;
      return [input.id, amount];
    }));

    for (const shift of shifts) {
      const ids = [shift.field.id, ...state.extras[shift.key].map((extra) => `${name}-extra-${extra.id}`)];
      const values = ids.map((id) => parsed.get(id));
      shift.total = values.every((value) => value.ok) ? calculateCardTotal(values.map((value) => value.cents)) : null;
      updateSummary(shift.summary, shift.total, ids);
    }
    systemTotal = shifts.every((shift) => shift.total !== null) ? shifts[0].total + shifts[1].total : null;
    if (daily) updateSummary(daily, systemTotal, shifts.map((shift) => shift.summary.output.id));
    fieldCopyControls.forEach((control) => control.refresh());

    const adjustmentTerms = [...optionalFields];
    if (isCash) {
      const legacy = parseAmount(state["cash-legacy-change"]);
      const hasLegacy = !legacy.ok || legacy.cents !== 0;
      legacyPanel.hidden = !hasLegacy;
      legacyText.textContent = "旧版未分类找零仍计入现金差额。请先填入对应新分类，再移除此项，避免重复计算。";
      legacyValue.textContent = legacy.ok ? formatCents(legacy.cents, true) : state["cash-legacy-change"];
      if (hasLegacy) {
        parsed.set("cash-legacy-change", legacy);
        adjustmentTerms.push({ id: "cash-legacy-change", label: "旧版未分类找零", sign: "−" });
      }
      adjustmentText = buildCashAdjustmentText(state);
      adjustmentPreview.textContent = adjustmentText ?? "请修改无效金额后复制";
      adjustmentPreview.hidden = adjustmentText === "";
      copyAdjustments.refresh();
    }
    const adjustmentAmounts = adjustmentTerms.map((term) => parsed.get(term.id));
    const invalidAdjustment = adjustmentAmounts.some((amount) => !amount.ok);
    const hasAdjustment = invalidAdjustment || adjustmentAmounts.some((amount) => amount.cents !== 0);
    adjustmentStatus.textContent = invalidAdjustment ? "请检查金额" : hasAdjustment ? "已计入合计" : "可选";
    adjustmentStatus.classList.toggle("invalid-adjustment", invalidAdjustment);

    const terms = isCash ? [
      { label: "钱箱余额", sign: "+", cents: parsed.get("cash-drawer").cents },
      { label: "系统现金总和", sign: "−", cents: systemTotal },
      { label: "昨日留存", sign: "−", cents: parsed.get("cash-retained").cents },
    ] : shifts.map((shift) => ({ label: `${shift.label}合计`, sign: "+", cents: shift.total }));
    if (adjustments.open || hasAdjustment) terms.push(...adjustmentTerms.map((term) => ({ ...term, cents: parsed.get(term.id).cents })));
    result.setAttribute("for", inputs.map((input) => input.id).join(" "));
    get(".formula-label").textContent = terms.map((term, index) => `${index ? `${term.sign} ` : ""}${term.label}`).join(" ") + (isCash ? " = 现金差额" : "");
    const invalid = [...parsed.values()].some((amount) => !amount.ok);
    copyButton.disabled = invalid;
    if (invalid) {
      currentTotal = null;
      result.textContent = "—";
      get(".formula-values").textContent = invalidAdjustment && !adjustments.open
        ? `请展开${adjustmentLabel}，修改标红的金额` : "请修改标红的输入后查看结果";
      get(".expected-value").textContent = "—";
      get(".drawer-value").textContent = "—";
      get(".balance-status").textContent = "";
    } else {
      if (isCash) {
        const drawer = parsed.get("cash-drawer").cents;
        const totals = calculateCashBalance(drawer, systemTotal, parsed.get("cash-retained").cents, adjustmentAmounts.map((amount) => amount.cents));
        currentTotal = totals.differenceCents;
        get(".expected-value").textContent = formatCents(totals.expectedCents, true);
        get(".drawer-value").textContent = formatCents(drawer, true);
        get(".balance-status").textContent = currentTotal === 0n ? "账实相符" : currentTotal > 0n
          ? `钱箱多 ${formatCents(currentTotal, true)}` : `钱箱少 ${formatCents(-currentTotal, true)}`;
      } else currentTotal = systemTotal + BigInt(parsed.get("overcharged").cents) - BigInt(parsed.get("undercharged").cents);
      result.textContent = formatCents(currentTotal, true);
      get(".formula-values").textContent = terms.map((term, index) => `${index ? `${term.sign} ` : ""}${formatCents(term.cents, true)}`).join(" ") + ` = ${formatCents(currentTotal, true)}`;
    }
    const visible = visibleInputs();
    visible.forEach((input, index) => { input.enterKeyHint = index === visible.length - 1 ? "done" : "next"; });
    refreshReset();
  }

  function makeField(field, value, setValue, shift = null, extra = null) {
    const row = document.querySelector("#field-template").content.firstElementChild.cloneNode(true);
    row.id = `${field.id}-field`;
    row.classList.toggle("field-subtract", field.sign === "−");
    row.querySelector("label").htmlFor = field.id;
    row.querySelector("label").textContent = field.label;
    row.querySelector(".operator").textContent = field.sign;
    const input = row.querySelector("input");
    input.id = field.id;
    input.name = field.id;
    input.value = value ?? "";
    input.setAttribute("aria-describedby", `${name}-hint ${field.id}-error`);
    row.querySelector(".field-error").id = `${field.id}-error`;
    const marker = row.querySelector(".field-index");
    if (isCash && (field.readOnly || shifts.some((item) => item.field.id === field.id))) {
      const control = createAmountCopyButton(field.id, field.label, () => {
        if (field.readOnly) return getDrawerCents();
        const amount = parseAmount(input.value);
        return amount.ok ? amount.cents : null;
      });
      fieldCopyControls.set(field.id, control);
      marker.replaceWith(control.button);
    } else marker.remove();
    if (field.readOnly) {
      input.readOnly = true;
      input.tabIndex = -1;
      input.inputMode = "none";
      row.classList.add("field-synced");
      const source = document.createElement("p");
      source.id = `${field.id}-source`;
      source.className = "linked-field-hint";
      source.textContent = "由纸币总额更新，请在点钞页修改";
      input.after(source);
      input.setAttribute("aria-describedby", `${source.id} ${field.id}-error`);
      return row;
    }
    if (extra) {
      row.classList.add("extra-record");
      row.dataset.shift = shift.key;
      const remove = makeButton("删除", "remove-record-button");
      remove.setAttribute("aria-label", `删除${field.label}`);
      remove.addEventListener("click", () => removeRecord(shift, extra.id));
      row.append(remove);
    }
    row.addEventListener("click", (event) => {
      if (event.target !== input && !event.target.closest("button")) input.focus({ preventScroll: true });
    });
    input.addEventListener("focus", () => input.select());
    input.addEventListener("input", () => { setValue(input.value); update(); saveInputs(); });
    input.addEventListener("blur", () => {
      const amount = parseAmount(input.value);
      if (amount.ok && input.value.trim() !== "") input.value = formatCents(amount.cents);
      setValue(input.value);
      update();
      saveInputs();
    });
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      if (!parseAmount(input.value).ok) return;
      const visible = visibleInputs();
      const next = visible[visible.indexOf(input) + 1];
      if (next) next.focus({ preventScroll: true });
      else input.blur();
    });
    return row;
  }

  function makeExtraField(shift, extra, index) {
    return makeField({ id: `${name}-extra-${extra.id}`, label: `${shift.label}补充记录${index + 1}`, sign: isCash ? "−" : "+" },
      extra.value, (value) => { extra.value = value; }, shift, extra);
  }

  function renderFields() {
    fieldCopyControls.clear();
    fieldList.replaceChildren();
    adjustmentFields.replaceChildren();
    if (isCash) fieldList.append(makeField(config.fields[0]));
    for (const shift of shifts) {
      shift.rows.replaceChildren(makeField(shift.field, state[shift.field.id], (value) => { state[shift.field.id] = value; }),
        ...state.extras[shift.key].map((extra, index) => makeExtraField(shift, extra, index)), shift.add, shift.summary.row);
      fieldList.append(shift.rows);
    }
    if (isCash) fieldList.append(daily.row, makeField(config.fields[3], state["cash-retained"], (value) => { state["cash-retained"] = value; }));
    for (const field of optionalFields) adjustmentFields.append(makeField(field, state[field.id], (value) => { state[field.id] = value; }));
    adjustments.open = state.adjustmentsOpen;
  }

  function restoreInputs() {
    let saved;
    let restored;
    let migrated = false;
    try {
      saved = localStorage.getItem(storageKey);
      if (saved !== null) restored = parseState(saved);
      else {
        const previous = localStorage.getItem(previousKey);
        restored = previous !== null ? parseState(previous) : parseLegacyState(localStorage.getItem(config.storageKey));
        migrated = Boolean(restored);
      }
      showStorageStatus(true);
    } catch { showStorageStatus(false); return; }
    state = restored || createState();
    state.adjustmentsOpen ||= [...optionalFields.map((field) => state[field.id]), ...(isCash ? [state["cash-legacy-change"]] : [])].some((value) => {
      const amount = parseAmount(value);
      return !amount.ok || amount.cents !== 0;
    });
    renderFields();
    if (migrated) saveInputs();
  }

  function addRecord(shift) {
    const extra = { id: state.nextExtraNumber++, value: "" };
    state.extras[shift.key].push(extra);
    const row = makeExtraField(shift, extra, state.extras[shift.key].length - 1);
    shift.add.before(row);
    update();
    saveInputs();
    row.querySelector("input").focus({ preventScroll: true });
  }

  function removeRecord(shift, id) {
    const records = state.extras[shift.key];
    const index = records.findIndex((extra) => extra.id === id);
    if (index === -1) return;
    records.splice(index, 1);
    get(`#${name}-extra-${id}-field`).remove();
    records.forEach((extra, i) => {
      const row = get(`#${name}-extra-${extra.id}-field`);
      const label = `${shift.label}补充记录${i + 1}`;
      row.querySelector("label").textContent = label;
      row.querySelector("button").setAttribute("aria-label", `删除${label}`);
    });
    update();
    saveInputs();
    actionStatus.textContent = `已删除${shift.label}补充记录${index + 1}`;
    const next = records[index];
    (next ? get(`#${name}-extra-${next.id}-field button`) : shift.add).focus({ preventScroll: true });
  }

  adjustments.addEventListener("toggle", () => {
    if (state.adjustmentsOpen === adjustments.open) return;
    state.adjustmentsOpen = adjustments.open;
    update();
    saveInputs();
  });
  form.addEventListener("submit", (event) => event.preventDefault());
  form.addEventListener("reset", (event) => {
    event.preventDefault();
    state = createState();
    renderFields();
    update();
    saveInputs();
    get(`#${shifts[0].field.id}`).focus({ preventScroll: true });
  });
  copyButton.addEventListener("click", async () => {
    if (currentTotal === null) return;
    try {
      const text = await copyAmount(currentTotal);
      copyLabel.textContent = "已复制";
      actionStatus.textContent = `已复制 ${text}`;
      copyFeedbackTimer = setTimeout(() => { copyLabel.textContent = "复制结果"; actionStatus.textContent = ""; }, 2500);
    } catch { actionStatus.textContent = "请长按上方结果进行复制"; }
  });

  renderFields();
  restoreInputs();
  update();
  return { panel, form, restoreInputs, update, refreshReset };
}
