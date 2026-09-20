import { calculateCardTotal, calculateCashTotal, formatCents, parseAmount } from "./calculator.js";
import { CARD_STORAGE_KEY, createCardState, parseCardState, parseLegacyCardState } from "./card-state.js";
import { CASH_STORAGE_KEY, createCashState, parseCashState, parseLegacyCashState } from "./cash-state.js";
import { copyAmount, createAmountCopyButton } from "./clipboard.js";

export function createAmountCalculator(name, panel, config, { resetButton, isActive, getDrawerCents }) {
  const isCash = name === "cash";
  const storageKey = isCash ? CASH_STORAGE_KEY : CARD_STORAGE_KEY;
  const createState = isCash ? createCashState : createCardState;
  const parseState = isCash ? parseCashState : parseCardState;
  const parseLegacyState = isCash ? parseLegacyCashState : parseLegacyCardState;
  const extraAfter = isCash ? "cash-morning" : "morning";
  const optionalFields = config.fields.slice(isCash ? 4 : 2);
  const optionalIds = new Set(optionalFields.map((field) => field.id));
  const adjustmentLabel = isCash ? "现金支出调整" : "客人金额调整";
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
  let state = createState();
  let removedRecord = null;
  let currentTotal = 0n;
  let copyFeedbackTimer;
  const fieldCopyControls = new Map();
  let dailyCashCents = 0n;
  let dailyCashCopy;

  function makeButton(text, className) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = text;
    return button;
  }

  const addButton = makeButton("＋ 添加补充记录", "add-record-button");
  addButton.id = `add-${name}-record`;
  const feedback = document.createElement("div");
  feedback.className = "record-feedback";
  feedback.hidden = true;
  const feedbackText = document.createElement("p");
  feedbackText.setAttribute("role", "status");
  const undoButton = makeButton("撤销", "undo-record-button");
  undoButton.id = `undo-${name}-record`;
  feedback.append(feedbackText, undoButton);

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
  adjustments.append(summary, adjustmentFields);
  form.append(adjustments);

  let dailyCashRow;
  let dailyCashTotal;
  if (isCash) {
    dailyCashRow = document.createElement("div");
    dailyCashRow.id = "cash-daily-field";
    dailyCashRow.className = "cash-daily-summary";
    const label = document.createElement("label");
    label.htmlFor = "cash-daily";
    label.textContent = "全天系统现金";
    dailyCashTotal = document.createElement("output");
    dailyCashTotal.id = "cash-daily";
    dailyCashTotal.className = "derived-value";
    dailyCashTotal.setAttribute("aria-live", "polite");
    dailyCashTotal.setAttribute("aria-atomic", "true");
    dailyCashCopy = createAmountCopyButton("cash-daily", "全天系统现金", () => dailyCashCents);
    const valueGroup = document.createElement("div");
    valueGroup.className = "copy-value-group";
    valueGroup.append(dailyCashTotal, dailyCashCopy.button);
    dailyCashRow.append(label, valueGroup);
  }

  function editableInputs() {
    return [...form.querySelectorAll("input:not([readonly])")];
  }

  function visibleInputs() {
    return editableInputs().filter((input) => !adjustments.contains(input) || adjustments.open);
  }

  function showStorageStatus(available) {
    const text = available ? "本页输入自动保存在此浏览器" : "浏览器无法保存，关闭后输入可能丢失";
    if (storageStatus.textContent !== text) storageStatus.textContent = text;
    storageStatus.classList.toggle("storage-warning", !available);
  }

  function saveInputs() {
    try {
      // An empty v2 state also prevents old saved amounts from returning after clear.
      localStorage.setItem(storageKey, JSON.stringify(state));
      showStorageStatus(true);
    } catch {
      showStorageStatus(false);
      return;
    }
    // Delete the legacy copy only after the new state has been saved successfully.
    try { localStorage.removeItem(config.storageKey); } catch { /* Migration can be retried later. */ }
  }

  function refreshReset() {
    if (isActive()) resetButton.disabled = state.extras.length === 0
      && !state.adjustmentsOpen && config.fields.filter((field) => !field.readOnly).every((field) => state[field.id] === "");
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

    const adjustmentAmounts = optionalFields.map((field) => parsed.get(field.id));
    const invalidAdjustment = adjustmentAmounts.some((amount) => !amount.ok);
    const hasAdjustment = invalidAdjustment || adjustmentAmounts.some((amount) => amount.cents !== 0);
    adjustmentStatus.textContent = invalidAdjustment ? "请检查金额" : hasAdjustment ? "已计入合计" : "可选";
    adjustmentStatus.classList.toggle("invalid-adjustment", invalidAdjustment);

    const terms = config.fields.flatMap((field) => {
      if (optionalIds.has(field.id) && !adjustments.open && !hasAdjustment) return [];
      return field.id === extraAfter ? [field, ...state.extras.map(extraFieldConfig)] : [field];
    });
    result.setAttribute("for", terms.map((term) => term.id).join(" "));
    get(".formula-label").textContent = terms.map((term, index) => `${index ? `${term.sign} ` : ""}${term.label}`).join(" ") + (isCash ? " = 现金差额" : "");

    if (dailyCashTotal) {
      const ids = ["cash-morning", ...state.extras.map((extra) => `${name}-extra-${extra.id}`), "cash-current"];
      const systemAmounts = ids.map((id) => parsed.get(id));
      dailyCashTotal.setAttribute("for", ids.join(" "));
      dailyCashCents = systemAmounts.every((amount) => amount.ok)
        ? calculateCardTotal(systemAmounts.map((amount) => amount.cents)) : null;
      dailyCashTotal.textContent = dailyCashCents === null ? "—" : formatCents(dailyCashCents, true);
      dailyCashCopy.refresh();
    }
    fieldCopyControls.forEach((control) => control.refresh());

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
        const extras = state.extras.map((extra) => parsed.get(`${name}-extra-${extra.id}`).cents);
        const totals = calculateCashTotal(...config.fields.map((field) => parsed.get(field.id).cents), extras);
        currentTotal = totals.differenceCents;
        get(".expected-value").textContent = formatCents(totals.expectedCents, true);
        get(".drawer-value").textContent = formatCents(parsed.get("cash-drawer").cents, true);
        get(".balance-status").textContent = currentTotal === 0n ? "账实相符" : currentTotal > 0n
          ? `钱箱多 ${formatCents(currentTotal, true)}` : `钱箱少 ${formatCents(-currentTotal, true)}`;
      } else {
        const additions = inputs.filter((input) => input.id !== "undercharged").map((input) => parsed.get(input.id).cents);
        currentTotal = calculateCardTotal(additions, parsed.get("undercharged").cents);
      }
      result.textContent = formatCents(currentTotal, true);
      get(".formula-values").textContent = terms.map((term, index) => `${index ? `${term.sign} ` : ""}${formatCents(parsed.get(term.id).cents, true)}`).join(" ") + ` = ${formatCents(currentTotal, true)}`;
    }
    const visible = visibleInputs();
    visible.forEach((input, index) => { input.enterKeyHint = index === visible.length - 1 ? "done" : "next"; });
    refreshReset();
  }

  function makeField(field, value, setValue, extra = null) {
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
    if (isCash && (field.id === "cash-drawer" || field.id === "cash-morning")) {
      const control = createAmountCopyButton(field.id, field.label, () => {
        if (field.readOnly) return getDrawerCents();
        const amount = parseAmount(input.value);
        return amount.ok ? amount.cents : null;
      });
      fieldCopyControls.set(field.id, control);
      const actions = document.createElement("div");
      actions.className = "field-actions";
      row.append(actions);
      if (field.readOnly) actions.append(marker);
      actions.append(control.button);
    }
    if (field.readOnly) {
      input.readOnly = true;
      input.tabIndex = -1;
      input.inputMode = "none";
      row.classList.add("field-synced");
      marker.textContent = "点钞同步";
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
      const removeButton = makeButton("删除", "remove-record-button");
      removeButton.setAttribute("aria-label", `删除${field.label}`);
      marker.replaceWith(removeButton);
      removeButton.addEventListener("click", () => removeRecord(extra.id));
    } else marker.remove();

    row.addEventListener("click", (event) => {
      if (event.target !== input && !event.target.closest("button")) input.focus();
    });
    input.addEventListener("focus", () => input.select());
    input.addEventListener("input", () => {
      setValue(input.value);
      update();
      saveInputs();
    });
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
      if (next) next.focus();
      else input.blur();
    });
    return row;
  }

  function extraFieldConfig(extra) {
    return { id: `${name}-extra-${extra.id}`, label: `补充记录${extra.id}`, sign: isCash ? "−" : "+" };
  }

  function makeExtraField(extra) {
    return makeField(extraFieldConfig(extra), extra.value, (value) => { extra.value = value; }, extra);
  }

  function discardUndo() {
    removedRecord = null;
    feedback.hidden = true;
    feedbackText.textContent = "";
  }

  function renderFields() {
    fieldCopyControls.clear();
    fieldList.replaceChildren();
    adjustmentFields.replaceChildren();
    for (const field of config.fields) {
      const row = makeField(field, state[field.id], (value) => { state[field.id] = value; });
      if (field.id === extraAfter) {
        fieldList.append(row, ...state.extras.map(makeExtraField), addButton, feedback);
      } else if (optionalIds.has(field.id)) adjustmentFields.append(row);
      else fieldList.append(row);
      if (field.id === "cash-current") fieldList.append(dailyCashRow);
    }
    adjustments.open = state.adjustmentsOpen;
    discardUndo();
  }

  function restoreInputs() {
    let saved;
    let legacy;
    try {
      saved = localStorage.getItem(storageKey);
      if (saved === null) legacy = localStorage.getItem(config.storageKey);
      showStorageStatus(true);
    } catch {
      showStorageStatus(false);
      return;
    }
    const migrated = saved === null ? parseLegacyState(legacy) : null;
    state = (saved === null ? migrated : parseState(saved)) || createState();
    // Never silently hide existing nonzero or invalid adjustment amounts on restore.
    state.adjustmentsOpen ||= optionalFields.some((field) => {
      const amount = parseAmount(state[field.id]);
      return !amount.ok || amount.cents !== 0;
    });
    renderFields();
    if (migrated) saveInputs();
  }

  addButton.addEventListener("click", () => {
    discardUndo();
    const extra = { id: state.nextExtraNumber++, value: "" };
    state.extras.push(extra);
    const row = makeExtraField(extra);
    addButton.before(row);
    update();
    saveInputs();
    row.querySelector("input").focus();
  });

  function removeRecord(id) {
    const index = state.extras.findIndex((extra) => extra.id === id);
    if (index === -1) return;
    const [extra] = state.extras.splice(index, 1);
    removedRecord = { extra, index };
    get(`#${name}-extra-${id}-field`).remove();
    feedback.hidden = false;
    feedbackText.textContent = `已删除补充记录${id}`;
    update();
    saveInputs();
    const next = state.extras[index];
    const nextButton = next ? get(`#${name}-extra-${next.id}-field .remove-record-button`) : addButton;
    nextButton.focus();
  }

  undoButton.addEventListener("click", () => {
    if (!removedRecord) return;
    const { extra, index } = removedRecord;
    state.extras.splice(index, 0, extra);
    const row = makeExtraField(extra);
    const next = state.extras[index + 1];
    (next ? get(`#${name}-extra-${next.id}-field`) : addButton).before(row);
    discardUndo();
    update();
    saveInputs();
    row.querySelector("input").focus();
  });

  adjustments.addEventListener("toggle", () => {
    // Programmatic restoration also emits toggle; avoid redundant storage writes.
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
    get(`#${extraAfter}`).focus();
  });

  copyButton.addEventListener("click", async () => {
    if (currentTotal === null) return;
    try {
      const text = await copyAmount(currentTotal);
      copyLabel.textContent = "已复制";
      actionStatus.textContent = `已复制 ${text}`;
      copyFeedbackTimer = setTimeout(() => {
        copyLabel.textContent = "复制结果";
        actionStatus.textContent = "";
      }, 2500);
    } catch {
      actionStatus.textContent = "请长按上方结果进行复制";
    }
  });

  // Render a usable blank calculator even when storage access is blocked.
  renderFields();
  restoreInputs();
  update();
  return { panel, form, restoreInputs, update, refreshReset };
}
