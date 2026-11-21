# GymTracker CI (no deployment)

The workflow runs on pushes and pull requests. It uses Node.js 24, `npm ci`,
`npx --no-install playwright install --with-deps chrome`, and `npm test`.
Playwright runs the existing Chrome suites at 375 and 390 px. The separate
installed-PWA check is manual; normal regression tests block service workers.

To verify the release locally, choose a **new** directory outside the checkout:

```powershell
node .github/scripts/verify-release.cjs "$env:TEMP/gymtracker-release-check"
git diff --check
```

The verifier checks all 37 listed files, 35 precache URLs (including the
app root), runtime references, manifest and icon dimensions. It rejects paths
outside the runtime allowlist and symlinks, scans file contents for common
credential and private-data patterns, and verifies the staged file list and
bytes. A pattern scan is a safeguard, not a substitute for reviewing additions.
Update the expected counts deliberately if the runtime assets change.

Workflow YAML is not linted inside CI (that would need another third-party
action). Run `actionlint` locally before pushing workflow edits; a prebuilt
Windows binary from the upstream release is enough.

The changed-line whitespace check uses the PR base or the push `before` commit.
For a `workflow_dispatch` or a brand-new branch there is no such base, so it
falls back to the parent commit — i.e. only the head commit is checked.

Only successful pushes to the repository's default branch upload the verified
staging directory, retained for seven days. Treat that artifact as public; it
never contains the checkout, test outputs, or personal backups. This workflow
does not configure or deploy to Pages. A push may still trigger a separately
configured branch-based Pages publication; confirm the Pages source before
pushing. Review the exact files to add to Git, including the regression suite
and its config; do not stage the whole working directory.

## Reuse and deployment

`ci.yml` also accepts `workflow_call`, so the manual deployment workflow
(`deploy.yml`) runs this same job definition instead of a copy of the suite.
The only behavioural difference for a call: the package is uploaded when the
caller is a `workflow_dispatch` on `main`, so the deploy job can re-check and
publish exactly the tested bytes.

The verifier has a second mode that re-checks an existing package instead of
building one. It is used by the deploy job after downloading the artifact:

```powershell
node .github/scripts/verify-release.cjs --check "$env:TEMP/gymtracker-release-check"
```

Re-check enforces the same 37-file allowlist, rejects extra files, symlinks and
non-regular entries, re-applies the content scan, and requires every packaged
byte to equal the checked-out source.

Deployment requirements, the approval gate, permissions, pinned action SHAs,
lifecycle and open risks are documented in [`DEPLOY.md`](DEPLOY.md). Do not
change Pages or environment settings without the repository owner.
