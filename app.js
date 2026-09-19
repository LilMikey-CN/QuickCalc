import { calculateCashTotal, calculateNoteTotals, calculateTotal, formatCents, parseAmount, parseNoteCount } from "./calculator.js";

const configurations = {
  card: {
    title: "Card 结算", subtitle: "输入金额，即时计算", resultTitle: "计算结果",
    storageKey: "no3-card-calculator:amounts:v1",
    fields: [
      { id: "morning", label: "上午", sign: "+" },
      { id: "current", label: "当前", sign: "+" },
      { id: "overcharged", label: "多收客人", sign: "+" },
      { id: "undercharged", label: "少收客人", sign: "−" },
    ],
    formula: "上午 + 当前 + 多收客人 − 少收客人",
  },
  cash: {
    title: "现金核对", subtitle: "核对应有现金与钱箱余额", resultTitle: "现金差额",
    storageKey: "no3-cash-calculator:amounts:v1",
    fields: [
      { id: "cash-morning", label: "上午系统现金", sign: "+" },
      { id: "cash-current", label: "当前系统现金", sign: "+" },
      { id: "cash-delivery", label: "配送现金", sign: "−" },
      { id: "cash-retained", label: "昨日留存", sign: "−" },
      { id: "cash-extra-change", label: "多找客人现金", sign: "−" },
      { id: "cash-expenses", label: "其他支出", sign: "−" },
      { id: "cash-drawer", label: "当前钱箱余额", sign: "−" },
    ],
    formula: "上午系统现金 + 当前系统现金 − 配送现金 − 昨日留存 − 多找客人现金 − 其他支出 − 当前钱箱余额",
  },
  notes: {
    title: "澳元点钞", subtitle: "输入张数，快速合计", resultTitle: "纸币总额 · AUD",
    storageKey: "no3-note-counter:counts:v1",
    fields: [100, 50, 20, 10, 5].map((value) => ({ id: `notes-${value}`, label: `$${value} 纸币张数`, denomination: value })),
    formula: "各面额 × 张数，再相加",
  },
};

const resetButton = document.querySelector("#reset-button");
const tabButtons = [...document.querySelectorAll('[role="tab"]')];
const ACTIVE_TAB_KEY = "no3-tools:active-tab:v1";
let activeTab = "card";

