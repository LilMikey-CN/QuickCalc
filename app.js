import { calculateTotal, formatCents, parseAmount } from "./calculator.js";

const form = document.querySelector("#calculator-form");
const inputs = [...form.querySelectorAll("input")];
const result = document.querySelector("#result");
const formula = document.querySelector("#formula-values");
const resetButton = document.querySelector("#reset-button");
const copyButton = document.querySelector("#copy-button");
const copyLabel = document.querySelector("#copy-label");
const actionStatus = document.querySelector("#action-status");
let currentTotal = 0;
let copyFeedbackTimer;

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
  input.addEventListener("input", update);
  // One tap selects an existing amount, making replacement quick on a phone.
  input.addEventListener("focus", () => input.select());
  input.addEventListener("blur", () => {
    const amount = parseAmount(input.value);
    if (amount.ok && input.value.trim() !== "") input.value = formatCents(amount.cents);
    update();
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

// Restore the displayed calculation when the browser restores form values.
window.addEventListener("pageshow", update);
update();
