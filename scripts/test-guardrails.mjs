import { readFileSync, existsSync } from "node:fs";
const policyUrl = new URL("../harness/opencode/plugin/write-policy.mjs", import.meta.url);
const source = readFileSync(policyUrl, "utf8");
const required = ["normalizePath", "traverses the repository", "isSymbolicLink", "shellWriteTargets", "apply_patch", "verification/"];
const missing = required.filter((term) => !source.includes(term));
if (missing.length) { console.error(`guardrail coverage missing: ${missing.join(", ")}`); process.exit(1); }
for (const carrier of ["../harness/opencode/plugin/spec-guardrails.ts", "../harness/claude-code/hooks/spec-guardrails-hook.mjs"]) {
  const url = new URL(carrier, import.meta.url);
  if (!existsSync(url)) { console.error(`guardrail carrier missing: ${carrier}`); process.exit(1); }
  if (!readFileSync(url, "utf8").includes("write-policy.mjs")) { console.error(`guardrail carrier does not use shared policy: ${carrier}`); process.exit(1); }
}
const { evaluateToolCall } = await import(policyUrl);
const blocked = evaluateToolCall({ tool: "write", args: { filePath: "Feature-Gap-Report.md" }, isVerifier: true });
const allowed = evaluateToolCall({ tool: "write", args: { filePath: "verification/feature/run-1/probe.cs" }, isVerifier: true });
if (!blocked || allowed) { console.error("guardrail policy behavioral check failed"); process.exit(1); }
console.log("guardrail policy coverage passed");
