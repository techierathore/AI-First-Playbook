#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const statePath = process.argv[2];
if (!statePath || !existsSync(statePath)) process.exit(0);
const state = JSON.parse(readFileSync(statePath, "utf8"));
const target = state.target;
const nm = join(target, "node_modules");
const packageRoot = join(nm, "@techierathore", "ai-first-playbook");
const scope = join(nm, "@techierathore");
const pkgName = "@techierathore/ai-first-playbook";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Decide at cleanup time (after npm has finished placing packages), not at
// preinstall time — by then npm has already created node_modules in a clean dir,
// so "does node_modules exist" is not a valid signal for a pre-existing project.
const hasForeignPackages = () => {
  if (!existsSync(nm)) return false;
  for (const entry of readdirSync(nm)) {
    if (entry.startsWith(".") || entry === "node_modules") continue;
    if (entry === "@techierathore") {
      if (existsSync(scope) && readdirSync(scope).some((p) => p !== "ai-first-playbook")) return true;
      continue;
    }
    return true;
  }
  return false;
};

const removeShims = () => {
  const bin = join(nm, ".bin");
  if (!existsSync(bin)) return;
  for (const shim of readdirSync(bin)) if (shim.startsWith("ai-first-playbook")) rmSync(join(bin, shim), { force: true });
};

let done = false;
for (let attempt = 0; attempt < 120 && !done; attempt++) {
  try {
    if (hasForeignPackages()) {
      // A real project: remove only our footprint and drop our dependency entry.
      rmSync(packageRoot, { recursive: true, force: true });
      if (existsSync(scope) && readdirSync(scope).length === 0) rmSync(scope, { recursive: true, force: true });
      removeShims();
      const pkgPath = join(target, "package.json");
      if (existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
          let changed = false;
          for (const key of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
            if (pkg[key] && pkg[key][pkgName] != null) { delete pkg[key][pkgName]; changed = true; }
          }
          if (changed) writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
        } catch { /* best effort */ }
      }
    } else {
      // Clean dir: npm only created our artifacts — remove them all.
      rmSync(nm, { recursive: true, force: true });
      rmSync(join(target, "package.json"), { force: true });
      rmSync(join(target, "package-lock.json"), { force: true });
    }
    done = true;
  } catch {
    // npm or its command shell may still hold Windows handles; retry briefly.
  }
  if (!done) await sleep(100);
}
rmSync(statePath, { force: true });
