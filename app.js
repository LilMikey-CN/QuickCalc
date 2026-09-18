import { calculateTotal, formatCents, parseAmount } from "./calculator.js";

const form = document.querySelector("#calculator-form");
const inputs = [...form.querySelectorAll("input")];
const result = document.querySelector("#result");
const formula = document.querySelector("#formula-values");
const resetButton = document.querySelector("#reset-button");
const copyButton = document.querySelector("#copy-button");
const copyLabel = document.querySelector("#copy-label");
const actionStatus = document.querySelector("#action-status");
const storageStatus = document.querySelector("#storage-status");
const STORAGE_KEY = "no3-card-calculator:amounts:v1";
let currentTotal = 0;
let copyFeedbackTimer;

function showStorageStatus(available) {
  const message = available
    ? "金额自动保存在此浏览器"
    : "浏览器无法保存，关闭后金额可能丢失";
  if (storageStatus.textContent !== message) storageStatus.textContent = message;
  storageStatus.classList.toggle("storage-warning", !available);
}

function saveInputs() {
  try {
    const values = Object.fromEntries(inputs.map((input) => [input.id, input.value]));
    if (inputs.every((input) => input.value === "")) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      // Save text, including unfinished input, without introducing decimal rounding.
      localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
    }
    showStorageStatus(true);
  } catch {
    // Storage may be blocked or full; calculation must continue to work.
    showStorageStatus(false);
  }
}

function restoreInputs() {
  let savedText;
  try {
    savedText = localStorage.getItem(STORAGE_KEY);
    showStorageStatus(true);
  } catch {
    showStorageStatus(false);
    return;
  }

  let values;
  try {
    values = JSON.parse(savedText);
  } catch {
    // Ignore damaged saved data and let the next edit replace it.
  }
  const valid = values && typeof values === "object" && !Array.isArray(values)
    && inputs.every((input) => typeof values[input.id] === "string");
  inputs.forEach((input) => { input.value = valid ? values[input.id] : ""; });
}

function update() {
  clearTimeout(copyFeedbackTimer);
  copyLabel.textContent = "复制结果";
  actionStatus.textContent = "";

  const amounts = inputs.map((input) => {
    const amount = parseAmount(input.value);
    const error = document.querySelector(`#${input.id}-error`);
    input.setAttribute("aria-invalid", String(!amount.ok));
    input.closest(".field").classList.toggle("invalid", !amount.ok);
    error.hidden = amount.ok;
    error.textContent = amount.ok ? "" : amount.error;
    return amount;
  });

  resetButton.disabled = inputs.every((input) => input.value === "");
  const invalid = amounts.some((amount) => !amount.ok);
  copyButton.disabled = invalid;
  if (invalid) {
    currentTotal = null;
    result.textContent = "—";
    formula.textContent = "请修改标红的金额后查看结果";
    return;
  }

  const cents = amounts.map((amount) => amount.cents);
  currentTotal = calculateTotal(...cents);
  result.textContent = formatCents(currentTotal, true);
  const values = cents.map((amount) => formatCents(amount, true));
  formula.textContent = `${values[0]} + ${values[1]} + ${values[2]} − ${values[3]} = ${formatCents(currentTotal, true)}`;
}

inputs.forEach((input, index) => {
  input.closest(".field").addEventListener("click", (event) => {
    if (event.target !== input) input.focus();
  });
  input.addEventListener("input", () => {
    update();
    // Save immediately: closing a mobile browser may not fire unload events.
    saveInputs();
  });
  // One tap selects an existing amount, making replacement quick on a phone.
  input.addEventListener("focus", () => input.select());
  input.addEventListener("blur", () => {
    const amount = parseAmount(input.value);
    if (amount.ok && input.value.trim() !== "") input.value = formatCents(amount.cents);
    update();
    saveInputs();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (!parseAmount(input.value).ok) return;
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
  // Use the standard ASCII minus in copied text for pasting into other calculators.
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

// Refresh saved values when returning to a page held in the back/forward cache.
window.addEventListener("pageshow", (event) => {
  if (event.persisted) restoreInputs();
  update();
});
restoreInputs();
update();
