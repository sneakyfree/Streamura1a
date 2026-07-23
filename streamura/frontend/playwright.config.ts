import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);

// The self-hosted CI box runs resident containers, so a fixed dev-server port
// can collide with (or worse, silently test against) a foreign service. CI
// picks a free ephemeral port per run and passes it via PLAYWRIGHT_PORT.
const port = Number(process.env.PLAYWRIGHT_PORT || 5852);

export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: isCI,
    retries: isCI ? 2 : 0,
    workers: isCI ? 1 : undefined,
    reporter: 'list',
    use: {
        baseURL: process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${port}`,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    webServer: isCI ? {
        command: `npm run dev -- --port ${port}`,
        url: `http://localhost:${port}`,
        // Never reuse in CI: on a shared host an already-bound port would mean
        // we silently run the suite against something that isn't this checkout.
        reuseExistingServer: false,
        timeout: 120000,
    } : undefined,
});

