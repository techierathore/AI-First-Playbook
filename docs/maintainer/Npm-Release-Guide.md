# npm Version And Package Release Guide

Release owner: the Playbook owner (owner decision, 2026-09-26). Agents prepare changes; they never
publish, tag or bump the version. This guide merges the former `Npm-Publishing-Guide.md` as the
appendix "Initial publishing setup".

Use this document for every release after the initial npm and OIDC setup is complete.

- npm package: [`@techierathore/ai-first-playbook`](https://www.npmjs.com/package/@techierathore/ai-first-playbook)
- Release workflow: [`.github/workflows/release.yml`](../../.github/workflows/release.yml)
- Package manifest: [`/package.json`](../../package.json)
- Full manifest path on the current Windows checkout:
  `C:\3AIGenCode\AI-First-Playbook\package.json`
- Repository root on the current Windows checkout:
  `C:\3AIGenCode\AI-First-Playbook`

Do not run `npm publish` manually and do not create an `NPM_TOKEN`. Publishing is performed by
GitHub Actions through npm Trusted Publishing (OIDC).

## 1. Choose The New Version

npm versions cannot be overwritten. Choose the increment based on the change:

| Change | Example release tag |
|---|---|
| Patch: backward-compatible fix | `v0.1.1` |
| Minor: backward-compatible feature | `v0.2.0` |
| Major: breaking change | `v1.0.0` |

## 2. Do Not Update `/package.json`

The GitHub Release tag is the release version source of truth. The workflow checks out that tag
and runs `npm version <tag-without-v> --no-git-tag-version` only inside its temporary runner.
There is no release-only manifest commit and nothing to synchronize by hand.

## 3. Commit And Push The Package Update

Review and commit the product and documentation changes through the repository's normal process.
Agents do not stage, commit, push, or tag. No version-only commit is required.

## 4. Publish The GitHub Release

1. Open <https://github.com/techierathore/AI-First-Playbook/releases>.
2. Select **Draft a new release**.
3. Create a new semantic-version tag beginning with `v`, such as `v0.1.1`.
4. Target the commit containing the package changes.
5. Add release notes describing the package changes: start from the `Unreleased` section of
   [Changelog.md](Changelog.md), then retitle that section with the new version and date.
6. Select **Publish release**.

Publishing the GitHub Release starts `.github/workflows/release.yml`. Merely pushing a tag does
not publish the npm package.

The release tag supplies the npm version. The workflow validates the derived version and rejects a
version that already exists before publishing.

## 5. What CI/CD Does Automatically

The **Publish npm package** workflow validates once per supported OpenCode (`package.json`
`opencode.supported`: 1.18.32 and 2.0.18); each validation job:

1. Checks out the exact GitHub Release tag.
2. Installs Node.js 22.14.0 and npm 11.5.1.
3. Validates the `vX.Y.Z` release tag and applies `X.Y.Z` to the runner's package manifest.
4. Verifies that `X.Y.Z` does not already exist on npm.
5. Installs that OpenCode (`node scripts/opencode-package.mjs <version>` names the npm package:
   `opencode-ai` for 1.x, `@opencode/cli` for 2.x).
6. Runs repository validation, guardrail tests, miss-telemetry tests and install tests.
7. Runs `npm pack --dry-run`.
8. Runs the requirement grader (`scripts/playbook-grade.mjs docs/Playbook-Requirements.md`).
9. Checks the release commit for whitespace errors.

Only when every validation job passes does it publish, stable versions under npm tag `latest` and
prereleases under `next`, through OIDC with npm provenance.

You do not need to run those validation commands manually. A failed check stops publication.

## 6. Confirm

1. Open the repository's **Actions** tab and select **Publish npm package**.
2. Wait for the workflow to finish successfully; no environment approval is required.
3. Confirm the new version on the
   [npm package page](https://www.npmjs.com/package/@techierathore/ai-first-playbook).

## Release Problems

| Problem | Action |
|---|---|
| Version already exists | Create the next semantic-version GitHub Release; npm versions cannot be overwritten. |
| Release tag is invalid | Use a semantic version beginning with `v`, such as `v0.2.0`. |
| Workflow does not start | Confirm you published a GitHub Release; pushing a tag alone is not the configured trigger. |
| Workflow says `ENEEDAUTH` | Recheck npm Trusted Publisher values and confirm the workflow has `id-token: write`. Do not add a token. |
| npm page still shows the old version | Wait for the workflow to pass, then reload the npm package page. |

## Recovering From The `v0.1.1` Release

After committing this pipeline fix and clearing the npm Trusted Publisher's environment field,
cancel the old waiting run. Open **Actions -> Publish npm package -> Run workflow**, enter
`v0.1.1`, and run it once. The recovery trigger checks out the existing release tag and derives
npm version `0.1.1`. It skips only the immutable tag's historical commit-diff whitespace check;
all package validation and tests still run. Future GitHub Releases trigger automatically, enforce
the whitespace check, and do not use this manual path.

## Appendix: Initial publishing setup

Package: [`@techierathore/ai-first-playbook`](https://www.npmjs.com/package/@techierathore/ai-first-playbook)

### Setup Status

The one-time setup is complete after all of the following are true:

- version `0.1.0` has been published manually;
- npm Trusted Publishing points to this repository and `release.yml`, with no environment name;
- `.github/workflows/release.yml` is committed and present on GitHub.

The initial setup steps in this document do not need to be repeated. For every later version, use
the release procedure above. Do not create an npm token and do not
run another manual `npm publish` once OIDC is working.

### The Short Answer About Access Tokens

**Do not create an npm Access Token for this GitHub Actions pipeline.**

The recommended method is **Trusted Publishing (OIDC)**. GitHub and npm create a temporary
credential automatically during each release. You will not copy or save a token.

The [July 2026 announcement](https://github.blog/changelog/2026-07-08-npm-install-time-security-and-gat-bypass2fa-deprecation/)
says that old bypass-2FA access tokens are being restricted and are expected to stop direct
publishing around January 2027. That is another reason not to start with one. The article's npm 12
installation changes are unrelated to creating your publishing pipeline.

### Step 1: Confirm The Account You Created

Your npm username is `techierathore`. Sign in at <https://www.npmjs.com/>, click your profile
picture and confirm that the signed-in profile shows `techierathore`.

### Step 2: Use The Correct Package Name

The npm package will be named:

```json
"name": "@techierathore/ai-first-playbook"
```

Here is what that name means:

- `@techierathore` is your npm account and package scope.
- `ai-first-playbook` is the descriptive package name.

The repository is configured with `@techierathore/ai-first-playbook`. Keep that name consistent
in the repository-root [`/package.json`](../../package.json) file and all documentation/install
commands.

The public package is available at
<https://www.npmjs.com/package/@techierathore/ai-first-playbook>.

### Step 3: Enable Two-Factor Authentication

1. Open your npm account settings.
2. Open **Two-Factor Authentication**.
3. Follow npm's instructions to enable 2FA.
4. Save the recovery codes in your password manager.

You will need 2FA for the first manual publish. Never share the password, 2FA code or recovery
codes with an AI agent.

### Step 4: Prepare The Repository (One Time)

Do this only before the first publish. The repository preparation updates the package name,
repository metadata, documentation, validation scripts and OIDC workflow. It does not need to be
repeated for later releases.

Review the agent's changes and have a human commit and push them to GitHub. The workflow file
`.github/workflows/release.yml` must be present on GitHub before you configure Trusted Publishing.

### Step 5: Perform The First Publish

The npm package must exist before its Trusted Publisher settings are available. Therefore, publish
version `0.1.0` once from your own computer:

1. Open a terminal in this repository.
2. Run `npm login`.
3. Complete npm's browser sign-in and 2FA prompt.
4. Run `npm run validate`.
5. Run `npm run test:guardrails`.
6. Run `npm pack --dry-run` and review the displayed file list.
7. Run `npm publish --access public`.
8. Complete the 2FA prompt if npm asks for it.

Do not add a token to the command. Do not paste a token, password or 2FA code into this document,
GitHub, a screenshot or an AI chat.

After the command succeeds, open
<https://www.npmjs.com/package/@techierathore/ai-first-playbook>.

### Step 6: Connect npm To GitHub Actions

Now that the package exists:

1. Open the package on npmjs.com.
2. Click **Settings**.
3. Find **Trusted publishing** and select **GitHub Actions**.
4. Enter these values:

| npm field | Value |
|---|---|
| Organization or user | `techierathore` |
| Repository | `AI-First-Playbook` |
| Workflow filename | `release.yml` |
| Environment name | Leave blank |
| Allowed action | `npm publish` |

Enter only `release.yml`, not `.github/workflows/release.yml`. Save the configuration.

Official npm instructions: [Trusted Publishing](https://docs.npmjs.com/trusted-publishers/).

### Step 7: Keep Publishing Unattended

Do not bind the npm Trusted Publisher to a GitHub environment. The environment field is optional;
leaving it blank allows `release.yml` to publish without a deployment approval while still using
short-lived OIDC credentials. Do not create an `NPM_TOKEN` secret.

If the publisher was previously configured with `npm-release`, edit the package's Trusted
Publishing settings once and clear **Environment name**. The unused GitHub environment can then be
deleted or left in place; the workflow no longer references it.

### Initial Setup Problems

| Problem | Meaning and action |
|---|---|
| Package page says Not Found | Confirm the exact scoped name and check whether the first manual publish succeeded. |
| npm says scope not found or forbidden | Confirm you are signed in as `techierathore` and the name is exactly `@techierathore/ai-first-playbook`. |
| npm says package name is taken | Choose another package name; existing npm names cannot be claimed. |
| npm returns `402` | Ensure the command includes `--access public`. |
| npm returns `403` | Confirm you are signed in as `techierathore` and complete 2FA. |
| GitHub workflow says `ENEEDAUTH` | Recheck all five Trusted Publisher values and confirm the workflow has `id-token: write`. |

If any credential is exposed, revoke it immediately and review workflow logs for misuse.
