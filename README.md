# Card 结算

A small mobile-first calculator for:

**上午card + 当前card + 多收客人card − 少收客人card**

- Each input accepts 0–20,000 with up to two decimal places. Empty inputs count as zero.
- Results update immediately. Invalid input displays an inline error and hides the total until corrected.
- Decimal text is converted into integer cents before calculation, avoiding floating-point rounding artifacts. Results always show two decimal places and can be negative or greater than 20,000.
- Large inputs, decimal keyboard hints, select-on-focus, clear-all, and copy-result controls make phone use quick. Amounts stay in the page; nothing is sent to a server.
- No framework, build step, external fonts, runtime dependencies, or third-party requests.

## Local preview

From this directory, run:

```sh
python3 -m http.server 8080
```

Open `http://localhost:8080`. Use an HTTP server instead of opening `index.html` directly because the scripts use JavaScript modules. Copying uses the Clipboard API on HTTPS or localhost; if it is unavailable, the page suggests manually copying the displayed result.

## Tests

With Node.js 18 or newer:

```sh
npm test
```

No dependency installation is required. Tests cover decimal parsing, validation, exact arithmetic, formula ordering, and result boundaries.

## GitHub Pages, when you're ready

Publish the repository root with GitHub Pages. The site files are `index.html`, `styles.css`, `app.js`, `calculator.js`, and `favicon.svg`. All asset paths are relative so repository subpaths work. No deployment workflow is required.

Git setup, commits, pushing, and GitHub Pages configuration are left to you.
