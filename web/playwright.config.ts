import { defineConfig, devices } from "@playwright/test";

// Browser E2E for the Nyx product UI. Uses the SYSTEM Chrome (channel: "chrome")
// so no Chromium binary is downloaded.
//
//   E2E_BASE_URL   target site (default: the live Vercel deployment)
//   E2E_CHANNEL    browser channel: "chrome" (default) | "msedge"
//
// Run:  npm run e2e            (against live)
//       E2E_BASE_URL=http://localhost:3000 npm run e2e   (against a local dev server)
const baseURL = process.env.E2E_BASE_URL || "https://nyx-darkpool.vercel.app";
const channel = process.env.E2E_CHANNEL || "chrome";

export default defineConfig({
  testDir: "./e2e",
  // The full pipeline settles on testnet (slow); a free-tier engine also cold-starts.
  timeout: 180_000,
  expect: { timeout: 90_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    channel,
    headless: true,
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chrome", use: { ...devices["Desktop Chrome"], channel } }],
});
