import scrollIntoView from "scroll-into-view-if-needed";
import { animate, motionValue } from "motion";

export function installFocusScroll(root) {
  const scroller = document.querySelector("#app-scroll");
  const viewport = window.visualViewport;
  let timer;
  let height;
  const scrollPosition = motionValue(scroller.scrollTop);
  scrollPosition.on("change", (value) => { scroller.scrollTop = value; });
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

  function stopScrolling() {
    clearTimeout(timer);
    scrollPosition.stop();
  }

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
      boundary: scroller, block: "center", inline: "nearest",
      behavior: (actions) => {
        const target = actions.find((action) => action.el === scroller);
        if (!target) return;
        if (reducedMotion.matches) {
          scrollPosition.jump(target.top);
          // jump may not emit when its value already matches the destination,
          // even though native/user scrolling has moved the actual container.
          scroller.scrollTop = target.top;
          return;
        }
        // Reuse Motion's velocity when a new focus target interrupts the spring.
        // Native/user scrolling may have moved the container independently.
        if (Math.abs(scrollPosition.get() - scroller.scrollTop) > 2) scrollPosition.jump(scroller.scrollTop);
        animate(scrollPosition, target.top, {
          type: "spring", stiffness: 260, damping: 34, mass: 1,
          restDelta: 0.5, restSpeed: 5,
        });
      },
    });
  }

  function requestPosition() {
    clearTimeout(timer);
    const editing = Boolean(activeInput());
    root.classList.toggle("is-editing", editing);
    if (editing) timer = setTimeout(positionInput, 120);
    else stopScrolling();
  }

  function syncViewport() {
    // Leave pinch zoom and its panning to the browser.
    if (viewport && Math.abs(viewport.scale - 1) > 0.01) { stopScrolling(); return; }
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
  root.addEventListener("pointerdown", stopScrolling, { passive: true });
  scroller.addEventListener("touchmove", stopScrolling, { passive: true });
  scroller.addEventListener("wheel", stopScrolling, { passive: true });
  viewport?.addEventListener("resize", syncViewport);
  viewport?.addEventListener("scroll", syncViewport);
  window.addEventListener("resize", syncViewport);
  window.addEventListener("pageshow", syncViewport);
  window.addEventListener("pagehide", stopScrolling);
  reducedMotion.addEventListener("change", requestPosition);
  syncViewport();
}
