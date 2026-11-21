# Manual GitHub Pages deployment (approval-gated)

Status: **prepared on a feature branch; not merged, not triggered, not deployed.**
Pages source is still `Deploy from a branch` → `main` → `/ (root)`, so the live
site remains v40 until the owner changes settings and approves one deployment.

## Verified repository state (read-only, anonymous API)

| Item | Observed |
| --- | --- |
| Default branch / head | `main` @ `3b0455b` (v40) |
| Branch protection on `main` | **none** (`protected: false`); the detailed endpoint returns 401 |
| Environments | one: `github-pages`, created 2026-09-29 |
| `github-pages` rules | branch policy + **`required_reviewers`** (1 reviewer: repository owner, `prevent_self_review: false`), no wait timer |
| Workflows | only GitHub's dynamic `pages build and deployment` |
| Latest deployment | `github-pages`, ref `main`, sha `3b0455b`, success |
| Live site | v40 (`CACHE_NAME = 'gym-tracker-v40'`) |

The approval gate exists, so a dispatch will now stop at *Waiting for approval*.
One reported field still disagrees with the intended configuration — see the
`can_admins_bypass` risk below.

## What is in place

| File | Role |
| --- | --- |
| `.github/workflows/ci.yml` | Existing 260-test suite, now also callable via `workflow_call`. No Pages permissions, never deploys. |
| `.github/workflows/deploy.yml` | New workflow: manual trigger → guard → validate/test → re-check package → deploy. |
| `.github/scripts/verify-release.cjs` | Single builder for the 37-file package; new `--check` mode re-verifies an already built package. |

The deploy workflow never uploads the repository root. The only directory handed
to `actions/upload-pages-artifact` is `$RUNNER_TEMP/verified-release`, which is
produced by the verifier and then re-checked byte-for-byte before upload.

## Triggers, jobs, permissions

```text
on: workflow_dispatch            # manual only; no push, PR, schedule, or tag
permissions: contents: read      # workflow default
concurrency: group: pages, cancel-in-progress: false   # one production deploy at a time
```

1. `guard` — `contents: read`, two steps. Fails unless the event is
   `workflow_dispatch` **and** the ref is exactly `refs/heads/main` (selecting
   another branch in the Actions UI produces a failed run instead of a silent
   skip). It then reads `GET /repos/{owner}/{repo}/environments/github-pages` and
   refuses to continue unless the environment really has a `required_reviewers`
   protection rule — verified both anonymously and with the job token. Without
   that rule a dispatch would publish instantly, so the gate is enforced in code
   as well as in settings.
2. `validate` — calls `./.github/workflows/ci.yml` with `contents: read`.
   Runs the JavaScript syntax check, the changed-line whitespace check, the
   release verifier, `npm ci`, Chrome install, and the full 260-test suite
   (375 px and 390 px). Uploads the verified package as the
   `gymtracker-release` artifact. The test suite is defined once, in `ci.yml`.
3. `deploy` — `needs: validate`, environment `github-pages`, permissions
   `contents: read` + `pages: write` + `id-token: write` (the last two only here).
   Checks that `main` has not moved past `github.sha` while the run waited for
   approval, downloads the validated artifact, runs
   `verify-release.cjs --check` (exactly 37 allowlisted files, no extras, no
   symlinks, bytes identical to this commit, security scan re-applied), uploads it
   as the Pages artifact, then runs `actions/deploy-pages`.

Pinned actions (full commit SHAs, verified against upstream tags). Every action
runs on Node 24: Node 20 was removed from GitHub Actions runners on
2026-09-23, so the older v4-era pins would now only produce deprecation warnings
or break.

| Action | Pin | Version |
| --- | --- | --- |
| `actions/checkout` | `3d3c42e5aac5ba805825da76410c181273ba90b1` | v7.0.1 |
| `actions/setup-node` | `949feb2413d6458794dcd2491c4babbbce0c15c1` | v7.1.0 |
| `actions/upload-artifact` | `cf430e030ddbb5b0abf93d22962f4752f3646cd9` | v7.0.2 |
| `actions/download-artifact` | `9000827ccba6bdab643e8b6fd33ac0654aef8333` | v8.0.2 |
| `actions/upload-pages-artifact` | `fc324d3547104276b827a68afc52ff2a11cc49c9` | v5.0.0 |
| `actions/deploy-pages` | `368f82528645a54fb793d4d04e342629a3f51346` | v5.0.1 |

