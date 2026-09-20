import clipboardCopy from "clipboard-copy";
import { formatCents } from "./calculator.js";

export async function copyAmount(cents) {
  const text = formatCents(cents).replace("−", "-");
  // Start in the click handler so Safari retains the clipboard user gesture.
  await clipboardCopy(text);
  return text;
}

let toastTimer;
function notify(message) {
  const status = document.querySelector("#copy-status");
  clearTimeout(toastTimer);
  status.textContent = message;
  status.classList.add("is-visible");
  toastTimer = setTimeout(() => {
    status.classList.remove("is-visible");
    status.textContent = "";
  }, 2500);
}

export function createAmountCopyButton(id, label, readCents) {
  return createTextCopyButton(id, label, () => {
    const cents = readCents();
    return cents === null ? null : formatCents(cents).replace("−", "-");
  }, true);
}

export function createTextCopyButton(id, label, readText, showValue = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.id = `copy-${id}`;
  button.className = "copy-amount-button";
  button.title = `复制${label}`;
  button.setAttribute("aria-label", `复制${label}`);
  button.append(document.querySelector("#copy-amount-icon").content.cloneNode(true));
  let feedbackTimer;
  let copiedText;
  function resetFeedback() {
    clearTimeout(feedbackTimer);
    copiedText = undefined;
    button.classList.remove("is-copied");
    button.setAttribute("aria-label", `复制${label}`);
  }
  // Copying must not open the amount keyboard or dismiss an existing keyboard.
  // Cancel mouse focus, not pointerdown: cancelling pointerdown suppresses the
  // subsequent tap/click on iOS WebKit.
  button.addEventListener("mousedown", (event) => event.preventDefault());
  button.addEventListener("click", async (event) => {
    event.stopPropagation();
    const text = readText();
    if (text === null || text === "") return;
    try {
      await clipboardCopy(text);
      clearTimeout(feedbackTimer);
      copiedText = text;
      button.classList.add("is-copied");
      button.setAttribute("aria-label", `已复制${label}`);
      notify(`已复制${label}${showValue ? `：${text}` : ""}`);
      feedbackTimer = setTimeout(resetFeedback, 2500);
    } catch {
      notify("无法复制，请长按金额手动复制");
    }
  });
  return { button, refresh() {
    const text = readText();
    button.disabled = text === null || text === "";
    if (copiedText !== undefined && copiedText !== text) resetFeedback();
  } };
}
