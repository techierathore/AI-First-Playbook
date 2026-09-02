import fs from "node:fs";

const specs = [
  {
    path: "docs/Getting-Started.md",
    lines: 601,
    headings: ["## 1. Installation", "## 2. Prerequisites", "## 10. End-to-end operating flow", "## 11. Command catalogue", "## 13. Telemetry"],
  },
  {
    path: "docs/Brownfield-Case-Study.md",
    lines: 537,
    headings: ["## SDLC-to-AIFP Phase Mapping", "## 6. Product Baseline Before Code Changes", "### Step 7 — Fresh Verification of Old and New Paths (SDLC: Testing/Verification)", "## 9. Compatibility Verification Matrix", "## 10. Rollback Drill"],
  },
  {
    path: "docs/Greenfield-Case-Study.md",
    lines: 540,
    headings: ["## 3. Greenfield lifecycle flow", "## 7. Exact input pack before `/feature-plan`", "## 12. Executable SDLC — step-by-step runbook", "## 15. Failure routes"],
  },
  {
    path: "docs/Telemetry-Guide.md",
    lines: 232,
    headings: ["## 2. Quick start (OpenCode)", "## 3. Reading the numbers — three worked questions", "## 4. Trust rules", "## 7. Miss telemetry — durable defect and rework history"],
  },
  {
    path: "docs/YOLO-Mode-Guide.md",
    lines: 244,
    headings: ["## 1. Turning it on", "## 2. What the agent may do in YOLO mode", "## 3. The completion contract (build phase)", "## 4. Usage-limit handling", "## 9. Troubleshooting"],
  },
];

let failed = false;
for (const spec of specs) {
  const text = fs.readFileSync(spec.path, "utf8");
  const rows = text.split("\n");
  const lineCount = rows.length - 1;
  const headingCount = rows.filter((line) => /^#{1,4} /.test(line)).length;
  const fenceCount = rows.filter((line) => line.startsWith("```")).length;
  const tableRowCount = rows.filter((line) => /^\|.*\|$/.test(line)).length;
  const wordCount = text.trim().split(/\s+/).length;
  const missingHeadings = spec.headings.filter((heading) => !text.includes(heading));
  const material = headingCount >= 10 && wordCount >= 1000 && missingHeadings.length === 0;
  const exactLength = lineCount === spec.lines;
  console.log(`${spec.path}: lines=${lineCount}/${spec.lines} headings=${headingCount} fences=${fenceCount} table_rows=${tableRowCount} words=${wordCount} required_sections=${spec.headings.length - missingHeadings.length}/${spec.headings.length}`);
  if (!exactLength || !material) {
    failed = true;
    if (missingHeadings.length) console.log(`missing_sections=${missingHeadings.join(" | ")}`);
  }
}

if (failed) process.exit(1);
console.log("long_form_documentation_materiality=PASS");
