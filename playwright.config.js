import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  use: { baseURL: process.env.TEST_URL || "http://127.0.0.1:4173", trace: "retain-on-failure" },
  projects: [
    { name: "webkit-iphone", use: { ...devices["iPhone 14"], defaultBrowserType: "webkit" } },
    { name: "chromium-mobile", use: { ...devices["Pixel 7"], defaultBrowserType: "chromium" } },
  ],
  webServer: process.env.TEST_URL ? undefined : {
    command: "npm run preview -- --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173", reuseExistingServer: false,
  },
});
