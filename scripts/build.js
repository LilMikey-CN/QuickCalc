import { copyFile, mkdir, rm } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const output = new URL("dist/", root);
const files = ["index.html", "styles.css", "app.js", "calculator.js", "amount-calculator.js", "amount-state.js", "card-state.js", "cash-state.js", "focus-scroll.js", "favicon.svg"];

// Publish only the site's assets, leaving tests and project files out of dist.
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const file of files) {
  await copyFile(new URL(file, root), new URL(file, output));
}

console.log(`Built ${files.length} static files in dist/`);
