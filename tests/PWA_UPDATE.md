# Installed PWA update verification

Run `node tests/pwa-update.cjs` from the repo root with desktop Chrome and an
interactive desktop. The script serves only application assets on loopback,
reads the previous build from commit `3b0455b` (cache `gym-tracker-v40`), and
switches that same origin to working-tree `gym-tracker-v49`. Each scenario uses
a temporary Chrome profile and synthetic data. Chrome CDP installs and launches
the app; the script checks standalone display mode and uninstalls it afterward.

- Healthy update: 34 → 35 precache entries (`import.js` added). The new worker
  claimed both open clients without closing them; v40 cache was removed. Reload and
  standalone relaunch worked with the network cut after activation. Response
  hashes matched the intended HTML, CSS, and JS. Storage and runtime state
  matched the baseline, including two templates, one History record and active
  input (65 kg, 8 reps), with no migration or duplicate.
- HTTP 503 on `sw.js`: previous worker/cache survived and the installed app
  reopened offline with unchanged v40 assets and data.
- HTTP 503 on `import.js`: Chrome rejected the install (`event.waitUntil`
  rejected), the candidate became `redundant`, and only the previous v40 cache
  remained. Offline reload and standalone relaunch served v40; data was unchanged.
- Retry on the same origin/profile: with `import.js` available, all 35 assets
  were cached, v49 activated, and v40 was removed. Offline reload and standalone
  relaunch served v49 with unchanged data.

`sw.js` checks the full required list, bypassing stale HTTP cache entries on
precache. It discards a newly created candidate cache on failure and propagates
the install error. On success it retains immediate activation, claims clients,
then removes older `gym-tracker-v<number>` caches only.

The install/update check is separate from Playwright's normal regression config,
which blocks service workers. Relevant regressions: 48/48 in `workout-input`
and `completion`; full suite after the v49 icon changes: 260/260. Desktop
Chrome reports a legacy mobile meta tag and an icon size mismatch in v40.
The v49 icons match the manifest and Chrome returned no installability errors.
Physical mobile,
in-flight requests during client takeover, and production-origin updates were
not tested. `v49` is the local release candidate; use a fresh cache key for any
future release that follows a published build.
