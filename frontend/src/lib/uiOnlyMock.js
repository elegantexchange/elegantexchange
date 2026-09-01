/**
 * Production-safe entry for REACT_APP_UI_ONLY.
 * Full dataset lives in uiOnlyMock.local.js (gitignored) when present.
 */
export function uiOnlyMockData(cfg) {
  try {
    // require.context so Vercel builds succeed when the local file is absent
    const ctx = require.context(".", false, /^\.\/uiOnlyMock\.local\.js$/);
    if (ctx.keys().length > 0) {
      return ctx(ctx.keys()[0]).uiOnlyMockData(cfg);
    }
  } catch {
    /* no local dataset in this environment */
  }
  throw new Error(
    "UI-only mode needs frontend/src/lib/uiOnlyMock.local.js (gitignored)."
  );
}
