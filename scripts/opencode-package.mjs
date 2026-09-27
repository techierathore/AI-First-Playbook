#!/usr/bin/env node
/**
 * opencode-package.mjs — the npm package spec for a supported OpenCode.
 *
 *   node scripts/opencode-package.mjs 2.0.18   → @opencode/cli@2.0.18
 *   node scripts/opencode-package.mjs 1        → opencode-ai@1.18.32 (the supported 1.x)
 *
 * The supported versions are `package.json` `opencode.supported`. OpenCode 1
 * ships as `opencode-ai`, OpenCode 2 as `@opencode/cli`; both install an
 * `opencode` binary, so a machine (or CI job) runs one at a time. Exits 2 for
 * a version that is not supported.
 */
import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

const PACKAGES = { 1: "opencode-ai", 2: "@opencode/cli" };

export function supportedVersions(pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"))) {
  const supported = pkg.opencode?.supported;
  return Array.isArray(supported) ? supported : [supported].filter(Boolean);
}

export function packageSpec(request, supported = supportedVersions()) {
  const version = supported.find((v) => v === request || v.split(".")[0] === String(request));
  if (!version) return null;
  const name = PACKAGES[version.split(".")[0]];
  return name ? `${name}@${version}` : null;
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const request = process.argv[2];
  const spec = request && packageSpec(request);
  if (!spec) {
    console.error(`opencode-package: ${request ?? "(none)"} is not a supported OpenCode version; supported: ${supportedVersions().join(", ")}`);
    process.exit(2);
  }
  console.log(spec);
}
