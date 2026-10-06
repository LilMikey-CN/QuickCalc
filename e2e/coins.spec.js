import { test, expect } from "@playwright/test";

test.use({ timezoneId: "Australia/Melbourne" });

async function setup(page) {
  await page.clock.setFixedTime(new Date("2026-09-28T10:00:00+10:00"));
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
      writeText: async (text) => { window.lastCopiedText = text; },
    } });
  });
  await page.goto("/");
}

test("optional coins produce a copyable report using Card total and default note retention", async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("card-seeded")) return;
    sessionStorage.setItem("card-seeded", "yes");
    localStorage.setItem("no3-card-calculator:state:v3", JSON.stringify({
      version: 3, morning: "5000", current: "500", overcharged: "2", undercharged: "0.20",
      extras: { early: [{ id: 1, value: "50" }], late: [] }, nextExtraNumber: 2, adjustmentsOpen: true,
    }));
  });
  await setup(page);
  await expect(page.locator("#result")).toHaveText("5,551.80");
  await page.getByRole("tab", { name: "点钞", exact: true }).tap();
  await expect(page.locator("#cash-report-text")).toBeHidden();
  for (const [id, count] of [[100, "20"], [20, "10"], [10, "2"], [5, "1"]]) await page.locator(`#notes-${id}`).fill(count);
  // Finish editing before scrolling past the totals to the optional section.
  await page.locator("#notes-5").blur();
  await expect(page.locator(".calculator")).not.toHaveClass(/is-editing/);
  await page.locator("#coin-counter summary").tap();
  for (const [id, count] of [[200, "7"], [100, "0"], [50, "1"], [20, "28"], [10, "11"], [5, "4"]]) await page.locator(`#coins-${id}`).fill(count);
  const report = "日期：9.28\nCard：$5551.80\nCash：$2225（留$25）\nCoins：$21.4\n$2x 7  $1x 0  $0.5x 1\n$0.2x 28  $0.1x 11  $0.05x 4";
  await expect(page.locator("#coins-total")).toHaveText("21.40");
  await expect(page.locator("#cash-report-text")).toHaveText(report);
  await page.locator("#copy-cash-report").tap();
  await expect.poll(() => page.evaluate(() => window.lastCopiedText)).toBe(report);
  await page.locator("#coin-counter summary").tap();
  await expect(page.locator("#cash-report-text")).toBeHidden();
  await page.reload();
  await expect(page.locator("#cash-report-text")).toBeHidden();
  await page.locator("#coin-counter summary").tap();
  await expect(page.locator("#cash-report-text")).toHaveText(report);
  await page.reload();
  await expect(page.locator("#cash-report-text")).toBeVisible();
  await expect(page.locator("#coins-200")).toHaveValue("7");
  await page.getByRole("tab", { name: "现金", exact: true }).tap();
  await expect(page.locator("#cash-drawer")).toHaveValue("2225.00");
  await page.getByRole("tab", { name: "Card", exact: true }).tap();
  await page.locator("#current").fill("600");
  await page.getByRole("tab", { name: "点钞", exact: true }).tap();
  await expect(page.locator("#cash-report-text")).toContainText("Card：$5651.80");
  await page.setViewportSize({ width: 320, height: 740 });
  await page.locator("#copy-cash-report").scrollIntoViewIfNeeded();
  const box = await page.locator("#copy-cash-report").boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(await page.locator("#app-scroll").evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.locator("#reset-button").tap();
  await expect(page.locator("#cash-report-text")).toBeHidden();
  await expect(page.locator("#notes-result")).toHaveText("0.00");
  await page.reload();
  await page.locator("#coin-counter summary").tap();
  await expect(page.locator("#coins-200")).toHaveValue("");
  await expect(page.locator("#cash-report-text")).toContainText("Card：$5651.80\nCash：$0（留$0）\nCoins：$0");
});

test("invalid Card, note or coin values disable the report without contaminating note totals", async ({ page }) => {
  await setup(page);
  await page.locator("#morning").fill("0.001");
  await page.getByRole("tab", { name: "点钞", exact: true }).tap();
  await page.locator("#coin-counter summary").tap();
  await expect(page.locator("#copy-cash-report")).toBeDisabled();
  await expect(page.locator("#cash-report-text")).toContainText("Card 页");
  await page.getByRole("tab", { name: "Card", exact: true }).tap();
  await page.locator("#morning").fill("10.01");
  await page.getByRole("tab", { name: "点钞", exact: true }).tap();
  await page.locator("#notes-100").fill("-1");
  await expect(page.locator("#copy-cash-report")).toBeDisabled();
  await expect(page.locator("#cash-report-text")).toContainText("纸币张数");
  await page.locator("#notes-100").fill("1");
  for (const invalid of ["-1", "0.5", "1e2"]) {
    await page.locator("#coins-5").fill(invalid);
    await expect(page.locator("#coins-5")).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("#copy-cash-report")).toBeDisabled();
  }
  await expect(page.locator("#notes-result")).toHaveText("100.00");
  await page.reload();
  await expect(page.locator("#coins-5")).toHaveValue("1e2");
  await expect(page.locator("#copy-cash-report")).toBeDisabled();
  await page.locator("#coins-5").fill("1");
  await expect(page.locator("#copy-cash-report")).toBeEnabled();
  await expect(page.locator("#cash-report-text")).toContainText("Cash：$100（留$0）\nCoins：$0.05");
  await page.locator("#notes-5").press("Enter");
  await expect(page.locator("#coins-200")).toBeFocused();
});

test("saved paper counts survive the upgrade and coin storage failure remains visible", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("no3-note-counter:counts:v1", JSON.stringify({ "notes-100": "1", "notes-50": "2", "notes-20": "3", "notes-10": "4", "notes-5": "5" }));
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "no3-coin-counter:state:v1") throw new DOMException("Storage full", "QuotaExceededError");
      return set.call(this, key, value);
    };
  });
  await setup(page);
  await page.getByRole("tab", { name: "点钞", exact: true }).tap();
  await expect(page.locator("#notes-result")).toHaveText("325.00");
  await page.locator("#coin-counter summary").tap();
  await page.locator("#coins-200").fill("2");
  await page.locator("#notes-100").fill("2");
  await expect(page.locator("#panel-notes .storage-status")).toContainText("浏览器无法保存");
  await expect(page.locator("#cash-report-text")).toContainText("Cash：$425（留$65）\nCoins：$4");
  await page.locator("#copy-cash-report").tap();
  await expect.poll(() => page.evaluate(() => window.lastCopiedText)).toContain("Coins：$4");
});

test("report date advances at local midnight and copy uses the new day", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-09-28T23:59:50+10:00") });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
      writeText: async (text) => { window.lastCopiedText = text; },
    } });
  });
  await page.goto("/");
  await page.getByRole("tab", { name: "点钞", exact: true }).tap();
  await page.locator("#coin-counter summary").tap();
  await expect(page.locator("#cash-report-text")).toContainText("日期：9.28");
  await page.clock.fastForward(11000);
  await expect(page.locator("#cash-report-text")).toContainText("日期：9.29");
  await page.locator("#copy-cash-report").tap();
  await expect.poll(() => page.evaluate(() => window.lastCopiedText)).toContain("日期：9.29");
});
