# NO.3 结算工具

A small mobile-first calculator with three tabs:

- **Card:** 上午 + 当前 + 多收客人 − 少收客人.
- **现金:** 上午系统现金 + 当前系统现金 − 配送现金 − 昨日留存 − 多找客人现金 − 其他支出 − 当前钱箱余额. The result shows the signed difference (expected cash minus the drawer balance), with the expected balance and drawer balance shown separately. Positive means the drawer is short; negative means it has extra cash.
- **点钞:** Enter the number of Australian $100, $50, $20, $10, and $5 notes. See the total value in AUD and a separate subtotal for the $20/$10/$5 notes using the same counts. Counts must be non-negative whole numbers; decimals, negatives, and exponent notation are rejected. Integer arithmetic keeps even very large note counts exact.

- Card and cash inputs accept 0–20,000 with up to two decimal places. Empty inputs in every tab count as zero.
- Results update immediately. Invalid input displays an inline error and hides the total until corrected.
- Decimal text is converted into integer cents before calculation, avoiding floating-point rounding artifacts. Results always show two decimal places and can be negative or greater than 20,000.
- Large inputs, decimal keyboard hints, select-on-focus, clear-all, and copy-result controls make phone use quick.
- Each tab's inputs save separately to this browser's `localStorage` after each edit and restore when the site reopens. The last selected tab is remembered. Results are recalculated from the restored inputs; values are never sent to a server.
- No framework, external fonts, runtime dependencies, or third-party requests. The deployment build only copies the site's five assets into `dist/`.

## Local preview

From this directory, run:

```sh
python3 -m http.server 8080
```

Open `http://localhost:8080`. Use an HTTP server instead of opening `index.html` directly because the scripts use JavaScript modules. Copying uses the Clipboard API on HTTPS or localhost; if it is unavailable, the page suggests manually copying the displayed result.

## Remembering amounts

Saving is automatic, including unfinished input. Reopening the same website in the same browser restores the last saved inputs and applies the normal validation and exact-cent calculation. **清空** clears only the active tab and its saved inputs; the other tabs and unrelated browser storage are untouched. Manually emptying every input in a tab also removes that tab's saved values. Existing saved card amounts are preserved from earlier versions.

Saved amounts are specific to the browser, device, and website origin (protocol, hostname, and port). They do not sync between devices or browsers, and a different Vercel preview URL has separate storage. Clearing website data removes them; private browsing generally removes them when the private session ends. Browser storage is not a permanent backup.

If storage is blocked or full, the calculator still works and displays a notice that amounts cannot be saved. Damaged or incompatible saved data is ignored.

## Tests

With Node.js 24:

```sh
npm test
```

No dependency installation is required. Tests cover decimal parsing, cash differences, card formulas, note-count validation, denomination totals, small-note subtotals, and exact arithmetic with very large counts.

## Vercel deployment

Import this repository as a Vercel project and keep the **Root Directory** at the repository root. The included `vercel.json` configures:

| Setting | Value |
| --- | --- |
| Framework Preset | Other (no framework) |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | Skipped (no dependencies) |
| Node.js Version | `24.x`, set in `package.json` |

No environment variables or backend services are required. Vercel serves the site over HTTPS, which supports the copy-result button. Only the five site assets in `dist/` are published; tests and project configuration stay outside the public output.

To verify the production output locally:

```sh
npm run build
python3 -m http.server 8080 --directory dist
```

Open `http://localhost:8080`. Stop any existing server on that port first, or use another port.

Generated `dist/`, local `.vercel/` configuration, and `node_modules/` are ignored by Git. Git operations, connecting the repository to Vercel, and deploying are left to you.
