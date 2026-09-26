// Shared result protocol for every check the grader calls
// (scripts/playbook-grade.mjs): `<ID> pass|fail|ungraded: <detail>`.
import { fileURLToPath } from "node:url";

export const repoRoot = fileURLToPath(new URL("..", import.meta.url));

export function requirementId(fallback) {
  return process.argv.slice(2).find((a) => /^PB-\d{2,}$/.test(a)) ?? process.env.PLAYBOOK_GRADE_ID ?? fallback;
}

/** Run named cases; print one line per case and one verdict line for the ID. */
export async function runCases(id, cases) {
  const failures = [];
  for (const [name, fn] of cases) {
    try {
      await fn();
      console.log(`ok - ${name}`);
    } catch (error) {
      failures.push(name);
      console.log(`not ok - ${name}: ${error.message}`);
    }
  }
  if (failures.length) {
    console.log(`${id} fail: ${failures.length} of ${cases.length} case(s) failed: ${failures.join(", ")}`);
    process.exit(1);
  }
  console.log(`${id} pass: ${cases.length} case(s)`);
}

export function ungraded(id, reason) {
  console.log(`${id} ungraded: ${reason}`);
  process.exit(77);
}

export function assert(condition, message) {
  if (!condition) throw new Error(message);
}
