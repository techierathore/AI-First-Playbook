#!/usr/bin/env node
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const invocationRoot = process.env.INIT_CWD ? resolve(process.env.INIT_CWD) : null;
const dependencyInstall = ["install", "ci"].includes(process.env.npm_command)
  && invocationRoot
  && invocationRoot !== packageRoot;

if (dependencyInstall) {
  console.error([
    "AI-First Playbook is a one-shot framework installer, not an application dependency.",
    "Do not use: npm install @techierathore/ai-first-playbook",
    "Use instead: npx @techierathore/ai-first-playbook@latest install",
  ].join("\n"));
  process.exit(1);
}
