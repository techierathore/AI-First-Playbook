# npm Publishing Guide

Package: [`@techierathore/ai-first-playbook`](https://www.npmjs.com/package/@techierathore/ai-first-playbook)

The package manifest is the `package.json` file at the **repository root**:

- Repository path: [`/package.json`](../package.json)
- Path on the current Windows checkout:
  `C:\3AIGenCode\AI-First-Playbook\package.json`

Commands in this guide must be run from the repository root:
`C:\3AIGenCode\AI-First-Playbook`.

## Current State And What To Do Next

The one-time setup is complete after all of the following are true:

- version `0.1.0` has been published manually;
- npm Trusted Publishing points to this repository and `release.yml`;
- the GitHub `npm-release` environment exists; and
- `.github/workflows/release.yml` is committed and present on GitHub.

The **Prompt To Give An AI Agent is no longer needed** after repository preparation. It was a
one-time prompt, not a release step. For every later version, follow
[Publish Later Versions](#publish-later-versions) below. Do not create an npm token and do not run
another manual `npm publish` once OIDC is working.

## The Short Answer About Access Tokens

**Do not create an npm Access Token for this GitHub Actions pipeline.**

The recommended method is **Trusted Publishing (OIDC)**. GitHub and npm create a temporary
credential automatically during each release. You will not copy or save a token.

The [July 2026 announcement](https://github.blog/changelog/2026-07-08-npm-install-time-security-and-gat-bypass2fa-deprecation/)
says that old bypass-2FA access tokens are being restricted and are expected to stop direct
publishing around January 2027. That is another reason not to start with one. The article's npm 12
installation changes are unrelated to creating your publishing pipeline.

## Step 1: Confirm The Account You Created

Your npm username is `techierathore`. Sign in at <https://www.npmjs.com/>, click your profile
picture and confirm that the signed-in profile shows `techierathore`.

## Step 2: Use The Correct Package Name

The npm package will be named:

```json
"name": "@techierathore/ai-first-playbook"
```

Here is what that name means:

- `@techierathore` is your npm account and package scope.
- `ai-first-playbook` is the descriptive package name.

The repository is configured with `@techierathore/ai-first-playbook`. Keep that name consistent
in the repository-root [`/package.json`](../package.json) file and all documentation/install
commands.

The public package is available at
<https://www.npmjs.com/package/@techierathore/ai-first-playbook>.

## Step 3: Enable Two-Factor Authentication

1. Open your npm account settings.
2. Open **Two-Factor Authentication**.
3. Follow npm's instructions to enable 2FA.
4. Save the recovery codes in your password manager.

You will need 2FA for the first manual publish. Never share the password, 2FA code or recovery
codes with an AI agent.

## Step 4: Prepare The Repository (One Time)

Do this only before the first publish. The repository preparation updates the package name,
repository metadata, documentation, validation scripts and OIDC workflow. It does not need to be
repeated for later releases.

Review the agent's changes and have a human commit and push them to GitHub. The workflow file
`.github/workflows/release.yml` must be present on GitHub before you configure Trusted Publishing.

## Step 5: Perform The First Publish

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

## Step 6: Connect npm To GitHub Actions

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
| Environment name | `npm-release` |
| Allowed action | `npm publish` |

Enter only `release.yml`, not `.github/workflows/release.yml`. Save the configuration.

Official npm instructions: [Trusted Publishing](https://docs.npmjs.com/trusted-publishers/).

## Step 7: Create The GitHub Environment

1. Open <https://github.com/techierathore/AI-First-Playbook>.
2. Click **Settings -> Environments -> New environment**.
3. Enter `npm-release` and click **Configure environment**.
4. Optionally add yourself as a required reviewer.
5. Do not create an `NPM_TOKEN` secret.

## Publish Later Versions

The next publish must use a new version because npm versions cannot be overwritten. For example,
to release `0.1.1` after `0.1.0`:

1. Start from the latest default branch and make the intended product/documentation changes.
2. Open `C:\3AIGenCode\AI-First-Playbook\package.json` and change its top-level `version` value
   from `0.1.0` to `0.1.1`.

   Alternatively, PowerShell can update that same repository-root file automatically:

   ```powershell
   Set-Location C:\3AIGenCode\AI-First-Playbook
   npm version patch --no-git-tag-version
   ```

   Confirm the result in PowerShell:

   ```powershell
   node --print "require('./package.json').version"
   ```

3. Have a human commit and push the version and release changes through the normal review process.
4. On GitHub, open **Releases → Draft a new release**.
5. Create tag `v0.1.1`, targeting the commit containing package version `0.1.1`.
6. Add release notes and publish the GitHub Release.
7. The **Publish npm package** workflow validates that tag `v0.1.1` exactly matches package
   version `0.1.1`, runs repository validation, guardrail tests, `npm pack --dry-run`, and the Git
   whitespace check, then publishes through OIDC with provenance. You do not need to run those
   commands manually.
8. Approve the `npm-release` environment if GitHub requests approval.
9. Confirm the workflow is green and verify the version on the
   [npm package page](https://www.npmjs.com/package/@techierathore/ai-first-playbook).

Do not run another manual `npm publish` after Trusted Publishing is working.

## Common Problems

| Problem | Meaning and action |
|---|---|
| Package page says Not Found | Confirm the exact scoped name and check whether the first manual publish succeeded. |
| npm says scope not found or forbidden | Confirm you are signed in as `techierathore` and the name is exactly `@techierathore/ai-first-playbook`. |
| npm says package name is taken | Choose another package name; existing npm names cannot be claimed. |
| npm returns `402` | Ensure the command includes `--access public`. |
| npm returns `403` | Confirm you are signed in as `techierathore` and complete 2FA. |
| GitHub workflow says `ENEEDAUTH` | Recheck all five Trusted Publisher values and confirm the workflow has `id-token: write`. |
| Version already exists | Increase the version. npm versions cannot be overwritten. |
| Workflow says the ref is not a tag | Publish a GitHub Release with tag `vX.Y.Z`; do not run the workflow from a branch. |
| Tag does not match package version | Read the version from repository-root `/package.json` (`C:\3AIGenCode\AI-First-Playbook\package.json`) and make the tag exactly `v` plus that value, such as `v0.1.1`. |

If any credential is exposed, revoke it immediately and review workflow logs for misuse.
