import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? ".");
const skippedDirectories = new Set([".git", "node_modules", "verification"]);
const markdownFiles = [];
const broken = [];

function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && skippedDirectories.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(absolute);
    else if (entry.isFile() && entry.name.endsWith(".md")) markdownFiles.push(absolute);
  }
}

visit(root);
const markdownLink = /!?\[[^\]]*\]\(([^)]+)\)/g;
for (const file of markdownFiles) {
  const text = fs.readFileSync(file, "utf8");
  for (const match of text.matchAll(markdownLink)) {
    const raw = match[1].trim();
    if (/^<[^>]+>$/.test(raw) && /\s/.test(raw)) continue;
    let target = raw.replace(/^<|>$/g, "").split(/\s+["']/)[0];
    if (!target || target.startsWith("#") || /^(https?:|mailto:|tel:|data:)/i.test(target) || /[<>*]/.test(target)) continue;
    try {
      target = decodeURIComponent(target.split("#")[0].split("?")[0]);
    } catch {
      continue;
    }
    if (!fs.existsSync(path.resolve(path.dirname(file), target))) {
      broken.push(`${path.relative(root, file)}:${text.slice(0, match.index).split("\n").length}: ${raw}`);
    }
  }
}

console.log(`markdown_files=${markdownFiles.length}`);
console.log(`broken_relative_links=${broken.length}`);
if (broken.length) {
  console.log(broken.join("\n"));
  process.exit(1);
}
