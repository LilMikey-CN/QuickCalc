import { test, expect } from "@playwright/test";

async function mockClipboard(page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
      writeText: async (text) => { window.lastCopiedText = text; },
    } });
  });
}

for (const name of ["card", "cash"]) {
  test(`${name}: separate shift records, contiguous labels, totals, copies and restoration`, async ({ page }) => {
    await mockClipboard(page);
    await page.goto("/");
    if (name === "cash") {
      await page.getByRole("tab", { name: "点钞", exact: true }).tap();
      await page.locator("#notes-100").fill("4");
      await page.getByRole("tab", { name: "现金", exact: true }).tap();
    }
    await page.locator(name === "cash" ? "#cash-morning" : "#morning").fill("100.10");
    await page.locator(name === "cash" ? "#cash-current" : "#current").fill("200.20");
    for (const [i, value] of ["0.10", "0.20", "0.30"].entries()) {
      await page.locator(`#add-${name}-early-record`).tap();
      await page.locator(`#${name}-extra-${i + 1}`).fill(value);
    }
    for (const [i, value] of ["5.05", "6.06"].entries()) {
      await page.locator(`#add-${name}-late-record`).tap();
      await page.locator(`#${name}-extra-${i + 4}`).fill(value);
    }
    await page.getByRole("button", { name: "删除早班补充记录2", exact: true }).tap();
    await expect(page.locator(`#${name}-early .extra-record label`)).toHaveText(["早班补充记录1", "早班补充记录2"]);
    await expect(page.locator(`#${name}-late .extra-record label`)).toHaveText(["晚班补充记录1", "晚班补充记录2"]);
    await expect(page.getByRole("button", { name: "撤销", exact: true })).toHaveCount(0);
    await expect(page.locator(`#${name}-early-total`)).toHaveText("100.50");
    await expect(page.locator(`#${name}-late-total`)).toHaveText("211.31");
    for (const [shift, total] of [["early", "100.50"], ["late", "211.31"]]) {
      await page.locator(`#copy-${name}-${shift}-total`).tap();
      await expect.poll(() => page.evaluate(() => window.lastCopiedText)).toBe(total);
    }
    if (name === "cash") {
      await expect(page.locator("#cash-daily")).toHaveText("311.81");
      await expect(page.locator("#cash-result")).toHaveText("88.19");
      await page.locator("#copy-cash-current").tap();
      await expect.poll(() => page.evaluate(() => window.lastCopiedText)).toBe("200.20");
    } else await expect(page.locator("#result")).toHaveText("311.81");
    await page.locator(`#add-${name}-early-record`).tap();
    await page.locator(`#${name}-extra-6`).fill("0.04");
    await expect(page.locator(`#${name}-early .extra-record label`)).toHaveText(["早班补充记录1", "早班补充记录2", "早班补充记录3"]);
    await page.reload();
    await expect(page.locator(`#${name}-early-total`)).toHaveText("100.54");
    await expect(page.locator(`#${name}-late-total`)).toHaveText("211.31");
    await expect(page.locator(`#panel-${name}`)).not.toContainText("上午");
    await page.locator("#reset-button").tap();
    await expect(page.locator(`#panel-${name} .extra-record`)).toHaveCount(0);
    await expect(page.locator(`#${name}-early-total`)).toHaveText("0.00");
    await expect(page.locator(`#${name}-late-total`)).toHaveText("0.00");
    if (name === "cash") await expect(page.locator("#cash-drawer")).toHaveValue("400.00");
  });
}