`include-hidden-files: true` is required because the package contains `.nojekyll`
(both Pages artifact upload and the CI upload step set it).

## How the approval gate works

The `deploy` job declares `environment: github-pages`. Before any step of that job
runs, GitHub checks the environment's protection rules. With **Required
reviewers** configured, the run stops in state *Waiting for approval*, the
reviewer(s) get a notification, and nothing is published until an authorized
person clicks **Review deployments → Approve**. Rejecting fails the run and
leaves the live site untouched.

The `guard` job and the `validate` job (tests + package build) are not gated:
they are read-only, publish nothing, and run first so the reviewer is approving a
commit that has already passed 260 tests. Everything downstream of the gate —
download, re-check, Pages artifact upload, deploy — happens only after approval.

A useful side effect: the environment's *Deployment branches* rule can be set to
`main` only, which is a second, settings-level barrier on top of the workflow's
own ref guard.

A waiting job holds no runner, so it consumes no Actions minutes. GitHub limits a
gate approval wait to 30 days (the whole run is capped at 35 days including that
wait). The deploy job's `timeout-minutes: 10` counts only real execution, starting
after approval. The `Validate, test, and package` job runs *before* the gate, so
the expensive part is already done when the reviewer is asked.

## Required manual repository settings (owner only — do not automate)

Item 2 is **already done**: the owner configured Required reviewers on
`github-pages` (1 reviewer = repository owner, Prevent self-review off, no wait
timer, allowed deployment branch `main` only). Items 1 and 3 are still
outstanding.

1. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
   This must be done before the first deploy run. It stops the legacy
   `pages-build-deployment` workflow, which today republishes the branch root on
   every push to `main`, and it is also required by `actions/deploy-pages`
   (otherwise it fails with "Get Pages site failed"). GitHub docs describe that a
   site can end up unpublished after a source change and is re-enabled only by a
   new successful deployment, so do this and then dispatch the deploy promptly;
   the artifacts are unaffected, only the published site.
2. **Settings → Environments → `github-pages`** — configured. Verified
   read-only through `GET /repos/{owner}/{repo}/environments/github-pages`, which
   reports a `required_reviewers` rule naming the repository owner with
   `prevent_self_review: false`, alongside the `main` branch policy.
   - Leave **Prevent self-review** off while the owner is the only person who
     both triggers and approves; turning it on without a second trusted reviewer
     would make every dispatch unapprovable.
   - **Deployment branches**: keep `Selected branches` → `main`.
   - Re-check **Allow administrators to bypass configured protection rules**
     once, in the UI — the API still reports `can_admins_bypass: true` (see the
     risks section; it may be a stale anonymous field).
3. **Settings → Branches → `main`**: require a pull request before merging and
   require the CI status check. GitHub prefixes job checks with the workflow name,
   so the pull-request entry is `GymTracker CI / validate`. In a deploy run the
   same job is reported under the caller, as `Validate, test, and package /
   validate`; you only need the PR entry. Optionally require linear history and
   disallow force pushes. Protection rules for public repositories are available
   on the Free plan; `main` is currently **unprotected**.
4. Free plan note: environment protection rules (including required reviewers)
   are available for **public** repositories. If the repository is ever made
   private on Free, those rules are ignored — a strong reason to keep it public
   or to upgrade.

## Lifecycle (intended process)

1. Agent prepares changes on a separate branch (explicit `git add <paths>`,
   never `-A`).
2. Agent pushes the branch; CI (`ci.yml`, `push` + `pull_request`) validates it.
3. Owner reviews and merges the PR into `main`.
4. Agent starts the manual run: Actions → *Deploy GymTracker to GitHub Pages* →
   *Run workflow* → branch `main` (or `gh workflow run deploy.yml --ref main`).
5. GitHub pauses the `deploy` job at the protected `github-pages` environment.
6. Owner approves in the UI.
7. Agent watches the run to completion and then verifies the live site
   (`sw.js` cache name, HTML/asset bytes, headers, `manifest.json`).

