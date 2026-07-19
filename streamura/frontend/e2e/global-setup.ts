import { apiLogin, SEED_ACCOUNTS } from './_helpers';

/**
 * Pre-warm the auth token cache ONCE, sequentially, before the parallel test
 * run starts. The /auth/token endpoint is rate-limited to 5/minute per IP; if
 * many workers logged in at once on a cold cache they would burst past it and
 * get 429s. Logging the few seed accounts in serially here (then caching to
 * disk) means worker tests never hit the login endpoint at all.
 */
async function globalSetup() {
  for (const [username, password] of SEED_ACCOUNTS) {
    try {
      await apiLogin(username, password);
    } catch (err) {
      // Non-fatal: tests that need this account will surface the failure.
      console.warn(`[global-setup] could not pre-warm ${username}:`, err);
    }
    // Small spacing keeps us comfortably under 5 logins/minute even if the
    // cache was just invalidated.
    await new Promise((r) => setTimeout(r, 500));
  }
}

export default globalSetup;