test("cash adjustments copy multiline descriptions and keep their signs when collapsed", async ({ page }) => {
  await mockClipboard(page);
  await page.goto("/");
  await page.getByRole("tab", { name: "现金", exact: true }).tap();
  await page.locator("#cash-adjustments summary").tap();
  await expect(page.locator("#cash-extra-change")).toHaveCount(0);
  await expect(page.locator("#copy-cash-adjustments")).toBeDisabled();
  await page.locator("#cash-bank-transfer").fill("10");
  await page.locator("#cash-rmb-payment").fill("2.50");
  await page.locator("#cash-card-payment").fill("3.03");
  const expected = "银行转账多收客人$10, 现金少$10\n人民币支付多收客人$2.50, 现金少$2.50\nCard支付多收客人$3.03, 现金少$3.03";
  await page.locator("#copy-cash-adjustments").tap();
  await expect.poll(() => page.evaluate(() => window.lastCopiedText)).toBe(expected);
  await expect(page.locator(".adjustment-preview:visible")).toHaveText(expected);
  await expect(page.locator("#cash-result")).toHaveText("15.53");
  await page.locator("#cash-adjustments summary").tap();
  await expect(page.locator("#cash-result")).toHaveText("15.53");
  await page.reload();
  await expect(page.locator("#cash-adjustments")).toHaveAttribute("open", "");
  await page.locator("#cash-bank-transfer").fill("0.001");
  await expect(page.locator("#copy-cash-adjustments")).toBeDisabled();
  await expect(page.locator("#cash-result")).toHaveText("—");
});

test("saved v2 amounts migrate into early shift and old unclassified change remains reviewable", async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "yes");
    localStorage.setItem("no3-cash-calculator:state:v2", JSON.stringify({
      version: 2, "cash-morning": "100", "cash-current": "200", "cash-retained": "10", "cash-delivery": "3", "cash-extra-change": "5.50", "cash-expenses": "2",
      extras: [{ id: 4, value: "25" }, { id: 7, value: "5" }], nextExtraNumber: 8, adjustmentsOpen: false,
    }));
    localStorage.setItem("no3-tools:active-tab:v1", "cash");
  });
  await page.goto("/");
  await expect(page.locator("#cash-early-total")).toHaveText("130.00");
  await expect(page.locator("#cash-late-total")).toHaveText("200.00");
  await expect(page.locator("#cash-early .extra-record label")).toHaveText(["早班补充记录1", "早班补充记录2"]);
  await expect(page.locator("#cash-legacy-change")).toHaveText("5.50");
  await expect(page.locator("#cash-result")).toHaveText("−329.50");
  await page.locator("#cash-bank-transfer").fill("5.50");
  await page.getByRole("button", { name: "已分类，移除此项", exact: true }).tap();
  await expect(page.locator(".legacy-adjustment")).toBeHidden();
  await expect(page.locator("#cash-result")).toHaveText("−329.50");
  await page.reload();
  await expect(page.locator(".legacy-adjustment")).toBeHidden();
  await expect(page.locator("#cash-bank-transfer")).toHaveValue("5.50");
  expect(await page.evaluate(() => localStorage.getItem("no3-cash-calculator:state:v2"))).toBeNull();
});

test("focus scroll animates through intermediate positions and respects reduced motion", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 420 });
  await page.goto("/");
  await page.getByRole("tab", { name: "现金", exact: true }).tap();
  const samples = await page.evaluate(async () => {
    const scroller = document.querySelector("#app-scroll");
    scroller.scrollTop = 0;
    document.querySelector("#cash-retained").focus({ preventScroll: true });
    const values = [];
    const start = performance.now();
    while (performance.now() - start < 1400) {
      await new Promise(requestAnimationFrame);
      values.push(scroller.scrollTop);
    }
    return values;
  });
  const end = samples.at(-1);
  expect(end).toBeGreaterThan(100);
  expect(new Set(samples.filter((value) => value > 5 && value < end - 5).map(Math.round)).size).toBeGreaterThan(5);
  expect(Math.max(...samples)).toBeLessThanOrEqual(end + 2);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator("#cash-morning").focus();
  await page.evaluate(() => document.activeElement.blur());
  const reduced = await page.evaluate(async () => {
    const scroller = document.querySelector("#app-scroll");
    scroller.scrollTop = 0;
    document.querySelector("#cash-retained").focus({ preventScroll: true });
    const values = [];
    const start = performance.now();
    while (performance.now() - start < 600) {
      await new Promise(requestAnimationFrame);
      values.push(Math.round(scroller.scrollTop));
    }
    return values;
  });
  expect(new Set(reduced).size).toBeLessThanOrEqual(2);
  expect(reduced.at(-1)).toBeGreaterThan(100);
});
