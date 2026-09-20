# NO.3 结算工具

A small mobile-first calculator with three tabs:

- **Card:** Starts with 早班 and 晚班, each with its own **添加补充记录** button and copyable subtotal. The result is 早班合计 + 晚班合计 + 多收客人 − 少收客人. **客人金额调整** optionally reveals the two customer adjustments.
- **点钞:** Enter the number of Australian $100, $50, $20, $10, and $5 notes. See the total value in AUD and a separate subtotal for the $20/$10/$5 notes using the same counts. Counts must be non-negative whole numbers; decimals, negatives, and exponent notation are rejected. Integer arithmetic keeps even very large note counts exact.
- **现金:** 钱箱余额 − 系统现金总和 − 昨日留存 − 现金支出调整 = 现金差额. Both 早班系统现金 and 晚班系统现金 support supplementary records and copyable subtotals. 系统现金总和 includes both shifts and all their supplementary records. **现金支出调整** optionally reveals 配送现金, 银行转账多找客人, 人民币支付多找客人, Card 支付多找客人, and 其他支出. Positive differences mean the drawer has extra cash; negative differences mean it is short.

- **钱箱余额** is read-only and automatically follows **纸币总额** from 点钞. Change note counts to update it; the cash difference recalculates immediately. Invalid note counts withhold the linked balance and cash result until corrected.
- Editable card and cash inputs accept 0–20,000 with up to two decimal places. The linked drawer balance supports the full note total, including totals above 20,000. Empty inputs in every tab count as zero.
- Results update immediately. Invalid input displays an inline error and hides the total until corrected.
- Decimal text is converted into integer cents before calculation, avoiding floating-point rounding artifacts. Results always show two decimal places and can be negative or greater than 20,000.
- Large inputs, decimal keyboard hints, select-on-focus, clear-all, and copy-result controls make phone use quick.
- Each tab's inputs save separately to this browser's `localStorage` after each edit and restore when the site reopens. The last selected tab is remembered. Results are recalculated from the restored inputs; values are never sent to a server.
- Vite bundles the site and its scrolling, animation, and clipboard libraries into `dist/`. No external fonts or third-party requests are required at runtime.

## Supplementary records and adjustments

Both Card and 现金 support separate early- and late-shift rows named 早班补充记录1, 晚班补充记录1, and so on. Each shift's visible numbering starts at 1 and remains consecutive after deletion. Adding a row focuses its amount field. Each extra row has a **删除** button; deletion takes effect immediately, with no undo. Each shift subtotal includes its base amount and all its supplementary records.

Rows, order, raw input text, and adjustments save automatically. Existing saved Card and cash values migrate to the new format. Saved nonzero or invalid adjustments automatically open their section on restore; collapsing that section keeps entered adjustments included, with a visible status beside the heading.

Cash adjustment amounts are entered in AUD, including the cash refunded for RMB overpayments; the app does not convert currencies. All five categories, plus any migrated unclassified change, are subtracted from the cash difference. **复制全部调整记录** copies only nonzero adjustments, one per line, ready to paste into a message:

```text
银行转账多收客人$10, 现金少$10
人民币支付多收客人$2.50, 现金少$2.50
Card支付多收客人$3.03, 现金少$3.03
```

配送现金 and 其他支出 use the same format with their respective names. An on-screen preview shows the text to be copied. Invalid adjustment amounts disable bulk copying until corrected.

**清空** removes that tab's extra rows and editable amounts and closes its adjustment section. Card returns to the two-field starting layout. Cash retains the read-only drawer balance from 点钞. The empty saved state prevents legacy values from returning after a reset.

## Mobile focus scrolling

