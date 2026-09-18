# Card 结算

A small mobile-first calculator for:

**上午card + 当前card + 多收客人card − 少收客人card**

- Each input accepts 0–20,000 with up to two decimal places. Empty inputs count as zero.
- Results update immediately. Invalid input displays an inline error and hides the total until corrected.
- Decimal text is converted into integer cents before calculation, avoiding floating-point rounding artifacts. Results always show two decimal places and can be negative or greater than 20,000.
- Large inputs, decimal keyboard hints, select-on-focus, clear-all, and copy-result controls make phone use quick.
- The four inputs automatically save to this browser's `localStorage` after each edit and restore when the site reopens. The result is recalculated from the restored inputs; amounts are never sent to a server.
- No framework, external fonts, runtime dependencies, or third-party requests. The deployment build only copies the site's five assets into `dist/`.

## Local preview

From this directory, run:

```sh
python3 -m http.server 8080
```

Open `http://localhost:8080`. Use an HTTP server instead of opening `index.html` directly because the scripts use JavaScript modules. Copying uses the Clipboard API on HTTPS or localhost; if it is unavailable, the page suggests manually copying the displayed result.

## Remembering amounts

Saving is automatic, including unfinished input. Reopening the same website in the same browser restores the last saved inputs and applies the normal validation and exact-cent calculation. **清空** removes the calculator's saved amounts as well as clearing the form; unrelated browser storage is untouched. Clearing all four inputs manually also removes the saved amounts.

Saved amounts are specific to the browser, device, and website origin (protocol, hostname, and port). They do not sync between devices or browsers, and a different Vercel preview URL has separate storage. Clearing website data removes them; private browsing generally removes them when the private session ends. Browser storage is not a permanent backup.

If storage is blocked or full, the calculator still works and displays a notice that amounts cannot be saved. Damaged or incompatible saved data is ignored.

## Tests

With Node.js 24:

```sh
npm test
```

No dependency installation is required. Tests cover decimal parsing, validation, exact arithmetic, formula ordering, and result boundaries.

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
