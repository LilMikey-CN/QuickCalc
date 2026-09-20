import { test, expect } from "@playwright/test";

test("tapping the same focused field recenters it after manual scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 420 });
  await page.goto("/");
  await page.getByRole("tab", { name: "现金", exact: true }).tap();
  const input = page.locator("#cash-retained");
  const row = page.locator("#cash-retained-field");
  await input.tap();
  await expect.poll(async () => (await row.boundingBox()).y).toBeGreaterThan(160);
  await expect.poll(async () => (await row.boundingBox()).y).toBeLessThan(220);
  await page.evaluate(() => {
    const scroller = document.querySelector("#app-scroll");
    scroller.dispatchEvent(new Event("touchmove"));
    scroller.scrollTop += 90;
  });
  await input.tap();
  await expect(input).toBeFocused();
  await expect.poll(async () => (await row.boundingBox()).y).toBeGreaterThan(160);
  await expect.poll(async () => (await row.boundingBox()).y).toBeLessThan(220);
});

test("keyboard resizing and Safari viewport panning keep the active field visible", async ({ page }) => {
  await page.addInitScript(() => {
    const viewport = new EventTarget();
    Object.assign(viewport, { height: 844, width: 390, offsetTop: 0, offsetLeft: 0, scale: 1 });
    Object.defineProperty(window, "visualViewport", { value: viewport });
    window.setKeyboardViewport = (height, offsetTop) => {
      Object.assign(viewport, { height, offsetTop });
      viewport.dispatchEvent(new Event("resize"));
      viewport.dispatchEvent(new Event("scroll"));
    };
  });
  await page.goto("/");
  await page.getByRole("tab", { name: "现金", exact: true }).tap();
  await page.locator("#cash-adjustments summary").tap();
  await page.locator("#cash-expenses").tap();
  await page.evaluate(() => window.setKeyboardViewport(420, 60));
  const row = page.locator("#cash-expenses-field");
  await expect.poll(async () => (await row.boundingBox()).y).toBeGreaterThan(225);
  await expect.poll(async () => (await row.boundingBox()).y).toBeLessThan(275);
  const bounds = await page.locator("#app-scroll").boundingBox();
  expect(bounds.y).toBe(60);
  expect(bounds.height).toBe(420);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  // Ordinary scrolling stays under user control; a later keyboard resize must
  // still reposition the input instead of permanently cancelling the feature.
  await page.locator("#app-scroll").evaluate((scroller) => {
    scroller.dispatchEvent(new Event("touchmove"));
    scroller.scrollTop += 50;
  });
  const manualTop = (await row.boundingBox()).y;
  await page.waitForTimeout(300);
  expect((await row.boundingBox()).y).toBeCloseTo(manualTop, 0);
  await page.evaluate(() => window.setKeyboardViewport(360, 60));
  await expect.poll(async () => (await row.boundingBox()).y).toBeGreaterThan(200);
  await expect.poll(async () => (await row.boundingBox()).y).toBeLessThan(230);
});

test("new records, deletion and tab changes position focus in the scroll area", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 420 });
  await page.goto("/");
  await page.locator("#add-card-early-record").tap();
  const extra = page.locator("#card-extra-1");
  await expect(extra).toBeFocused();
  await extra.fill("25.05");
  await page.getByRole("button", { name: "删除早班补充记录1", exact: true }).tap();
  await expect(extra).toHaveCount(0);
  await expect(page.getByRole("button", { name: "撤销", exact: true })).toHaveCount(0);
  await page.locator("#add-card-late-record").tap();
  await expect(page.locator("#card-extra-2")).toBeFocused();
  await expect.poll(async () => (await page.locator("#card-extra-2-field").boundingBox()).y).toBeLessThan(220);
  await page.getByRole("tab", { name: "点钞", exact: true }).tap();
  await expect(page.locator("#card-extra-2")).not.toBeFocused();
  await expect(page.locator(".calculator")).not.toHaveClass(/is-editing/);
  await page.locator("#notes-5").tap();
  await expect.poll(async () => (await page.locator("#notes-5-field").boundingBox()).y).toBeGreaterThan(160);
  await expect.poll(async () => (await page.locator("#notes-5-field").boundingBox()).y).toBeLessThan(220);
});

