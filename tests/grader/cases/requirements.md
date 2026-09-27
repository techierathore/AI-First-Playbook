# Fixture requirements

| ID | The Playbook … | Check | Source |
|---|---|---|---|
| PB-01 | passes | script: `node tests/grader/cases/pass-check.mjs PB-01` | fixture |
| PB-02 | silent | script: `node tests/grader/cases/silent-exit-zero.mjs` | defect: output-free exit 0 |
| PB-03 | missing script | script: `node tests/grader/cases/never-written.mjs` | defect: TechieFlow FR-47 named a script nobody wrote |
| PB-04 | review | review: a person reads the phase map | fixture |
| PB-05 | crash | fixture: `node tests/grader/cases/crash.mjs` | fixture |
| PB-06 | secret | script: `node tests/grader/cases/secret-output.mjs` | defect: evidence carrying a credential |
| PB-07 | live | ungraded: needs a live model; runbook docs/runbooks/example.md | fixture |
| PB-08 | skip | script: `node tests/grader/cases/skip-check.mjs` | fixture |
| PB-01 | duplicate | review: repeated ID | defect: an ID graded twice |
| PB-09 | no kind | just words | defect: a line with no check kind |
