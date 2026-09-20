/** Center a field in the visible space between the tabs and the keyboard. */
export function fieldScrollDelta(field, viewport, tabHeight) {
  const top = viewport.offsetTop + tabHeight + 12;
  const bottom = viewport.offsetTop + viewport.height - 20;
  const targetTop = top + Math.max(0, (bottom - top - field.height) / 2);
  return field.top - targetTop;
}

export function installFocusScroll(root) {
  const viewport = window.visualViewport;
  const tabs = root.querySelector(".tabs");
  let timer;
  let followups = [];
  let settlingUntil = 0;
  let userScrolling = false;

  const isMobile = () => matchMedia("(any-pointer: coarse), (max-width: 600px)").matches;
  function focusedInput() {
    const input = document.activeElement;
    return input?.matches("input:not([readonly]):not([disabled])") && root.contains(input)
      && !input.closest("[hidden], details:not([open])") ? input : null;
  }

  function cancel() {
    clearTimeout(timer);
    followups.forEach(clearTimeout);
    followups = [];
    settlingUntil = 0;
  }

  function align() {
    const input = focusedInput();
    if (!input || !isMobile() || userScrolling || (viewport && Math.abs(viewport.scale - 1) > 0.01)) return;
    const visible = { offsetTop: viewport?.offsetTop ?? 0, height: viewport?.height ?? window.innerHeight };
    // Let even the last field reach the target without clamping at the page bottom.
    root.style.setProperty("--focus-scroll-space", `${Math.ceil(visible.height / 2)}px`);
    const field = input.closest(".field") || input;
    const delta = fieldScrollDelta(field.getBoundingClientRect(), visible, tabs?.getBoundingClientRect().height ?? 0);
    if (Math.abs(delta) > 2) window.scrollBy({ top: delta, behavior: "auto" });
  }

  function schedule(delay = 80) {
    clearTimeout(timer);
    timer = setTimeout(align, delay);
  }

  root.addEventListener("focusin", () => {
    cancel();
    userScrolling = false;
    if (!focusedInput() || !isMobile()) return;
    settlingUntil = performance.now() + 900;
    schedule(0);
    // Safari pans its visual viewport as the keyboard animates. Recheck after
    // focus as well as on viewport events, including browsers without that API.
    followups = [350, 700].map((delay) => setTimeout(align, delay));
  });

  root.addEventListener("focusout", () => {
    requestAnimationFrame(() => {
      if (focusedInput()) return;
      cancel();
      root.style.removeProperty("--focus-scroll-space");
    });
  });

  function resized() {
    if (!focusedInput() || userScrolling) return;
    settlingUntil = performance.now() + 900;
    schedule();
  }
  viewport?.addEventListener("resize", resized);
  window.addEventListener("resize", resized);
  viewport?.addEventListener("scroll", () => {
    if (performance.now() < settlingUntil && !userScrolling) schedule();
  });

  // After positioning, users can scroll freely without being pulled back.
  window.addEventListener("pointerdown", cancel, { passive: true });
  function manualScroll() {
    userScrolling = true;
    cancel();
  }
  window.addEventListener("touchmove", manualScroll, { passive: true });
  window.addEventListener("wheel", manualScroll, { passive: true });
  window.addEventListener("pagehide", () => {
    cancel();
    root.style.removeProperty("--focus-scroll-space");
  });
}
