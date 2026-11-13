import { defineConfig, devices } from "@playwright/test";

// Next.js loads .env.local for the app only; the test runner needs it for the E2E_* sign-in variables. CI has none, so those tests skip.
try { process.loadEnvFile(".env.local"); } catch { /* no .env.local */ }

export default defineConfig({
  testDir: "tests/e2e",
  use: { baseURL: "http://localhost:3000" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: { command: "npm run build && npm run start", url: "http://localhost:3000", reuseExistingServer: !process.env.CI, timeout: 180_000 },
});
