import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: false, workers: 1, retries: 0, timeout: 60000,
  use: { baseURL: 'http://localhost:3000', trace: 'off', screenshot: 'off' },
  projects: [ { name:'desktop', use:{ ...devices['Desktop Chrome'] } }, { name:'mobile', use:{ ...devices['iPhone 13'],browserName:'chromium' } } ],
  webServer: { command:'npm run start',url:'http://localhost:3000',reuseExistingServer:!process.env.CI,timeout:60000 },
});