Across all three tabs, [scroll-into-view-if-needed](https://github.com/scroll-into-view/scroll-into-view-if-needed) centers the focused field within a dedicated scroll area sized to the visible viewport. The browser keeps control of window panning while the keyboard opens; the app scrolls only its inner content. Keyboard resizing updates this area, including Safari's viewport offset, with a window-height fallback for older browsers. Tapping the same focused field recenters it after manual scrolling. Extra space lets the last field reach the center. Pinch zoom is respected.

[Motion](https://motion.dev/) animates scrolling with a damped spring and preserves velocity when the destination changes. Touch gestures, pointer presses, and mouse-wheel scrolling interrupt the animation. The system's reduced-motion preference skips the animation and moves directly to the field.

## Copying individual amounts

Both Card and 现金 have copy icons beside **早班合计** and **晚班合计**. The 现金 page also has copy icons beside **钱箱余额**, **早班系统现金**, **晚班系统现金**, and **系统现金总和**. They copy the current value with two decimal places and no currency symbol or grouping commas, ready to paste into another field or app. Blank amounts copy as `0.00`; invalid amounts disable the affected copy button. A checkmark and a message confirm success.

Copying uses [clipboard-copy](https://github.com/feross/clipboard-copy), which uses the Clipboard API on HTTPS/localhost and an older-browser fallback. Failed copying shows a manual-copy message. Touching an icon does not focus the amount input or open its keyboard.

## Local preview

From this directory, run:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`). For a phone preview, use the network URL Vite prints. Deploy over HTTPS for full Clipboard API support. Source files require Vite because they import npm packages; do not open `index.html` directly.

## Remembering amounts

Saving is automatic, including unfinished input. Reopening the same website in the same browser restores the last saved inputs and applies the normal validation and exact-cent calculation. **清空** clears the active tab's editable inputs and their saved values. Clearing 现金 preserves the balance linked from 点钞; clearing 点钞 resets that balance to zero and recalculates 现金 without clearing its other amounts. Manually emptying every input in 点钞 removes its saved values; Card and 现金 preserve their row structure until **清空** is used. Previously entered manual drawer balances are ignored; the balance is always recalculated from saved note counts. Unrelated browser storage is untouched.

Version 3 storage preserves amounts from versions 1 and 2. Old 上午 and 当前 values become 早班 and 晚班; existing supplementary records belong to 早班. An old 多找客人现金 amount appears as **旧版未分类找零** and continues to count in the cash difference. Enter it under the appropriate new payment category, then select **已分类，移除此项** to remove the old amount without counting it twice. Old storage keys are removed only after the migrated state has saved successfully.

Saved amounts are specific to the browser, device, and website origin (protocol, hostname, and port). They do not sync between devices or browsers, and a different Vercel preview URL has separate storage. Clearing website data removes them; private browsing generally removes them when the private session ends. Browser storage is not a permanent backup.

If storage is blocked or full, the calculator still works and displays a notice that amounts cannot be saved. Damaged or incompatible saved data is ignored.

## Tests

With Node.js 24:

```sh
npm test
```

Run `npm ci` first. Unit tests cover exact arithmetic, supplementary records, saved-state migration, and note counting. Browser regression tests run in WebKit with iPhone settings and Chromium with mobile settings:

```sh
npx playwright install chromium webkit
npm run build
npm run test:browser
```

The browser tests cover separate shift records, consecutive numbering after deletion, copyable subtotals, multiline adjustment copying, saved-state migration, repeated taps after scrolling, spring animation and reduced motion, keyboard viewport resizing/panning, extra-row focus, clipboard values and fallback, validation, and narrow-screen controls. Chromium also tests copying and pasting through the real browser clipboard. Simulated keyboard geometry does not replace testing Safari with a physical iPhone keyboard.

## Vercel deployment

Import this repository as a Vercel project and keep the **Root Directory** at the repository root. The included `vercel.json` configures:

| Setting | Value |
| --- | --- |
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm ci` |
| Node.js Version | `24.x`, set in `package.json` |

No environment variables or backend services are required. Include `package-lock.json` so Vercel installs the tested dependencies. Vercel serves the site over HTTPS. Only bundled site assets in `dist/` are published; tests and project configuration stay outside the public output.

To verify the production output locally:

```sh
npm run build
npm run preview
```

Open the preview URL Vite prints (normally `http://localhost:4173`).

Generated `dist/`, local `.vercel/` configuration, and `node_modules/` are ignored by Git. Git operations, connecting the repository to Vercel, and deploying are left to you.
