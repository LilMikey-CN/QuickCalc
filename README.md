# NO.3 结算工具

A small mobile-first calculator with three tabs:

- **Card:** Starts with 上午 and 当前. Use **＋ 添加补充记录** to insert extra amounts between them. Every extra row is added to the total. **客人金额调整** optionally reveals 多收客人 (+) and 少收客人 (−).
- **现金:** 当前钱箱余额 − 上午系统现金 − 补充记录合计 − 当前系统现金 − 昨日留存 + 配送现金 + 多找客人现金 + 其他支出 = 现金差额. Add supplementary system cash records below 上午系统现金. 全天系统现金 includes 上午系统现金, all supplementary records, and 当前系统现金. **现金支出调整** optionally reveals 配送现金, 多找客人现金, and 其他支出. Positive differences mean the drawer has extra cash; negative differences mean it is short.
- **点钞:** Enter the number of Australian $100, $50, $20, $10, and $5 notes. See the total value in AUD and a separate subtotal for the $20/$10/$5 notes using the same counts. Counts must be non-negative whole numbers; decimals, negatives, and exponent notation are rejected. Integer arithmetic keeps even very large note counts exact.

- **当前钱箱余额** is read-only and automatically follows **纸币总额** from 点钞. Change note counts to update it; the cash difference recalculates immediately. Invalid note counts withhold the linked balance and cash result until corrected.
- Editable card and cash inputs accept 0–20,000 with up to two decimal places. The linked drawer balance supports the full note total, including totals above 20,000. Empty inputs in every tab count as zero.
- Results update immediately. Invalid input displays an inline error and hides the total until corrected.
- Decimal text is converted into integer cents before calculation, avoiding floating-point rounding artifacts. Results always show two decimal places and can be negative or greater than 20,000.
- Large inputs, decimal keyboard hints, select-on-focus, clear-all, and copy-result controls make phone use quick.
- Each tab's inputs save separately to this browser's `localStorage` after each edit and restore when the site reopens. The last selected tab is remembered. Results are recalculated from the restored inputs; values are never sent to a server.
- No framework, external fonts, runtime dependencies, or third-party requests. The deployment build only copies the site's assets into `dist/`.

## Supplementary records and adjustments

Both Card and 现金 support rows automatically named 补充记录1, 补充记录2, and so on, with independent numbering. Adding a row focuses its amount field. Each extra row has a **删除** button; **撤销** restores the most recently deleted row, its amount, and its original position. Undo remains available until the next add/delete/clear action or reload. Record numbers stay stable after deletion and restart at 1 after clearing that tab.

Rows, order, raw input text, and adjustments save automatically. Existing saved Card and cash values migrate to the new format. Saved nonzero or invalid adjustments automatically open their section on restore; collapsing that section keeps entered adjustments included, with a visible status beside the heading.

**清空** removes that tab's extra rows and editable amounts and closes its adjustment section. Card returns to the two-field starting layout. Cash retains the read-only drawer balance from 点钞. The empty saved state prevents legacy values from returning after a reset.

## Mobile focus scrolling

Across all three tabs, focusing an editable field centers the whole field in the visible space above the mobile keyboard and below the tabs. The page responds to visual viewport resizing and panning during keyboard animation, with a window-height fallback for older browsers. Temporary bottom space lets the last input scroll into position. Manual scrolling takes priority, pinch zoom is respected, and the extra space is removed after leaving the inputs.

## Local preview

From this directory, run:

```sh
python3 -m http.server 8080
```

Open `http://localhost:8080`. Use an HTTP server instead of opening `index.html` directly because the scripts use JavaScript modules. Copying uses the Clipboard API on HTTPS or localhost; if it is unavailable, the page suggests manually copying the displayed result.

## Remembering amounts

Saving is automatic, including unfinished input. Reopening the same website in the same browser restores the last saved inputs and applies the normal validation and exact-cent calculation. **清空** clears the active tab's editable inputs and their saved values. Clearing 现金 preserves the balance linked from 点钞; clearing 点钞 resets that balance to zero and recalculates 现金 without clearing its other amounts. Manually emptying every input in 点钞 removes its saved values; Card and 现金 preserve their row structure until **清空** is used. Existing saved Card amounts and the six editable cash amounts are preserved from earlier versions. Previously entered manual drawer balances are ignored; the balance is always recalculated from saved note counts. Unrelated browser storage is untouched.

Saved amounts are specific to the browser, device, and website origin (protocol, hostname, and port). They do not sync between devices or browsers, and a different Vercel preview URL has separate storage. Clearing website data removes them; private browsing generally removes them when the private session ends. Browser storage is not a permanent backup.

If storage is blocked or full, the calculator still works and displays a notice that amounts cannot be saved. Damaged or incompatible saved data is ignored.

## Tests

With Node.js 24:

```sh
npm test
```

No dependency installation is required. Tests cover decimal parsing, supplementary Card and cash records, saved-state migration, cash differences, note-count validation, denomination totals, small-note subtotals, exact arithmetic with very large counts, and focus positioning with keyboard viewport offsets.

## Vercel deployment

Import this repository as a Vercel project and keep the **Root Directory** at the repository root. The included `vercel.json` configures:

| Setting | Value |
| --- | --- |
| Framework Preset | Other (no framework) |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | Skipped (no dependencies) |
| Node.js Version | `24.x`, set in `package.json` |

No environment variables or backend services are required. Vercel serves the site over HTTPS, which supports the copy-result button. Only the site assets in `dist/` are published; tests and project configuration stay outside the public output.

To verify the production output locally:

```sh
npm run build
python3 -m http.server 8080 --directory dist
```

Open `http://localhost:8080`. Stop any existing server on that port first, or use another port.

Generated `dist/`, local `.vercel/` configuration, and `node_modules/` are ignored by Git. Git operations, connecting the repository to Vercel, and deploying are left to you.