The agent never approves a deployment itself and must never try to bypass,
disable, or edit environment protection rules.

## Authentication without a shared PAT

- The workflow uses only the automatic `${{ github.token }}`
  (`GITHUB_TOKEN`); no PAT, no repository secret, no `GH_TOKEN`, no credential
  in any project or environment file.
- Local Git already uses **Git Credential Manager 2.9.1** (`credential.helper =
  manager`), and `origin` is a clean HTTPS URL without embedded credentials.
- Browser-based authorization: when Git needs credentials, GCM opens the system
  browser (GitHub OAuth `browser`/`device` mode, which GCM auto-detects). The owner
  signs in there and the resulting credential is stored in the Windows Credential
  Manager (GCM's default store on Windows). The agent runs `git push` and the
  browser window appears; the agent never sees, reads, or prints the token value.
  Do not run `git credential fill`, `git credential-manager github list`, or
  `gh auth token`.
- **This is not "zero access".** Browser sign-in authorizes the local Git client
  with the signed-in account's permissions (push, and through that account, any
  action the account may take). The trust boundary is the account, not a scoped
  token. Treat the workstation accordingly.
- To *trigger* and *monitor* workflow runs the agent also needs an authenticated
  API client. Options, in order of preference:
  1. Owner clicks *Run workflow* in the browser (no credential reaches the agent).
     The agent then monitors read-only endpoints (public repo run/deployment
     status is readable anonymously, though details lag).
  2. Owner installs GitHub CLI and completes `gh auth login --web` **himself**
     (device code in the browser). `gh` keeps its token in the OS keyring; the
     agent uses `gh workflow run`, `gh run watch`, `gh run view`. This requires
     explicit owner permission first — the agent must not run `gh auth login`
     on its own, and `gh` is not currently installed.
  3. Last resort, and not recommended: a fine-grained PAT with
     `Actions: write` limited to this repository. The owner would have to paste it
     into a shell, which contradicts "no PAT sharing", so it is not part of the plan.

## Plan limitations and unresolved risks

- **Agent ≠ separate identity.** When the agent acts with the owner's Git/GitHub
  credentials, GitHub sees the owner as the actor. The rule "the agent must not
  approve its own deployment" is therefore a policy constraint, not something
  GitHub can enforce, unless *Prevent self-review* + a second reviewer exist.
- **Workflow must exist on `main`.** `workflow_dispatch` only appears after
  `deploy.yml` is merged; nothing can be triggered before that.
- **Today `main` contains v40 only.** The v49 work and this pipeline live on the
  `release/v49-ci-pages-deploy` branch, so a dispatch from the current `main`
  would fail validation (no `release-files.txt`, older assets) — a safe failure,
  but deployment is impossible until the v49 changes are reviewed and merged.
- **Pushing while Pages still uses the branch source would publish the repo root**,
  including `tests/`, `package.json`, `.github/`. Switch the source to GitHub
  Actions *before* that push to `main`, or accept that exposure.
- **`can_admins_bypass` still reads `true`.** The owner reports disabling
  administrator bypass, but anonymous `GET .../environments/github-pages` keeps
  returning `can_admins_bypass: true` (verified twice, 60 s cache). Controlled
  comparison: `vercel/next.js` and `cloudflare/workers-sdk` return `false` for
  environments that are definitely gated, `home-assistant/core` returns `true`, so
  the field is probably authoritative rather than a constant. If it is, an
  administrator can approve/deploy without the gate, which weakens the whole
  design. Check the toggle in the UI; if it is off there and the API still says
  `true`, do not dispatch until the discrepancy is understood. The workflow's own
  guard cannot close this gap, because the bypass happens at the environment.
- **The guard's environment check relies on a documented-but-unversioned API
  shape.** Verified empirically across several public repositories: anonymous
  `GET /repos/{owner}/{repo}/environments` does return `protection_rules` including
  `required_reviewers` (for example `vercel/next.js` → `release-stable`,
  `cloudflare/workers-sdk` → `CI`, `home-assistant/core` → `stable`). For this repo
  it now returns `required_reviewers`, so the guard passes. If GitHub
  ever hides protection rules from unauthenticated callers *and* the job token
  lacks the admin scope, deploys stay blocked; fix that by granting the check a
  token that can read the environment, never by deleting the check.
