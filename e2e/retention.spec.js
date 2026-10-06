import { test, expect } from "@playwright/test";

async function setup(page) {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("notes-seeded")) {
      sessionStorage.setItem("notes-seeded", "yes");
      localStorage.setItem("no3-note-counter:counts:v1", JSON.stringify({
        "notes-100": "1", "notes-50": "2", "notes-20": "3", "notes-10": "4", "notes-5": "5",
      }));
      localStorage.setItem("no3-tools:active-tab:v1", "notes");
    }
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
      writeText: async (text) => { window.lastCopiedText = text; },
    } });
  });
  await page.goto("/");
}

test("retention starts at 5 and 10, updates the report and preserves an empty selection", async ({ page }) => {
  await setup(page);
  for (const value of [100, 50, 20]) await expect(page.locator(`#retain-${value}`)).not.toBeChecked();
  for (const value of [10, 5]) await expect(page.locator(`#retain-${value}`)).toBeChecked();
  await expect(page.locator("#notes-result")).toHaveText("325.00");
  await expect(page.locator("#notes-subtotal")).toHaveText("65.00");
  await expect(page.locator("#panel-notes .subtotal-formula")).toHaveText("$10 × 4 + $5 × 5");
  for (const [value, expected] of [[20, "125.00"], [50, "225.00"], [100, "325.00"]]) {
    await page.locator(`#retain-${value}`).check();
    await expect(page.locator("#notes-subtotal")).toHaveText(expected);
    await expect(page.locator("#notes-result")).toHaveText("325.00");
  }
  await page.locator("#coin-counter summary").tap();
  await expect(page.locator("#cash-report-text")).toContainText("Cash：$325（留$325）");
  await page.locator("#copy-cash-report").tap();
  await expect.poll(() => page.evaluate(() => window.lastCopiedText)).toContain("Cash：$325（留$325）");
  for (const value of [100, 50, 20, 10, 5]) await page.locator(`#retain-${value}`).uncheck();
  await expect(page.locator("#notes-subtotal")).toHaveText("0.00");
  await expect(page.locator("#panel-notes .subtotal-formula")).toHaveText("未选择留存面额");
  await expect(page.locator("#cash-report-text")).toContainText("Cash：$325（留$0）");
  await page.reload();
  await expect(page.locator(".retention-options input:checked")).toHaveCount(0);
  await expect(page.locator("#cash-report-text")).toContainText("Cash：$325（留$0）");
  await page.getByRole("tab", { name: "现金", exact: true }).tap();
  await expect(page.locator("#cash-drawer")).toHaveValue("325.00");
});

test("clearing note and coin counts keeps the saved retention preference", async ({ page }) => {
  await setup(page);
  await page.locator("#retain-20").check();
  await page.reload();
  await expect(page.locator("#retain-20")).toBeChecked();
  await expect(page.locator("#notes-subtotal")).toHaveText("125.00");
  await page.locator("#reset-button").tap();
  await expect(page.locator("#notes-result")).toHaveText("0.00");
  await expect(page.locator("#retain-20")).toBeChecked();
  await expect(page.locator("#retain-10")).toBeChecked();
  await expect(page.locator("#retain-5")).toBeChecked();
  await page.reload();
  await expect(page.locator("#retain-20")).toBeChecked();
  await expect(page.locator("#notes-20")).toHaveValue("");
  await page.locator("#notes-20").fill("3");
  await expect(page.locator("#notes-subtotal")).toHaveText("60.00");
});

test("retention checkboxes have large touch targets and do not trigger focus scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await setup(page);
  const group = page.locator(".retention-group");
  await group.scrollIntoViewIfNeeded();
  const top = await page.locator("#app-scroll").evaluate((el) => el.scrollTop);
  await page.locator("label.retention-choice").filter({ has: page.locator("#retain-20") }).tap();
  await expect(page.locator("#retain-20")).toBeChecked();
  await expect(page.locator(".calculator")).not.toHaveClass(/is-editing/);
  await page.waitForTimeout(350);
  expect(await page.locator("#app-scroll").evaluate((el) => el.scrollTop)).toBeCloseTo(top, 0);
  for (const label of await page.locator(".retention-choice").all()) {
    const box = await label.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
  }
  expect(await page.locator("#app-scroll").evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.locator("#retain-50").focus();
  await page.keyboard.press("Space");
  await expect(page.locator("#retain-50")).toBeChecked();
  await expect(page.locator(".calculator")).not.toHaveClass(/is-editing/);
});

test("retention storage failure is visible and does not stop calculations", async ({ page }) => {
  await page.addInitScript(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "no3-note-counter:retention:v1") throw new DOMException("Storage full", "QuotaExceededError");
      return set.call(this, key, value);
    };
  });
  await setup(page);
  await page.locator("#retain-20").check();
  await expect(page.locator("#notes-subtotal")).toHaveText("125.00");
  await expect(page.locator(".retention-save-status")).toContainText("无法保存");
  await page.locator("#notes-100").fill("2");
  await expect(page.locator("#notes-result")).toHaveText("425.00");
  await expect(page.locator("#panel-notes .storage-status")).toContainText("无法保存");
  await page.reload();
  await expect(page.locator("#notes-result")).toHaveText("425.00");
  await expect(page.locator("#retain-20")).not.toBeChecked();
  await expect(page.locator("#notes-subtotal")).toHaveText("65.00");
});
