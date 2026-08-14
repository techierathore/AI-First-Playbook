import { readFileSync } from "node:fs";
const source = readFileSync(new URL("../harness/opencode/plugins/spec-guardrails.ts", import.meta.url), "utf8");
const required = ["normalizePath", "traverses the repository", "isSymbolicLink", "shellWriteTargets", "apply_patch", "verification/"];
const missing = required.filter((term) => !source.includes(term));
if (missing.length) { console.error(`guardrail coverage missing: ${missing.join(", ")}`); process.exit(1); }
console.log("guardrail policy coverage passed");
