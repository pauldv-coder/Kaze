import { defineConfig, devices } from '@playwright/test'
import { config } from 'dotenv'
config({ path: '.env.local' })

const PUERTO = 3100
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  use: { baseURL: `http://localhost:${PUERTO}`, trace: 'retain-on-failure' },
  webServer: {
    command: `npx next dev --port ${PUERTO}`,
    url: `http://localhost:${PUERTO}/login`,
    reuseExistingServer: true,
    timeout: 120_000,
    env: { KAZE_URL: `http://localhost:${PUERTO}` },
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    { name: 'escritorio', dependencies: ['setup'], testIgnore: /auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 860 }, storageState: 'e2e/.auth/carmen.json' } },
    { name: 'movil', dependencies: ['setup'], testIgnore: /auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 400, height: 860 }, storageState: 'e2e/.auth/carmen.json' } },
  ],
})
