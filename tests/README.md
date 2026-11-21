# Workout input regression tests

Requirements: Node.js 18+ and locally installed Google Chrome.

From the repository root:

```powershell
npm.cmd ci
npm.cmd run test:ux01
npm.cmd test -- tests/history-sets.spec.js
```

Playwright starts a loopback-only server on port 4173. Each test uses a new
browser context, seeds synthetic templates, and never opens the production site
or reads `gym-backup.json`. Chrome user profiles and real workout data are not used.

The suite runs at 375px and 390px. It checks session boundaries, unchanged history,
reference-only hints, cancellation, exercise isolation, navigation/resume, reload,
and per-set drafts. Every test fails on browser console errors or uncaught errors.
Service workers are blocked so cached builds cannot affect regression results;
PWA install/update behavior and physical mobile gestures are outside this suite.

History tests use independent set values and metadata to verify edits, additions,
removals, cancellation, reload, validation, and isolation from other records.
Before/after editor screenshots are written to `%TEMP%\gym-ux02-evidence`.

Failure screenshots and traces are saved under `test-results/` (gitignored).
To inspect a trace:

```powershell
npx.cmd playwright show-trace <absolute-path-to-trace.zip>
```