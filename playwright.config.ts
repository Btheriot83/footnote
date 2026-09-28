import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT || 3000);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        // Use an installed Chrome with PW_CHANNEL=chrome, or `npx playwright install chromium`.
        channel: process.env.PW_CHANNEL || undefined,
        launchOptions: { args: ["--autoplay-policy=no-user-gesture-required", "--mute-audio"] },
      },
    },
  ],
  webServer: {
    command: `npm run dev -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
