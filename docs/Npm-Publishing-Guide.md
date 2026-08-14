# Npm Publishing Guide

This is for the person who owns the public package. Regular users only need
[`Installation.md`](Installation.md).

## One-Time Setup In A Browser

### Create The npm Account

1. Open <https://www.npmjs.com/signup>.
2. Create the account with your email address and a strong password.
3. Open the verification email and confirm the account.
4. Open your npm profile, choose **Access Tokens**, and choose **Generate New Token**.
5. Create a granular token with package publish permission. Give it the shortest practical
   expiry and restrict it to the `@ai-first/playbook` package after the first publish if npm
   offers that option.
6. Copy the token once into your approved password manager. Do not put it in a document, URL,
   screenshot, terminal command or chat message.

### Confirm The Package Name

1. Open <https://www.npmjs.com/package/@ai-first/playbook>.
2. If the package does not exist and the `ai-first` scope belongs to your npm account or
   organization, keep the name in `package.json`.
3. If the scope is unavailable, change the `name` in `package.json` to a public name you control,
   then use that same name in every install command and this guide.

### Add The GitHub Secret

1. Open the GitHub repository in a browser.
2. Choose **Settings -> Environments -> New environment**.
3. Name it `npm-release`.
4. Add required reviewers if another person must approve releases.
5. Under **Environment secrets**, choose **Add secret**.
6. Name the secret `NPM_TOKEN`, paste the npm token from the password manager, and save it.
7. Never click a workflow log link that could print the token. The workflow uses the secret only
   through `NODE_AUTH_TOKEN`.

## Publish A Release From GitHub

1. In the repository, open `package.json` in the GitHub web editor.
2. Change the `version`, for example from `0.1.0` to `0.1.1`.
3. Choose **Commit changes** and commit to the default branch through the normal review process.
4. Open **Releases -> Draft a new release**.
5. In **Choose a tag**, type the matching version tag, such as `v0.1.1`, and choose **Create new
   tag on publish**.
6. Add release notes describing installer, command, agent or documentation changes.
7. Choose **Publish release**.
8. Open the **Actions** tab and select **Publish npm package**.
9. Wait for the green workflow result. If GitHub pauses for approval, an environment reviewer
   chooses **Review deployments -> Approve and deploy**.
10. Open <https://www.npmjs.com/package/@ai-first/playbook> and confirm the new version appears.

The workflow validates the repository, checks guardrails, creates the package tarball and runs
`npm publish --access public --provenance`. The release tag must match the package version.

## Test The Published Package

Create or choose a disposable project folder, then open PowerShell, Terminal or Command Prompt:

```text
npx @ai-first/playbook@0.1.1 --target="C:\work\demo-project" --dry-run
```

Replace the version and path for your machine. Review the listed files, then remove `--dry-run`.
Open the target project in OpenCode, restart OpenCode, replace the environment-profile
placeholders, and run the planted guardrail smoke test.

## If Publishing Fails

| Message | Action |
|---|---|
| `403` or not authorized | Confirm the npm account owns the package/scope and the token has publish permission. |
| `402` or private package | Confirm `publishConfig.access` is `public`. |
| `version already exists` | Increase `version`; npm versions cannot be overwritten. |
| workflow waiting for approval | Approve the `npm-release` environment deployment. |
| package name unavailable | Choose a name/scope controlled by your npm account and update `package.json`. |
| token expired | Create a replacement token, update the GitHub environment secret, and revoke the old token. |

Never paste the token into an issue or workflow log. Rotate it immediately if it is exposed.
