import { Page, request as pwRequest } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const API = 'http://localhost:8001/api/v1';

// The /auth/token endpoint is rate-limited to 5/minute per IP (brute-force
// guard). A parallel test suite would blow past that, so we log each account in
// at most once and cache the token+profile to disk, shared across all workers.
const CACHE_DIR = path.join(process.cwd(), 'e2e', '.auth-cache');
const CACHE_TTL_MS = 60 * 60 * 1000; // tokens outlive a full suite run

// Accounts the suite authenticates as. global-setup pre-warms these sequentially
// so parallel workers never race the 5/min login limit.
export const SEED_ACCOUNTS: [string, string][] = [
  ['admin', 'admin123'],
  ['demo', 'demo123'],
  ['creator1', 'creator123'],
];

type Cached = { tok: any; user: any; ts: number };

function readCache(username: string): Cached | null {
  try {
    const f = path.join(CACHE_DIR, `${username}.json`);
    const c: Cached = JSON.parse(fs.readFileSync(f, 'utf8'));
    if (Date.now() - c.ts < CACHE_TTL_MS) return c;
  } catch {
    /* miss */
  }
  return null;
}

function writeCache(username: string, c: Cached) {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(path.join(CACHE_DIR, `${username}.json`), JSON.stringify(c));
  } catch {
    /* best effort */
  }
}

export async function apiLogin(username: string, password: string): Promise<Cached> {
  const cached = readCache(username);
  if (cached) return cached;

  const ctx = await pwRequest.newContext();
  try {
    // Retry on 429 — when many workers start at once they can briefly exceed the
    // 5/min login cap before the cache is warm.
    let tok: any = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      const res = await ctx.post(`${API}/auth/token`, { form: { username, password } });
      if (res.ok()) {
        tok = await res.json();
        break;
      }
      if (res.status() === 429) {
        await new Promise((r) => setTimeout(r, 12000));
        const fresh = readCache(username); // another worker may have populated it
        if (fresh) return fresh;
        continue;
      }
      throw new Error(`login ${username} failed: ${res.status()}`);
    }
    if (!tok) throw new Error(`login ${username} exhausted retries (rate limited)`);

    const me = await ctx.get(`${API}/users/me`, {
      headers: { Authorization: `Bearer ${tok.access_token}` },
    });
    const user = await me.json();
    const entry: Cached = { tok, user, ts: Date.now() };
    writeCache(username, entry);
    return entry;
  } finally {
    await ctx.dispose();
  }
}

/**
 * Log a user in by seeding localStorage from a cached API token so the SPA boots
 * authenticated. Must be called BEFORE page.goto(). Also dismisses the first-run
 * onboarding modal so it doesn't overlay the page under test.
 */
export async function loginAs(page: Page, username: string, password: string) {
  const { tok, user } = await apiLogin(username, password);
  await page.addInitScript(
    ([t, u]) => {
      localStorage.setItem('access_token', t.access_token);
      if (t.refresh_token) localStorage.setItem('refresh_token', t.refresh_token);
      localStorage.setItem(
        'auth-storage',
        JSON.stringify({ state: { user: u, isAuthenticated: true }, version: 0 })
      );
      localStorage.setItem('onboarding_dismissed', 'true');
    },
    [tok, user]
  );
  return user;
}
