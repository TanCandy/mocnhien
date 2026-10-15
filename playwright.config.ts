import { defineConfig, devices } from "@playwright/test";
import path from "path";

// Ensure Playwright uses Drive D for browser binaries
process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || path.resolve(".playwright-browsers");

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    headless: true,
  },
  webServer: [
    {
      command: "node test-evidence/scripts/devstack.cjs",
      port: 4000,
      reuseExistingServer: true,
      timeout: 60000,
    },
    {
      command: "npm run dev",
      port: 3000,
      reuseExistingServer: true,
      timeout: 60000,
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
