# Troubleshooting

| Symptom | Action |
|---|---|
| Plugin not loaded | Restart OpenCode and validate `opencode.json`. |
| `DATA-GAP` | Seed approved synthetic data and verify again; do not release. |
| `BLOCKED` | Resolve the profile blocker or record an expiring exception. |
| Secret in evidence | Rotate it, remove the artifact and rerun with redaction. |
| Verifier write denied | Write only the selected checklist or `verification/<feature>/<run-id>/`. |