function createCalculator(name, config) {
  const panel = document.querySelector(`#panel-${name}`);
  panel.append(document.querySelector("#calculator-template").content.cloneNode(true));
  const get = (selector) => panel.querySelector(selector);
  const form = get("form");
  form.id = name === "card" ? "calculator-form" : `${name}-form`;
  const hint = get(".input-hint");
  hint.id = `${name}-hint`;
  const isNotes = name === "notes";
  const parse = isNotes ? parseNoteCount : parseAmount;
  if (isNotes) {
    get(".input-heading").textContent = "输入纸币张数";
    hint.textContent = "0、1、2… · 仅限整数";
    get(".precision-hint").textContent = "澳元 AUD";
  }

  const inputs = config.fields.map((field, index) => {
    const row = document.querySelector("#field-template").content.firstElementChild.cloneNode(true);
    row.id = `${field.id}-field`;
    row.classList.toggle("field-subtract", field.sign === "−");
    row.classList.toggle("note-field", isNotes);
    const label = row.querySelector("label");
    label.htmlFor = field.id;
    label.textContent = field.label;
    const input = row.querySelector("input");
    input.id = field.id;
    input.name = field.id;
    input.inputMode = isNotes ? "numeric" : "decimal";
    input.placeholder = isNotes ? "0" : "0.00";
    input.enterKeyHint = index === config.fields.length - 1 ? "done" : "next";
    input.setAttribute("aria-describedby", `${hint.id} ${field.id}-error`);
    row.querySelector(".field-error").id = `${field.id}-error`;
    row.querySelector(".operator").textContent = isNotes ? `$${field.denomination}` : field.sign;
    row.querySelector(".field-index").textContent = isNotes ? "张" : String(index + 1).padStart(2, "0");
    get(".fields").append(row);
    return input;
  });

  const result = get(".result-value");
  result.id = name === "card" ? "result" : `${name}-result`;
  result.setAttribute("for", inputs.map((input) => input.id).join(" "));
  get(".result-title").textContent = config.resultTitle;
  get(".result-title").id = `${name}-result-heading`;
  get(".result-card").setAttribute("aria-labelledby", `${name}-result-heading`);
  get(".formula-label").textContent = config.formula;
  get(".cash-summary").hidden = name !== "cash";
  get(".balance-status").hidden = name !== "cash";
  get(".subtotal-card").hidden = !isNotes;
  get(".subtotal-title").id = `${name}-subtotal-heading`;
  get(".subtotal-card").setAttribute("aria-labelledby", `${name}-subtotal-heading`);
  get(".subtotal-value").id = `${name}-subtotal`;
  get(".subtotal-value").setAttribute("for", inputs.slice(2).map((input) => input.id).join(" "));
  const copyButton = get(".copy-button");
  const copyLabel = get(".copy-label");
  const actionStatus = get(".action-status");
  const storageStatus = get(".storage-status");
  let currentTotal = 0;
  let copyFeedbackTimer;

  function showStorageStatus(available) {
    const message = available ? "本页输入自动保存在此浏览器" : "浏览器无法保存，关闭后输入可能丢失";
    if (storageStatus.textContent !== message) storageStatus.textContent = message;
    storageStatus.classList.toggle("storage-warning", !available);
  }

  function saveInputs() {
    try {
      // Save text, including unfinished input, without decimal conversion.
      if (inputs.every((input) => input.value === "")) localStorage.removeItem(config.storageKey);
      else localStorage.setItem(config.storageKey, JSON.stringify(Object.fromEntries(inputs.map((input) => [input.id, input.value]))));
      showStorageStatus(true);
    } catch {
      showStorageStatus(false);
    }
  }

  function restoreInputs() {
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
      && inputs.every((input) => typeof values[input.id] === "string");
    inputs.forEach((input) => { input.value = valid ? values[input.id] : ""; });
  }

  function refreshReset() {
    if (activeTab === name) resetButton.disabled = inputs.every((input) => input.value === "");
  }

  function update() {
    clearTimeout(copyFeedbackTimer);
    copyLabel.textContent = "复制结果";
    actionStatus.textContent = "";
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
      result.textContent = "—";
      get(".formula-values").textContent = "请修改标红的输入后查看结果";
      get(".expected-value").textContent = "—";
      get(".drawer-value").textContent = "—";
      get(".balance-status").textContent = "";
      get(".subtotal-value").textContent = "—";
      get(".subtotal-formula").textContent = "请修改标红的张数";
      return;
    }

    if (isNotes) {
      const counts = amounts.map((amount) => amount.count);
      const totals = calculateNoteTotals(counts);
      currentTotal = totals.totalCents;
      const terms = counts.map((count, index) => `$${config.fields[index].denomination} × ${count}`);
      get(".formula-values").textContent = terms.join(" + ");
      get(".subtotal-value").textContent = formatCents(totals.smallNotesCents, true);
      get(".subtotal-formula").textContent = terms.slice(2).join(" + ");
    } else {
      const cents = amounts.map((amount) => amount.cents);
      if (name === "cash") {
        const totals = calculateCashTotal(...cents);
        currentTotal = totals.differenceCents;
        get(".expected-value").textContent = formatCents(totals.expectedCents, true);
        get(".drawer-value").textContent = formatCents(cents[6], true);
        get(".balance-status").textContent = currentTotal === 0 ? "账实相符" : currentTotal > 0
          ? `钱箱少 ${formatCents(currentTotal, true)}` : `钱箱多 ${formatCents(-currentTotal, true)}`;
      } else currentTotal = calculateTotal(...cents);
      get(".formula-values").textContent = cents.map((amount, index) => `${index ? `${config.fields[index].sign} ` : ""}${formatCents(amount, true)}`).join(" ") + ` = ${formatCents(currentTotal, true)}`;
    }
    result.textContent = formatCents(currentTotal, true);
  }

  inputs.forEach((input, index) => {
    input.closest(".field").addEventListener("click", (event) => {
      if (event.target !== input) input.focus();
    });
    input.addEventListener("input", () => {
      update();
      // Save on each edit; mobile browsers may never fire unload events.
      saveInputs();
    });
    input.addEventListener("focus", () => input.select());
    input.addEventListener("blur", () => {
      const amount = parse(input.value);
      if (amount.ok && input.value.trim() !== "") input.value = isNotes ? String(amount.count) : formatCents(amount.cents);
      update();
      saveInputs();
    });
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      if (!parse(input.value).ok) return;
      if (index < inputs.length - 1) inputs[index + 1].focus();
      else input.blur();
    });
  });

  form.addEventListener("submit", (event) => event.preventDefault());
  form.addEventListener("reset", (event) => {
    event.preventDefault();
    inputs.forEach((input) => { input.value = ""; });
    update();
    saveInputs();
    inputs[0].focus();
  });

  copyButton.addEventListener("click", async () => {
    if (currentTotal === null) return;
    const text = formatCents(currentTotal).replace("−", "-");
    try {
      await navigator.clipboard.writeText(text);
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
  return { panel, form, restoreInputs, update, refreshReset };
}

const calculators = Object.fromEntries(Object.entries(configurations).map(([name, config]) => [name, createCalculator(name, config)]));

function selectTab(name, remember = true) {
  if (!Object.hasOwn(calculators, name)) name = "card";
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
  if (remember) {
    window.scrollTo(0, 0);
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
window.addEventListener("pageshow", (event) => {
  for (const calculator of Object.values(calculators)) {
    if (event.persisted) calculator.restoreInputs();
    calculator.update();
  }
});
