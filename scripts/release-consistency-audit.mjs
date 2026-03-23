import { readFileSync } from "node:fs";
import path from "node:path";
import {
  RELEASE_METADATA_PATH,
  readReleaseMetadata,
} from "./release-metadata.mjs";

const ROOT = process.cwd();
const EXTENSION_PKG = path.join(ROOT, "extension", "package.json");
const EXTENSION_CHANGELOG = path.join(ROOT, "extension", "CHANGELOG.md");
const LAYOUT_FILE = path.join(ROOT, "src", "layouts", "Layout.astro");

const findings = [];

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function readText(file) {
  return readFileSync(file, "utf8");
}

function firstChangelogVersion(markdown) {
  const match = markdown.match(/^##\s+(\d+\.\d+\.\d+)/m);
  return match?.[1] ?? null;
}

try {
  const releaseMeta = readReleaseMetadata();
  const releaseVersion = String(releaseMeta.version ?? "").trim();
  const pkg = readJson(EXTENSION_PKG);
  const pkgVersion = String(pkg.version ?? "").trim();
  const pkgPublisher = String(pkg.publisher ?? "").trim();
  const pkgName = String(pkg.name ?? "").trim();
  const changelogVersion = firstChangelogVersion(readText(EXTENSION_CHANGELOG));
  const expectedMarketplaceUrl =
    pkgPublisher && pkgName
      ? `https://marketplace.visualstudio.com/items?itemName=${pkgPublisher}.${pkgName}`
      : null;

  if (!pkgVersion) {
    findings.push("extension/package.json is missing `version`.");
  }

  if (!releaseVersion) {
    findings.push(`${RELEASE_METADATA_PATH} is missing \`version\`.`);
  }

  if (!pkgPublisher || !pkgName) {
    findings.push("extension/package.json is missing `publisher` or `name`.");
  }

  if (releaseVersion && pkgVersion && releaseVersion !== pkgVersion) {
    findings.push(
      `release version mismatch: ${RELEASE_METADATA_PATH}=${releaseVersion}, extension/package.json=${pkgVersion}.`,
    );
  }

  if (!changelogVersion) {
    findings.push("extension/CHANGELOG.md is missing a `## X.Y.Z` release heading.");
  } else if (releaseVersion && releaseVersion !== changelogVersion) {
    findings.push(
      `release version mismatch: ${RELEASE_METADATA_PATH}=${releaseVersion}, extension/CHANGELOG.md top=${changelogVersion}.`,
    );
  }

  const layoutSource = readText(LAYOUT_FILE);
  if (!expectedMarketplaceUrl || !layoutSource.includes(expectedMarketplaceUrl)) {
    findings.push(
      `install link in src/layouts/Layout.astro should point to ${expectedMarketplaceUrl ?? "publisher.name"}.`,
    );
  }
} catch (error) {
  findings.push(`audit crashed: ${error.message}`);
}

if (findings.length > 0) {
  console.error("[FAIL] Release consistency audit found issues:");
  for (const finding of findings) {
    console.error(`  - ${finding}`);
  }
  process.exit(1);
}

console.log("[PASS] Release consistency audit passed.");
