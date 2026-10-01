import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

// End-to-end tests against a running local site (npm run dev, with the seeded database).
// Run: npm run test:e2e
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // tests share one database
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    timezoneId: "America/Los_Angeles",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: "playwright/.auth/admin.json" },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: "npm run dev",
    url: `${process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"}/api/health`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
