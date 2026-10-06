import { calculateNoteTotals, formatCents, parseNoteCount, NOTE_DENOMINATIONS, DEFAULT_RETAINED_DENOMINATIONS } from "./calculator.js";
import { createAmountCalculator } from "./amount-calculator.js";
import { installFocusScroll } from "./focus-scroll.js";
import { copyAmount } from "./clipboard.js";
import { cashAdjustmentFields } from "./cash-adjustments.js";
import { createCoinCounter } from "./coin-counter.js";
import { RETENTION_STORAGE_KEY, parseRetentionSelection } from "./note-retention.js";

const configurations = {
  card: {
    title: "Card 结算", subtitle: "输入金额，即时计算", resultTitle: "计算结果",
    storageKey: "no3-card-calculator:amounts:v1",
    fields: [
      { id: "morning", label: "早班", sign: "+" },
      { id: "current", label: "晚班", sign: "+" },
      { id: "overcharged", label: "多收客人", sign: "+" },
      { id: "undercharged", label: "少收客人", sign: "−" },
    ],
  },
  cash: {
    title: "现金核对", subtitle: "核对应有现金与钱箱余额", resultTitle: "现金差额",
    storageKey: "no3-cash-calculator:amounts:v1",
    fields: [
      { id: "cash-drawer", label: "钱箱余额", sign: "+", readOnly: true },
      { id: "cash-morning", label: "早班系统现金", sign: "−" },
      { id: "cash-current", label: "晚班系统现金", sign: "−" },
      { id: "cash-retained", label: "昨日留存", sign: "−" },
      ...cashAdjustmentFields,
    ],
  },
  notes: {
    title: "澳元点钞", subtitle: "输入张数，快速合计", resultTitle: "纸币总额 · AUD",
    storageKey: "no3-note-counter:counts:v1",
    fields: NOTE_DENOMINATIONS.map((value) => ({ id: `notes-${value}`, label: `$${value} 纸币张数`, denomination: value })),
    formula: "各面额 × 张数，再相加",
  },
};

const resetButton = document.querySelector("#reset-button");
const tabButtons = [...document.querySelectorAll('[role="tab"]')];
const ACTIVE_TAB_KEY = "no3-tools:active-tab:v1";
let activeTab = "card";
let noteTotalCents = 0n;
const calculators = {};

function syncCashDrawer(total) {
  noteTotalCents = total;
  calculators.cash?.update();
}

