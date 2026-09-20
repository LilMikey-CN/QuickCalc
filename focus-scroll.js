import scrollIntoView from "scroll-into-view-if-needed";

export function installFocusScroll(root) {
  const scroller = document.querySelector("#app-scroll");
  const viewport = window.visualViewport;
  let timer;
  let height;

  function activeInput() {
    const input = document.activeElement;
    return input?.matches("input:not([readonly]):not([disabled])") && root.contains(input)
      && !input.closest("[hidden], details:not([open])") ? input : null;
  }

  function positionInput() {
    const input = activeInput();
    if (!input || (viewport && Math.abs(viewport.scale - 1) > 0.01)) return;
    // The library scrolls only our viewport-sized container. Safari owns window
    // panning during keyboard animation; scrolling that window fights the OS.
    scrollIntoView(input.closest(".field") || input, {
      boundary: scroller, block: "center", inline: "nearest", behavior: "auto",
    });
  }

  function requestPosition() {
    clearTimeout(timer);
    const editing = Boolean(activeInput());
    root.classList.toggle("is-editing", editing);
    if (editing) timer = setTimeout(positionInput, 120);
  }

  function syncViewport() {
    // Leave pinch zoom and its panning to the browser.
    if (viewport && Math.abs(viewport.scale - 1) > 0.01) return;
    const nextHeight = viewport?.height ?? window.innerHeight;
    document.documentElement.style.setProperty("--viewport-top", `${viewport?.offsetTop ?? 0}px`);
    document.documentElement.style.setProperty("--viewport-height", `${nextHeight}px`);
    if (height !== nextHeight) {
      height = nextHeight;
      requestPosition();
    }
  }

  root.addEventListener("focusin", requestPosition);
  root.addEventListener("focusout", () => requestAnimationFrame(requestPosition));
  root.addEventListener("click", (event) => {
    if (event.target.closest("button, summary")) return;
    const input = event.target.closest(".field")?.querySelector("input");
    // A second tap does not emit focusin, but must still reposition the field.
    if (input && input === activeInput()) requestPosition();
  });
  root.addEventListener("pointerdown", () => clearTimeout(timer), { passive: true });
  scroller.addEventListener("touchmove", () => clearTimeout(timer), { passive: true });
  scroller.addEventListener("wheel", () => clearTimeout(timer), { passive: true });
  viewport?.addEventListener("resize", syncViewport);
  viewport?.addEventListener("scroll", syncViewport);
  window.addEventListener("resize", syncViewport);
  window.addEventListener("pageshow", syncViewport);
  window.addEventListener("pagehide", () => clearTimeout(timer));
  syncViewport();
}