async function prepareCash(page) {
  await page.addInitScript(() => {
    localStorage.setItem("no3-note-counter:counts:v1", JSON.stringify({
      "notes-100": "123", "notes-50": "0", "notes-20": "0", "notes-10": "0", "notes-5": "0",
    }));
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
      writeText: async (text) => { window.lastCopiedText = text; },
    } });
  });
  await page.goto("/");
  await page.getByRole("tab", { name: "现金", exact: true }).tap();
  await page.locator("#cash-morning").fill("1000.10");
  await page.locator("#cash-current").fill("200.20");
  await page.locator("#add-cash-early-record").tap();
  await page.locator("#cash-extra-1").fill("25.03");
}

test("cash copy icons copy current ungrouped amounts and do not change input focus", async ({ page }) => {
  await prepareCash(page);
  await expect(page.locator("#cash-drawer")).toHaveValue("12300.00");
  await expect(page.locator("#cash-daily")).toHaveText("1,225.33");
  for (const [id, expected] of [["cash-drawer", "12300.00"], ["cash-morning", "1000.10"], ["cash-daily", "1225.33"]]) {
    await page.locator(`#copy-${id}`).tap();
    await expect.poll(() => page.evaluate(() => window.lastCopiedText)).toBe(expected);
    await expect(page.locator("#copy-status")).toContainText(expected);
    await expect(page.locator("#cash-extra-1")).toBeFocused();
  }
  await page.locator("#cash-extra-1").fill("0.20");
  await page.locator("#copy-cash-daily").tap();
  await expect.poll(() => page.evaluate(() => window.lastCopiedText)).toBe("1200.50");
  await page.reload();
  await expect(page.locator("#cash-extra-1")).toHaveValue("0.20");
  await expect(page.locator("#cash-daily")).toHaveText("1,200.50");
});

test("copy buttons reject invalid values independently and fit a narrow phone", async ({ page }) => {
  await prepareCash(page);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.locator("#cash-morning").fill("0.001");
  await expect(page.locator("#copy-cash-morning")).toBeDisabled();
  await expect(page.locator("#copy-cash-daily")).toBeDisabled();
  await expect(page.locator("#copy-cash-drawer")).toBeEnabled();
  await page.locator("#cash-morning").fill("");
  await page.locator("#copy-cash-morning").tap();
  await expect.poll(() => page.evaluate(() => window.lastCopiedText)).toBe("0.00");
  await page.getByRole("tab", { name: "点钞", exact: true }).tap();
  await page.locator("#notes-100").fill("1.5");
  await page.getByRole("tab", { name: "现金", exact: true }).tap();
  await expect(page.locator("#copy-cash-drawer")).toBeDisabled();
  await expect(page.locator("#copy-cash-daily")).toBeEnabled();
  for (const id of ["cash-drawer", "cash-morning", "cash-daily"]) {
    const box = await page.locator(`#copy-${id}`).boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  expect(await page.locator("#app-scroll").evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
});

test("clipboard fallback and failure give accurate feedback", async ({ page }) => {
  await prepareCash(page);
  await page.evaluate(() => {
    navigator.clipboard.writeText = async () => { throw new Error("Unavailable"); };
    document.execCommand = () => { window.lastCopiedText = getSelection().toString(); return true; };
  });
  await page.locator("#copy-cash-morning").tap();
  await expect.poll(() => page.evaluate(() => window.lastCopiedText)).toBe("1000.10");
  await expect(page.locator("#copy-status")).toContainText("已复制");
  await page.evaluate(() => { document.execCommand = () => false; });
  await page.locator("#copy-cash-daily").tap();
  await expect(page.locator("#copy-status")).toHaveText("无法复制，请长按金额手动复制");
});

test("real browser clipboard accepts the amount for pasting", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium", "Playwright clipboard permissions are available in Chromium.");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page.getByRole("tab", { name: "现金", exact: true }).tap();
  await page.locator("#cash-morning").fill("1234.56");
  await page.locator("#copy-cash-morning").tap();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe("1234.56");
  await page.locator("#cash-current").focus();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+V" : "Control+V");
  await expect(page.locator("#cash-current")).toHaveValue("1234.56");
});
