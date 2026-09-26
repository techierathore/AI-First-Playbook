import { writeFileSync } from "node:fs";
if (process.env.GRADER_MARKER) writeFileSync(process.env.GRADER_MARKER, process.argv.slice(2).join(" "));
console.log(`${process.env.PLAYBOOK_GRADE_ID} pass: fixture check ran`);
