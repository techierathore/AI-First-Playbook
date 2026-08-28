# npm Version And Package Release Guide

Use this document for every release after the initial npm and OIDC setup is complete.

- npm package: [`@techierathore/ai-first-playbook`](https://www.npmjs.com/package/@techierathore/ai-first-playbook)
- Release workflow: [`.github/workflows/release.yml`](../.github/workflows/release.yml)
- Package manifest: [`/package.json`](../package.json)
- Full manifest path on the current Windows checkout:
  `C:\3AIGenCode\AI-First-Playbook\package.json`
- Repository root on the current Windows checkout:
  `C:\3AIGenCode\AI-First-Playbook`

Do not run `npm publish` manually and do not create an `NPM_TOKEN`. Publishing is performed by
GitHub Actions through npm Trusted Publishing (OIDC).

## 1. Choose The New Version

npm versions cannot be overwritten. Choose the increment based on the change:

| Change | Example | Command |
|---|---|---|
| Patch: backward-compatible fix | `0.1.0` → `0.1.1` | `npm version patch --no-git-tag-version` |
| Minor: backward-compatible feature | `0.1.1` → `0.2.0` | `npm version minor --no-git-tag-version` |
| Major: breaking change | `0.2.0` → `1.0.0` | `npm version major --no-git-tag-version` |

## 2. Update `/package.json`

Open PowerShell and run the chosen version command from the repository root. For a patch release:

```powershell
Set-Location C:\3AIGenCode\AI-First-Playbook
npm version patch --no-git-tag-version
```

This updates the top-level `version` field in
`C:\3AIGenCode\AI-First-Playbook\package.json`. It does not create a Git tag.

Confirm the version:

```powershell
node --print "require('./package.json').version"
```

Use the printed value for the GitHub Release tag. For example, version `0.1.1` requires tag
`v0.1.1`.

## 3. Commit And Push The Package Update

Review the product, documentation, and `/package.json` changes. A human then commits and pushes
them through the repository's normal review process. Agents do not stage, commit, push, or tag.

The commit used for the GitHub Release must contain the new `/package.json` version.

## 4. Publish The GitHub Release

1. Open <https://github.com/techierathore/AI-First-Playbook/releases>.
2. Select **Draft a new release**.
3. Create a tag equal to `v` plus the `/package.json` version, such as `v0.1.1`.
4. Target the commit containing that version.
5. Add release notes describing the package changes.
6. Select **Publish release**.

Publishing the GitHub Release starts `.github/workflows/release.yml`. Merely pushing a tag does
not publish the npm package.

## 5. What CI/CD Does Automatically

The **Publish npm package** workflow:

1. Checks out the exact GitHub Release tag.
2. Installs Node.js 22.14.0 and npm 11.5.1.
3. Verifies that tag `vX.Y.Z` exactly matches `/package.json` version `X.Y.Z`.
4. Runs repository validation.
5. Runs guardrail tests.
6. Runs `npm pack --dry-run`.
7. Checks the release commit for whitespace errors.
8. Publishes the public package through OIDC with npm provenance.

You do not need to run those validation commands manually. A failed check stops publication.

## 6. Approve And Confirm

1. Open the repository's **Actions** tab and select **Publish npm package**.
2. If GitHub pauses at the `npm-release` environment, approve the deployment.
3. Wait for the workflow to finish successfully.
4. Confirm the new version on the
   [npm package page](https://www.npmjs.com/package/@techierathore/ai-first-playbook).

## Release Problems

| Problem | Action |
|---|---|
| Version already exists | Increment `/package.json`; npm versions cannot be overwritten. |
| Tag/version check fails | Make the GitHub Release tag exactly `v` plus the version in `C:\3AIGenCode\AI-First-Playbook\package.json`. |
| Workflow does not start | Confirm you published a GitHub Release; pushing a tag alone is not the configured trigger. |
| Workflow says `ENEEDAUTH` | Recheck npm Trusted Publisher values and confirm the workflow has `id-token: write`. Do not add a token. |
| Workflow waits for approval | Open the deployment and approve the `npm-release` environment. |
| npm page still shows the old version | Wait for the workflow to pass, then reload the npm package page. |
