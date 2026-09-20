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
  const button = document.createElement("button");
  button.type = "button";
  button.id = `copy-${id}`;
  button.className = "copy-amount-button";
  button.title = `复制${label}`;
  button.setAttribute("aria-label", `复制${label}`);
  button.append(document.querySelector("#copy-amount-icon").content.cloneNode(true));
  let feedbackTimer;
  // Copying must not open the amount keyboard or dismiss an existing keyboard.
  // Cancel mouse focus, not pointerdown: cancelling pointerdown suppresses the
  // subsequent tap/click on iOS WebKit.
  button.addEventListener("mousedown", (event) => event.preventDefault());
  button.addEventListener("click", async (event) => {
    event.stopPropagation();
    const cents = readCents();
    if (cents === null) return;
    try {
      const text = await copyAmount(cents);
      clearTimeout(feedbackTimer);
      button.classList.add("is-copied");
      button.setAttribute("aria-label", `已复制${label}`);
      notify(`已复制${label}：${text}`);
      feedbackTimer = setTimeout(() => {
        button.classList.remove("is-copied");
        button.setAttribute("aria-label", `复制${label}`);
      }, 2500);
    } catch {
      notify("无法复制，请长按金额手动复制");
    }
  });
  return { button, refresh() { button.disabled = readCents() === null; } };
}