- **If the owner approves their own run with "Prevent self-review" off**, the
  approval is a formality they perform knowingly. The workflow cannot distinguish
  that from a genuine second-person review; only the environment setting can.
- **Line endings differ between this Windows checkout and CI.** The repository
  has `core.autocrlf=true` and no `.gitattributes`, so `app.js`, `sw.js`,
  `style.css`, `index.html` and `manifest.json` hold mixed CRLF/LF locally but are
  stored and checked out as LF in Actions. The byte-equality guard in the deploy
  job compares artifact bytes to the *runner's* checkout, so it stays consistent;
  the deployed bytes may therefore differ from a staging package built here by
  line endings only (same logical content, different SHA-256). Add
  `.gitattributes` if you want this pinned rather than implicit.
- **Untested in GitHub Actions.** No CI run, Pages deployment, or artifact
  round-trip has been executed (no push allowed). Local validation covers YAML
  linting and the verifier only.
- **Action majors move fast.** Node 20 was removed from runners on 2026-09-23,
  which forced every action here onto a Node-24 release (checkout v7, setup-node
  v7, upload-artifact v7, download-artifact v8). Dependabot/renovate is not
  configured, so re-check pins periodically; if `upload-artifact` moves major
  again, move `download-artifact` with it and confirm `include-hidden-files`
  still exists.
- **Live-site verification is external to the workflow.** Pages serves through a
  CDN; after a successful deploy the agent must confirm the cache name in
  `sw.js` and the asset hashes, and remember that installed PWAs may keep v40
  until the update check runs.
- **Rollback** = merge a revert commit and dispatch again, or (no new commit)
  re-run the last good deployment run from its own commit. Neither is automated.
- **`pages` concurrency group** is shared with GitHub's implicit page build; a
  branch-based deploy in flight would serialize with ours rather than interleave.
  Because `cancel-in-progress: false`, a second dispatch issued while the first
  run is still *waiting for approval* queues instead of starting — cancel the
  stale pending run rather than approving both.
- The stale-head check uses the preinstalled `curl` and `jq` on `ubuntu-24.04` and
  the job-scoped `${{ github.token }}` (with `contents: read`); it prints no
  token, only the two commit SHAs.
- Physical mobile/iOS device verification is still outstanding and unrelated to
  this pipeline.

## Local validation performed

```powershell
actionlint -no-color .github/workflows/ci.yml .github/workflows/deploy.yml
node --check .github/scripts/verify-release.cjs
node .github/scripts/verify-release.cjs "$env:TEMP/gymtracker-release-check"
node .github/scripts/verify-release.cjs --check "$env:TEMP/gymtracker-release-check"
npm.cmd test
```

`actionlint` 1.7.12 (downloaded from the upstream release, SHA-256 verified)
reports no findings; it also rejects a deliberately broken workflow, so the
clean result is meaningful. Both `run:` shell blocks were extracted and passed
through `bash -n`, and the guard block was executed for three cases (main +
`workflow_dispatch` → pass, other branch → fail, other event → fail). The
stale-head check was exercised against stubbed `curl`/`jq`: same commit → pass,
moved `main` → fail, missing `commit.sha` → fail, unparseable payload → fail,
network error → fail. The approval-gate step was run against a stub HTTP server
(`required_reviewers` present → pass; only `branch_policy` → fail; unreachable →
fail) and against the real API: it failed before the owner configured Required
reviewers and passes now, which is the intended fail-closed behaviour in both
directions.

`npm.cmd test` → **260 passed** (10.4 min) after the changes; the release package
re-built by the verifier is byte-identical to the previously verified v49 staging
directory (37 files, matching SHA-256 per file).

Negative cases verified for `--check`: an extra file, a modified byte, a missing
file, a directory inside the checkout, an existing staging target, and a missing
argument all exit non-zero. Re-checking the previously staged v49 package
(`gym-release-v49-elV7ja`) also passes, confirming the released bytes are
unchanged.
