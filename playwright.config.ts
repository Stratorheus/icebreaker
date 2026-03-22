import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  webServer: {
    command: "npm run dev -- --port 5199",
    port: 5199,
    reuseExistingServer: false,
  },
  use: {
    baseURL: "http://localhost:5199",
  },
});
