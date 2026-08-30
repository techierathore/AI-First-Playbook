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
5. Add release notes describing the package changes.
6. Select **Publish release**.

Publishing the GitHub Release starts `.github/workflows/release.yml`. Merely pushing a tag does
not publish the npm package.

The release tag supplies the npm version. The workflow validates the derived version and rejects a
version that already exists before publishing.

## 5. What CI/CD Does Automatically

The **Publish npm package** workflow:

1. Checks out the exact GitHub Release tag.
2. Installs Node.js 22.14.0 and npm 11.5.1.
3. Validates the `vX.Y.Z` release tag and applies `X.Y.Z` to the runner's package manifest.
4. Verifies that `X.Y.Z` does not already exist on npm.
5. Runs repository validation, guardrail tests and miss-telemetry tests.
6. Runs `npm pack --dry-run`.
7. Checks the release commit for whitespace errors.
8. Publishes stable versions under npm tag `latest` and prereleases under `next`, through OIDC
   with npm provenance.

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
