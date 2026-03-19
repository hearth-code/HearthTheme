import { spawnSync } from "node:child_process";
import { chdir } from "node:process";

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  return result.status ?? 1;
}

console.log("🔄 Syncing themes...");
{
  const status = run("node", ["scripts/sync-themes.mjs"]);
  if (status !== 0) process.exit(status);
}

console.log("🖼️ Generating preview images...");
{
  const status = run("node", ["scripts/generate-preview-images.mjs"]);
  if (status !== 0) process.exit(status);
}

console.log("📦 Packaging extension...");
chdir("extension");

const packCandidates = [
  ["pnpm", ["dlx", "@vscode/vsce", "package", "--no-dependencies", "--skip-license"]],
  ["pnpm", ["exec", "vsce", "package", "--no-dependencies", "--skip-license"]],
  ["npx", ["vsce", "package", "--no-dependencies", "--skip-license"]],
];

let packed = false;
for (const [cmd, args] of packCandidates) {
  console.log(`➡️  Try: ${cmd} ${args.join(" ")}`);
  const status = run(cmd, args);
  if (status === 0) {
    packed = true;
    break;
  }
}

if (!packed) {
  console.error("❌ Packaging failed. Try closing VS Code/antivirus and run again.");
  process.exit(1);
}

console.log("✅ Done!");