function createCalculator(name, config) {
  const panel = document.querySelector(`#panel-${name}`);
  if (name !== "notes") {
    return createAmountCalculator(name, panel, config, {
      resetButton, isActive: () => activeTab === name, getDrawerCents: () => noteTotalCents,
      onTotalChange: name === "card" ? () => calculators.notes?.refreshSummary() : undefined,
    });
  }
  panel.append(document.querySelector("#calculator-template").content.cloneNode(true));
  const get = (selector) => panel.querySelector(selector);
  const form = get("form");
  form.id = `${name}-form`;
  const hint = get(".input-hint");
  hint.id = `${name}-hint`;
  const parse = parseNoteCount;
  get(".input-heading").textContent = "输入纸币张数";
  hint.textContent = "0、1、2… · 仅限整数";
  get(".precision-hint").textContent = "澳元 AUD";

  const inputs = config.fields.map((field, index) => {
    const row = document.querySelector("#field-template").content.firstElementChild.cloneNode(true);
    row.id = `${field.id}-field`;
    row.classList.add("note-field");
    const label = row.querySelector("label");
    label.htmlFor = field.id;
    label.textContent = field.label;
    const input = row.querySelector("input");
    input.id = field.id;
    input.name = field.id;
    input.inputMode = "numeric";
    input.placeholder = "0";
    input.enterKeyHint = index === config.fields.length - 1 ? "done" : "next";
    input.setAttribute("aria-describedby", `${hint.id} ${field.id}-error`);
    row.querySelector(".field-error").id = `${field.id}-error`;
    row.querySelector(".operator").textContent = `$${field.denomination}`;
    row.querySelector(".field-index").textContent = "张";
    get(".fields").append(row);
    return input;
  });
  const editableInputs = inputs;

  const result = get(".result-value");
  result.id = `${name}-result`;
  result.setAttribute("for", inputs.map((input) => input.id).join(" "));
  get(".result-title").textContent = config.resultTitle;
  get(".result-title").id = `${name}-result-heading`;
  get(".result-card").setAttribute("aria-labelledby", `${name}-result-heading`);
  get(".formula-label").textContent = config.formula;
  get(".subtotal-card").hidden = false;
  get(".subtotal-title").id = `${name}-subtotal-heading`;
  get(".subtotal-card").setAttribute("aria-labelledby", `${name}-subtotal-heading`);
  get(".subtotal-value").id = `${name}-subtotal`;
  // Keep the paper total and retention visible before the optional coin section.
  form.append(get(".result-card"), get(".subtotal-card"));
  const retentionGroup = document.createElement("fieldset");
  retentionGroup.className = "retention-group";
  retentionGroup.innerHTML = `<legend>选择留存面额</legend>
    <p class="retention-hint" id="retention-hint">勾选面额的全部纸币计入留存</p>
    <div class="retention-options"></div>`;
  get(".subtotal-card").append(retentionGroup);
  const retentionStatus = document.createElement("p");
  retentionStatus.className = "retention-hint retention-save-status";
  retentionStatus.setAttribute("role", "status");
  get(".subtotal-card").append(retentionStatus);
  const copyButton = get(".copy-button");
  const copyLabel = get(".copy-label");
  const actionStatus = get(".action-status");
  const storageStatus = get(".storage-status");
  let currentTotal = 0n;
  let retainedCents = 0n;
  let copyFeedbackTimer;
  let noteStorageAvailable = true;
  let coinStorageAvailable = true;
  let retentionStorageAvailable = true;
  let retainedDenominations = [...DEFAULT_RETAINED_DENOMINATIONS];
  const retentionInputs = NOTE_DENOMINATIONS.map((denomination) => {
    const label = document.createElement("label");
    label.className = "retention-choice";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.id = `retain-${denomination}`;
    input.name = "retained-denominations";
    input.value = String(denomination);
    input.setAttribute("aria-label", `留存 $${denomination} 纸币`);
    input.setAttribute("aria-describedby", "retention-hint");
    const text = document.createElement("span");
    text.textContent = `$${denomination}`;
    label.append(input, text);
    retentionGroup.querySelector(".retention-options").append(label);
    input.addEventListener("change", () => {
      retainedDenominations = retentionInputs.filter((item) => item.checked).map((item) => Number(item.value));
      update();
      try {
        localStorage.setItem(RETENTION_STORAGE_KEY, JSON.stringify({ version: 1, denominations: retainedDenominations }));
        retentionStorageAvailable = true;
      } catch { retentionStorageAvailable = false; }
      showStorageStatus(noteStorageAvailable);
    });
    return input;
  });
  const coinCounter = createCoinCounter(form, {
    getSummaryAmounts: () => ({ cardCents: calculators.card?.getTotalCents() ?? null, noteCents: currentTotal, retainedCents }),
    onChange: () => {
      refreshReset();
      inputs.at(-1).enterKeyHint = coinCounter.isOpen() ? "next" : "done";
    },
    onStorageStatus: (available) => {
      coinStorageAvailable = available;
      showStorageStatus(noteStorageAvailable);
    },
  });

  function showStorageStatus(available) {
    noteStorageAvailable = available;
    available &&= coinStorageAvailable && retentionStorageAvailable;
    const message = available ? "本页输入自动保存在此浏览器" : "浏览器无法保存，关闭后输入可能丢失";
    if (storageStatus.textContent !== message) storageStatus.textContent = message;
    storageStatus.classList.toggle("storage-warning", !available);
    retentionStatus.textContent = retentionStorageAvailable ? "选择自动保存，清空数量时保留" : "留存设置无法保存，重新打开后可能丢失";
    retentionStatus.classList.toggle("storage-warning", !retentionStorageAvailable);
  }

  function saveInputs() {
    try {
      // Save text, including unfinished input, without decimal conversion.
      if (editableInputs.every((input) => input.value === "")) localStorage.removeItem(config.storageKey);
      else localStorage.setItem(config.storageKey, JSON.stringify(Object.fromEntries(editableInputs.map((input) => [input.id, input.value]))));
      showStorageStatus(true);
    } catch {
      showStorageStatus(false);
    }
  }

  function restoreInputs() {
    try {
      retainedDenominations = parseRetentionSelection(localStorage.getItem(RETENTION_STORAGE_KEY)) ?? [...DEFAULT_RETAINED_DENOMINATIONS];
      retentionStorageAvailable = true;
    } catch { retentionStorageAvailable = false; }
    coinCounter.restore();
    let savedText;
    try {
      savedText = localStorage.getItem(config.storageKey);
      showStorageStatus(true);
    } catch {
      showStorageStatus(false);
      return;
    }
    let values;
    try { values = JSON.parse(savedText); } catch { /* Ignore damaged saved data. */ }
    const valid = values && typeof values === "object" && !Array.isArray(values)
      && editableInputs.every((input) => typeof values[input.id] === "string");
    editableInputs.forEach((input) => { input.value = valid ? values[input.id] : ""; });
  }

  function refreshReset() {
    if (activeTab === name) resetButton.disabled = editableInputs.every((input) => input.value === "") && !coinCounter.hasValues();
  }

  function update() {
    clearTimeout(copyFeedbackTimer);
    copyLabel.textContent = "复制结果";
    actionStatus.textContent = "";
    retentionInputs.forEach((input) => {
      input.checked = retainedDenominations.includes(Number(input.value));
      input.closest("label").classList.toggle("is-selected", input.checked);
    });
    get(".subtotal-denominations").textContent = retainedDenominations.length ? `已选 ${retainedDenominations.length} 种` : "未选择";
    get(".subtotal-value").setAttribute("for", retainedDenominations.map((value) => `notes-${value}`).join(" "));
    const amounts = inputs.map((input) => {
      const amount = parse(input.value);
      const error = get(`#${input.id}-error`);
      input.setAttribute("aria-invalid", String(!amount.ok));
      input.closest(".field").classList.toggle("invalid", !amount.ok);
      error.hidden = amount.ok;
      error.textContent = amount.ok ? "" : amount.error;
      return amount;
    });
    refreshReset();
    const invalid = amounts.some((amount) => !amount.ok);
    copyButton.disabled = invalid;
    if (invalid) {
      currentTotal = null;
      retainedCents = null;
      result.textContent = "—";
      get(".formula-values").textContent = "请修改标红的输入后查看结果";
      get(".subtotal-value").textContent = "—";
      get(".subtotal-formula").textContent = "请修改标红的张数";
      syncCashDrawer(null);
      coinCounter.refreshSummary();
      return;
    }

    const counts = amounts.map((amount) => amount.count);
    const totals = calculateNoteTotals(counts, retainedDenominations);
    currentTotal = totals.totalCents;
    retainedCents = totals.retainedCents;
    const terms = counts.map((count, index) => `$${config.fields[index].denomination} × ${count}`);
    get(".formula-values").textContent = terms.join(" + ");
    get(".subtotal-value").textContent = formatCents(retainedCents, true);
    get(".subtotal-formula").textContent = terms.filter((_, index) => retainedDenominations.includes(config.fields[index].denomination)).join(" + ") || "未选择留存面额";
    result.textContent = formatCents(currentTotal, true);
    syncCashDrawer(currentTotal);
    coinCounter.refreshSummary();
  }

  editableInputs.forEach((input, index) => {
    input.closest(".field").addEventListener("click", (event) => {
      if (event.target !== input) input.focus({ preventScroll: true });
    });
    input.addEventListener("input", () => {
      update();
      // Save on each edit; mobile browsers may never fire unload events.
      saveInputs();
    });
    input.addEventListener("focus", () => input.select());
    input.addEventListener("blur", () => {
      const amount = parse(input.value);
      if (amount.ok && input.value.trim() !== "") input.value = String(amount.count);
      update();
      saveInputs();
    });
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      if (!parse(input.value).ok) return;
      if (index < editableInputs.length - 1) editableInputs[index + 1].focus({ preventScroll: true });
      else if (coinCounter.isOpen()) coinCounter.inputs[0].focus({ preventScroll: true });
      else input.blur();
    });
  });

  form.addEventListener("submit", (event) => event.preventDefault());
  form.addEventListener("reset", (event) => {
    event.preventDefault();
    editableInputs.forEach((input) => { input.value = ""; });
    coinCounter.reset();
    update();
    saveInputs();
    editableInputs[0].focus({ preventScroll: true });
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

  restoreInputs();
  update();
  return { panel, form, restoreInputs, update, refreshReset, refreshSummary: coinCounter.refreshSummary };
}

// Initialize in tab order so restored note counts populate the cash drawer.
for (const button of tabButtons) {
  const name = button.dataset.tab;
  calculators[name] = createCalculator(name, configurations[name]);
}

function selectTab(name, remember = true) {
  if (!Object.hasOwn(calculators, name)) name = "card";
  if (name !== activeTab) calculators[activeTab]?.panel.querySelector("input:focus")?.blur();
  activeTab = name;
  for (const button of tabButtons) {
    const selected = button.dataset.tab === name;
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
    calculators[button.dataset.tab].panel.hidden = !selected;
  }
  document.querySelector("#page-title").textContent = configurations[name].title;
  document.querySelector("#page-subtitle").textContent = configurations[name].subtitle;
  document.title = `${configurations[name].title} · NO.3`;
  resetButton.setAttribute("form", calculators[name].form.id);
  resetButton.setAttribute("aria-label", `清空本页：${configurations[name].title}`);
  calculators[name].refreshReset();
  calculators[name].refreshSummary?.();
  if (remember) {
    document.querySelector("#app-scroll").scrollTo(0, 0);
    try { localStorage.setItem(ACTIVE_TAB_KEY, name); } catch { /* Tabs work without storage. */ }
  }
}

for (const [index, button] of tabButtons.entries()) {
  button.addEventListener("click", () => selectTab(button.dataset.tab));
  button.addEventListener("keydown", (event) => {
    const next = { ArrowRight: (index + 1) % tabButtons.length, ArrowLeft: (index + tabButtons.length - 1) % tabButtons.length, Home: 0, End: tabButtons.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    tabButtons[next].focus();
    selectTab(tabButtons[next].dataset.tab);
  });
}

let savedTab = "card";
try { savedTab = localStorage.getItem(ACTIVE_TAB_KEY) || "card"; } catch { /* Keep the default tab. */ }
selectTab(savedTab, false);
installFocusScroll(document.querySelector(".calculator"));
window.addEventListener("pageshow", (event) => {
  for (const calculator of Object.values(calculators)) {
    if (event.persisted) calculator.restoreInputs();
    calculator.update();
  }
});
