import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  COLOR_SYSTEM_SCHEME_ID,
  loadColorSystemTuning,
  loadColorSystemVariants,
  loadRoleAdapters,
} from "./color-system.mjs";
import {
  clamp,
  contrastRatio,
  deltaE,
  hslToHex,
  hueDistance,
  normalizeHex,
  rgbToHsl,
} from "./color-utils.mjs";

const REPORT_DIR = join("reports", "color-optimization");
const REPORT_JSON_PATH = join(REPORT_DIR, `${COLOR_SYSTEM_SCHEME_ID}.json`);
const REPORT_MD_PATH = join(REPORT_DIR, `${COLOR_SYSTEM_SCHEME_ID}.md`);
const ROLE_IDS = ["keyword", "function", "method", "property", "type", "number", "string"];
const HIGH_EXPOSURE_ROLE_IDS = ["keyword", "operator", "function", "method", "property", "string", "number", "type", "variable"];
const NEUTRAL_SATURATION_THRESHOLD = 0.08;
const HUE_BUCKET_SPAN = 45;
const HUE_BUCKET_COUNT = 360 / HUE_BUCKET_SPAN;
const RHYTHM_TARGETS = {
  dominantHueBandShare: 0.3,
  adjacentHueBandShare: 0.52,
  activeHueBandShare: 0.08,
  activeHueBandCount: 4,
};
const VARIANT_TARGETS = {
  dark: { minContrast: 5.6, saturationCeiling: 0.74, materialDeltaBudget: 7 },
  darkSoft: { minContrast: 5.0, saturationCeiling: 0.62, materialDeltaBudget: 6 },
  light: { minContrast: 3.3, saturationCeiling: 0.72, materialDeltaBudget: 7 },
  lightSoft: { minContrast: 2.9, saturationCeiling: 0.66, materialDeltaBudget: 6 },
};

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

function writeText(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content.endsWith("\n") ? content : `${content}\n`);
}

function round(value, digits = 3) {
  if (value == null || Number.isNaN(value)) return null;
  return Number(value.toFixed(digits));
}

function fixed(value, digits = 2) {
  if (value == null || Number.isNaN(value)) return "n/a";
  return Number(value).toFixed(digits);
}

function toScopes(entry) {
  if (!entry?.scope) return [];
  return Array.isArray(entry.scope) ? entry.scope : [entry.scope];
}

function getTokenColor(theme, scopes) {
  if (!Array.isArray(scopes) || scopes.length === 0) return null;

  let bestColor = null;
  let bestRatio = -1;
  let bestCount = -1;
  let bestScopeLength = Number.POSITIVE_INFINITY;

  for (const entry of theme.tokenColors || []) {
    const entryScopes = toScopes(entry);
    const count = entryScopes.filter((scope) => scopes.includes(scope)).length;
    if (count === 0) continue;

    const color = entry.settings?.foreground ? normalizeHex(entry.settings.foreground) : null;
    if (!color) continue;

    const ratio = count / entryScopes.length;
    const isBetter =
      ratio > bestRatio ||
      (ratio === bestRatio && count > bestCount) ||
      (ratio === bestRatio && count === bestCount && entryScopes.length < bestScopeLength);

    if (!isBetter) continue;

    bestColor = color;
    bestRatio = ratio;
    bestCount = count;
    bestScopeLength = entryScopes.length;
  }

  return bestColor;
}

function getSemanticColor(theme, semanticKey) {
  const value = theme.semanticTokenColors?.[semanticKey];
  if (!value) return null;
  if (typeof value === "string") return normalizeHex(value);
  if (typeof value === "object" && value.foreground) return normalizeHex(value.foreground);
  return null;
}

function getRoleColor(theme, roleDef) {
  return getTokenColor(theme, roleDef.scopes || [])
    ?? (roleDef.semanticKeys || []).map((key) => getSemanticColor(theme, key)).find(Boolean)
    ?? null;
}

function normalizeContractLane(lane) {
  const [hueMin, hueMax] = lane.hueBand || [];
  return {
    hueMin,
    hueMax,
    minSaturation: lane.minSaturation,
  };
}

function getLaneForRole(contract, roleId) {
  for (const lane of Object.values(contract.signalLanes || {})) {
    if ((lane.roles || []).includes(roleId)) return normalizeContractLane(lane);
  }
  return null;
}

function hueInBand(hue, min, max) {
  if (hue == null || min == null || max == null) return false;
  if (min <= max) return hue >= min && hue <= max;
  return hue >= min || hue <= max;
}

function laneHueDistance(hue, lane) {
  if (!lane || hueInBand(hue, lane.hueMin, lane.hueMax)) return 0;
  return Math.min(hueDistance(hue, lane.hueMin), hueDistance(hue, lane.hueMax));
}

function laneCenter(lane) {
  if (!lane) return null;
  if (lane.hueMin <= lane.hueMax) return (lane.hueMin + lane.hueMax) / 2;
  return ((lane.hueMin + lane.hueMax + 360) / 2) % 360;
}

function getHighExposureRoleWeights(tuning) {
  const fallback = Object.fromEntries(HIGH_EXPOSURE_ROLE_IDS.map((roleId) => [roleId, 1 / HIGH_EXPOSURE_ROLE_IDS.length]));
  const profile = tuning?.roleLaneProfile?.warmExposureProfile;
  if (!profile) return fallback;

  const rawWeights = {};
  for (const roleId of HIGH_EXPOSURE_ROLE_IDS) {
    let weightedFrequency = 0;
    for (const [languageId, mixWeight] of Object.entries(profile.languageMixWeights || {})) {
      const frequency = profile.roleFrequencyByLanguage?.[languageId]?.[roleId];
      if (typeof frequency === "number") {
        weightedFrequency += mixWeight * frequency;
      }
    }
    const saliency = typeof profile.saliencyByRole?.[roleId] === "number"
      ? profile.saliencyByRole[roleId]
      : 1;
    rawWeights[roleId] = weightedFrequency * saliency;
  }

  const total = Object.values(rawWeights).reduce((sum, value) => sum + value, 0);
  if (!(total > 0)) return fallback;
  return Object.fromEntries(Object.entries(rawWeights).map(([roleId, value]) => [roleId, value / total]));
}

function hueBucketLabel(index) {
  return `${index * HUE_BUCKET_SPAN}-${index * HUE_BUCKET_SPAN + HUE_BUCKET_SPAN - 1}`;
}

function emptyHueBuckets() {
  const buckets = {
    neutral: {
      label: "neutral",
      weight: 0,
      roles: [],
      share: 0,
      shareChromatic: null,
    },
  };
  for (let index = 0; index < HUE_BUCKET_COUNT; index += 1) {
    buckets[`band-${index}`] = {
      label: hueBucketLabel(index),
      weight: 0,
      roles: [],
      share: 0,
      shareChromatic: 0,
    };
  }
  return buckets;
}

function getHueBucketKey(color) {
  const hsl = rgbToHsl(color);
  if (!hsl || hsl.s < NEUTRAL_SATURATION_THRESHOLD) return "neutral";
  return `band-${Math.floor(hsl.h / HUE_BUCKET_SPAN) % HUE_BUCKET_COUNT}`;
}

function rhythmRiskLevel(risk) {
  if (risk >= 0.75) return "high";
  if (risk >= 0.4) return "watch";
  if (risk >= 0.18) return "notice";
  return "balanced";
}

function describeRhythmCause(metrics) {
  const causes = [];
  if (metrics.topAdjacentShare > RHYTHM_TARGETS.adjacentHueBandShare) {
    causes.push(`adjacent hue pressure ${fixed(metrics.topAdjacentShare * 100, 1)}%`);
  }
  if (metrics.dominantShare > RHYTHM_TARGETS.dominantHueBandShare) {
    causes.push(`dominant band ${fixed(metrics.dominantShare * 100, 1)}%`);
  }
  if (metrics.activeHueBandCount < RHYTHM_TARGETS.activeHueBandCount) {
    causes.push(`${metrics.activeHueBandCount} active chromatic bands`);
  }
  return causes.join("; ") || "chromatic weight is well distributed";
}

function buildRhythmDiagnostics(themesByVariant, roleAdapters, roleWeights) {
  const diagnostics = {};

  for (const [variantId, theme] of Object.entries(themesByVariant)) {
    const buckets = emptyHueBuckets();
    let totalWeight = 0;

    for (const roleId of HIGH_EXPOSURE_ROLE_IDS) {
      const roleDef = roleAdapters[roleId];
      const color = roleDef ? getRoleColor(theme, roleDef) : null;
      const roleWeight = roleWeights[roleId] ?? 0;
      if (!color || !(roleWeight > 0)) continue;

      const bucketKey = getHueBucketKey(color);
      buckets[bucketKey].weight += roleWeight;
      buckets[bucketKey].roles.push(roleId);
      totalWeight += roleWeight;
    }

    const chromaticWeight = Object.entries(buckets)
      .filter(([key]) => key !== "neutral")
      .reduce((sum, [, bucket]) => sum + bucket.weight, 0);
    for (const bucket of Object.values(buckets)) {
      bucket.weight = round(bucket.weight, 4);
      bucket.share = round(totalWeight > 0 ? bucket.weight / totalWeight : 0, 4);
      bucket.shareChromatic = bucket.label === "neutral"
        ? null
        : round(chromaticWeight > 0 ? bucket.weight / chromaticWeight : 0, 4);
    }

    const chromaticBuckets = Object.entries(buckets).filter(([key]) => key !== "neutral");
    const dominantBucket = chromaticBuckets.reduce((best, current) => (
      current[1].weight > best[1].weight ? current : best
    ), chromaticBuckets[0]);
    let adjacentPair = null;
    let adjacentPairWeight = -1;
    for (let index = 0; index < HUE_BUCKET_COUNT; index += 1) {
      const left = buckets[`band-${index}`];
      const right = buckets[`band-${(index + 1) % HUE_BUCKET_COUNT}`];
      const weight = left.weight + right.weight;
      if (weight > adjacentPairWeight) {
        adjacentPairWeight = weight;
        adjacentPair = [left.label, right.label];
      }
    }

    const dominantShare = chromaticWeight > 0 ? dominantBucket[1].weight / chromaticWeight : 0;
    const topAdjacentShare = chromaticWeight > 0 ? adjacentPairWeight / chromaticWeight : 0;
    const activeHueBandCount = chromaticBuckets.filter(([, bucket]) => (
      chromaticWeight > 0 && bucket.weight / chromaticWeight >= RHYTHM_TARGETS.activeHueBandShare
    )).length;
    const dominantPressure = Math.max(0, dominantShare - RHYTHM_TARGETS.dominantHueBandShare) / 0.12;
    const adjacentPressure = Math.max(0, topAdjacentShare - RHYTHM_TARGETS.adjacentHueBandShare) / 0.12;
    const sparsePressure = Math.max(0, RHYTHM_TARGETS.activeHueBandCount - activeHueBandCount) / RHYTHM_TARGETS.activeHueBandCount;
    const risk = clamp(Math.max(dominantPressure, adjacentPressure, sparsePressure), 0, 1);

    diagnostics[variantId] = {
      totalWeight: round(totalWeight, 4),
      chromaticWeight: round(chromaticWeight, 4),
      neutralShare: round(totalWeight > 0 ? buckets.neutral.weight / totalWeight : 0, 4),
      dominantHueBand: dominantBucket?.[1]?.label ?? null,
      dominantShare: round(dominantShare, 4),
      topAdjacentHueBands: adjacentPair,
      topAdjacentShare: round(topAdjacentShare, 4),
      activeHueBandCount,
      rhythmRisk: round(risk, 4),
      rhythmLevel: rhythmRiskLevel(risk),
      cause: describeRhythmCause({
        topAdjacentShare,
        dominantShare,
        activeHueBandCount,
      }),
      buckets,
    };
  }

  return diagnostics;
}

function hueSamples(lane, currentHue) {
  if (!lane) return [currentHue].filter((value) => value != null);
  const center = laneCenter(lane);
  const samples = new Set([lane.hueMin, lane.hueMax, center, currentHue].filter((value) => value != null).map((value) => Math.round(value)));
  for (let offset = -8; offset <= 8; offset += 2) {
    samples.add(Math.round((((center + offset) % 360) + 360) % 360));
  }
  return [...samples].filter((hue) => hueInBand(hue, lane.hueMin, lane.hueMax));
}

function scoreCandidate({ candidate, current, bg, roleId, roleColors, lane, targets, criticalPairs }) {
  const hsl = rgbToHsl(candidate);
  const contrast = contrastRatio(candidate, bg);
  const materialDelta = deltaE(candidate, current) ?? 0;
  const hueDistanceFromLane = hsl ? laneHueDistance(hsl.h, lane) : 180;
  const laneHueScore = Math.max(0, 1 - hueDistanceFromLane / 16);
  const saturationScore = hsl && lane ? clamp((hsl.s - lane.minSaturation) / 0.16, 0, 1) : 1;
  const contrastScore = contrast == null ? 0 : clamp((contrast - targets.minContrast) / 0.9, 0, 1);
  const roleSeparationScores = [];

  for (const [otherRole, otherColor] of Object.entries(roleColors)) {
    if (otherRole === roleId || !otherColor) continue;
    const distance = deltaE(candidate, otherColor);
    if (distance == null) continue;
    const critical = criticalPairs.find((pair) => (
      (pair.left === roleId && pair.right === otherRole) ||
      (pair.right === roleId && pair.left === otherRole)
    ));
    const target = critical?.minDeltaE ?? 8;
    roleSeparationScores.push(clamp(distance / target, 0, 1));
  }

  const separationScore = roleSeparationScores.length
    ? roleSeparationScores.reduce((sum, value) => sum + value, 0) / roleSeparationScores.length
    : 1;
  const neonRisk = hsl ? Math.max(0, hsl.s - targets.saturationCeiling) / 0.18 : 0;
  const materialPenalty = Math.max(0, materialDelta - targets.materialDeltaBudget) / 10;

  const score =
    laneHueScore * 0.22 +
    saturationScore * 0.16 +
    contrastScore * 0.24 +
    separationScore * 0.24 +
    (1 - clamp(neonRisk, 0, 1)) * 0.08 +
    (1 - clamp(materialPenalty, 0, 1)) * 0.06;

  return {
    score: round(score, 4),
    contrast: round(contrast, 2),
    deltaFromCurrent: round(materialDelta, 2),
    hue: round(hsl?.h, 1),
    saturation: round(hsl?.s, 3),
    lightness: round(hsl?.l, 3),
    laneHueScore: round(laneHueScore, 3),
    saturationScore: round(saturationScore, 3),
    contrastScore: round(contrastScore, 3),
    separationScore: round(separationScore, 3),
    neonRisk: round(neonRisk, 3),
    materialPenalty: round(materialPenalty, 3),
  };
}

function findBestCandidate({ color, bg, roleId, roleColors, lane, targets, criticalPairs }) {
  const currentHsl = rgbToHsl(color);
  if (!currentHsl) return null;

  const currentMetric = scoreCandidate({
    candidate: color,
    current: color,
    bg,
    roleId,
    roleColors,
    lane,
    targets,
    criticalPairs,
  });
  const candidates = [];
  const minSat = lane ? Math.max(0.16, lane.minSaturation) : 0.16;
  const satValues = [
    currentHsl.s - 0.09,
    currentHsl.s - 0.045,
    currentHsl.s,
    currentHsl.s + 0.045,
    currentHsl.s + 0.09,
    lane ? lane.minSaturation + 0.1 : currentHsl.s,
  ];
  const lightValues = [
    currentHsl.l - 0.08,
    currentHsl.l - 0.04,
    currentHsl.l,
    currentHsl.l + 0.04,
    currentHsl.l + 0.08,
  ];

  for (const h of hueSamples(lane, currentHsl.h)) {
    for (const sRaw of satValues) {
      for (const lRaw of lightValues) {
        const s = clamp(sRaw, minSat, targets.saturationCeiling + 0.08);
        const l = clamp(lRaw, 0.18, 0.86);
        const candidate = hslToHex({ h, s, l });
        const metric = scoreCandidate({
          candidate,
          current: color,
          bg,
          roleId,
          roleColors,
          lane,
          targets,
          criticalPairs,
        });
        candidates.push({ color: candidate, ...metric });
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score || a.deltaFromCurrent - b.deltaFromCurrent);
  const best = candidates[0] || { color, ...currentMetric };
  return {
    current: { color, ...currentMetric },
    best,
    scoreGain: round(best.score - currentMetric.score, 4),
    recommendation: best.score - currentMetric.score >= 0.035 && best.deltaFromCurrent <= 14
      ? "candidate"
      : "hold",
  };
}

function buildMarkdown(report) {
  const lines = [];
  lines.push(`# ${report.schemeId} Color Optimization`, "");
  lines.push("Generated from current theme outputs. This report is algorithmic only; it does not modify source tokens.", "");
  lines.push("## Summary", "");
  lines.push(`- Status: ${report.status}`);
  lines.push(`- Mean current score: ${fixed(report.summary.meanCurrentScore, 3)}`);
  lines.push(`- Mean best score: ${fixed(report.summary.meanBestScore, 3)}`);
  lines.push(`- Candidate moves: ${report.summary.candidateCount}`);
  lines.push(`- Max rhythm risk: ${fixed(report.summary.maxRhythmRisk, 3)} (${report.summary.maxRhythmLevel})`);
  lines.push("");
  lines.push("## Candidate Moves", "");
  lines.push("| Variant | Role | Current | Candidate | Gain | Contrast | dE From Current | Why |");
  lines.push("| --- | --- | --- | --- | ---: | ---: | ---: | --- |");
  const candidates = report.items.filter((item) => item.recommendation === "candidate");
  if (candidates.length === 0) {
    lines.push("| none | none | - | - | 0.000 | - | - | Current generated colors are already inside the optimizer's safe basin. |");
  } else {
    for (const item of candidates) {
      lines.push(`| ${item.variantId} | ${item.roleId} | ${item.current.color} | ${item.best.color} | ${fixed(item.scoreGain, 3)} | ${fixed(item.best.contrast, 2)} | ${fixed(item.best.deltaFromCurrent, 1)} | ${item.reason} |`);
    }
  }
  lines.push("");
  lines.push("## Role Scores", "");
  lines.push("| Variant | Role | Current Score | Best Score | Status | Current Hue/Sat | Best Hue/Sat |");
  lines.push("| --- | --- | ---: | ---: | --- | ---: | ---: |");
  for (const item of report.items) {
    lines.push(`| ${item.variantId} | ${item.roleId} | ${fixed(item.current.score, 3)} | ${fixed(item.best.score, 3)} | ${item.recommendation} | ${fixed(item.current.hue, 1)} / ${fixed(item.current.saturation, 2)} | ${fixed(item.best.hue, 1)} / ${fixed(item.best.saturation, 2)} |`);
  }
  lines.push("");
  lines.push("## Rhythm Diagnostics", "");
  lines.push("This section checks whether the generated high-exposure roles are chromatically safe but visually too concentrated.", "");
  lines.push("| Variant | Level | Risk | Dominant band | Dominant share | Adjacent top-two | Adjacent share | Active bands | Cause |");
  lines.push("| --- | --- | ---: | --- | ---: | --- | ---: | ---: | --- |");
  for (const variant of report.variants) {
    const metrics = report.rhythmDiagnostics?.[variant.id];
    if (!metrics) continue;
    const adjacent = Array.isArray(metrics.topAdjacentHueBands) ? metrics.topAdjacentHueBands.join(" + ") : "n/a";
    lines.push(`| ${variant.id} | ${metrics.rhythmLevel} | ${fixed(metrics.rhythmRisk, 3)} | ${metrics.dominantHueBand ?? "n/a"} | ${fixed(metrics.dominantShare * 100, 1)}% | ${adjacent} | ${fixed(metrics.topAdjacentShare * 100, 1)}% | ${metrics.activeHueBandCount} | ${metrics.cause} |`);
  }
  lines.push("");
  lines.push("## Rhythm Targets", "");
  lines.push(`- Dominant hue band target: <= ${fixed(report.rhythmTargets.dominantHueBandShare * 100, 1)}% of chromatic high-exposure weight.`);
  lines.push(`- Adjacent hue band target: <= ${fixed(report.rhythmTargets.adjacentHueBandShare * 100, 1)}% of chromatic high-exposure weight.`);
  lines.push(`- Active hue band target: at least ${report.rhythmTargets.activeHueBandCount} bands with >= ${fixed(report.rhythmTargets.activeHueBandShare * 100, 1)}% chromatic share.`);
  lines.push("");
  return lines.join("\n");
}

function buildReason(item) {
  const reasons = [];
  if (item.best.contrast > item.current.contrast + 0.15) reasons.push("contrast");
  if (item.best.separationScore > item.current.separationScore + 0.03) reasons.push("role separation");
  if (item.best.saturationScore > item.current.saturationScore + 0.03) reasons.push("lane saturation");
  if (item.best.laneHueScore > item.current.laneHueScore + 0.03) reasons.push("lane hue");
  return reasons.join(", ") || "balanced objective";
}

function run() {
  const variantsSpec = loadColorSystemVariants();
  const tuning = loadColorSystemTuning();
  const roleAdapters = Object.fromEntries(loadRoleAdapters().map((role) => [role.id, role]));
  const contractPath = join("color-system", "schemes", COLOR_SYSTEM_SCHEME_ID, "color-contract.json");
  const contract = readJson(contractPath);
  const items = [];
  const themesByVariant = {};
  const roleWeights = getHighExposureRoleWeights(tuning);

  for (const variant of variantsSpec.variants) {
    const themePath = variant.outputPath;
    if (!existsSync(themePath)) throw new Error(`${themePath}: theme output missing. Run pnpm run sync first.`);
    const theme = readJson(themePath);
    themesByVariant[variant.id] = theme;
    const bg = normalizeHex(theme.colors?.["editor.background"]);
    const roleColors = Object.fromEntries(ROLE_IDS.map((roleId) => {
      const roleDef = roleAdapters[roleId];
      return [roleId, roleDef ? getRoleColor(theme, roleDef) : null];
    }));
    const targets = VARIANT_TARGETS[variant.id] || VARIANT_TARGETS[variant.type] || VARIANT_TARGETS.dark;

    for (const roleId of ROLE_IDS) {
      const color = roleColors[roleId];
      if (!color || !bg) continue;
      const lane = getLaneForRole(contract, roleId);
      const result = findBestCandidate({
        color,
        bg,
        roleId,
        roleColors,
        lane,
        targets,
        criticalPairs: contract.criticalPairs || [],
      });
      if (!result) continue;
      const item = {
        variantId: variant.id,
        roleId,
        lane,
        ...result,
      };
      item.reason = buildReason(item);
      items.push(item);
    }
  }

  const meanCurrentScore = items.reduce((sum, item) => sum + item.current.score, 0) / items.length;
  const meanBestScore = items.reduce((sum, item) => sum + item.best.score, 0) / items.length;
  const candidateCount = items.filter((item) => item.recommendation === "candidate").length;
  const rhythmDiagnostics = buildRhythmDiagnostics(themesByVariant, roleAdapters, roleWeights);
  const rhythmEntries = Object.values(rhythmDiagnostics);
  const maxRhythm = rhythmEntries.reduce((best, current) => (
    current.rhythmRisk > best.rhythmRisk ? current : best
  ), { rhythmRisk: 0, rhythmLevel: "balanced" });
  const report = {
    schemaVersion: 1,
    generatedBy: "scripts/optimize-theme-colors.mjs",
    schemeId: COLOR_SYSTEM_SCHEME_ID,
    status: candidateCount > 0 ? "candidate" : "hold",
    variants: variantsSpec.variants.map((variant) => ({
      id: variant.id,
      type: variant.type,
      mode: variant.mode,
    })),
    summary: {
      meanCurrentScore: round(meanCurrentScore, 4),
      meanBestScore: round(meanBestScore, 4),
      candidateCount,
      maxRhythmRisk: round(maxRhythm.rhythmRisk, 4),
      maxRhythmLevel: maxRhythm.rhythmLevel,
    },
    objective: {
      laneHueWeight: 0.22,
      saturationWeight: 0.16,
      contrastWeight: 0.24,
      separationWeight: 0.24,
      antiNeonWeight: 0.08,
      materialRetentionWeight: 0.06,
    },
    rhythmTargets: RHYTHM_TARGETS,
    rhythmRoleWeights: Object.fromEntries(Object.entries(roleWeights).map(([roleId, weight]) => [roleId, round(weight, 4)])),
    rhythmDiagnostics,
    items,
  };

  writeJson(REPORT_JSON_PATH, report);
  writeText(REPORT_MD_PATH, buildMarkdown(report));

  console.log(`[PASS] Color optimization report generated for ${COLOR_SYSTEM_SCHEME_ID}.`);
  console.log(`[INFO] Candidate moves: ${candidateCount}`);
  console.log(`[INFO] Max rhythm risk: ${round(maxRhythm.rhythmRisk, 4)} (${maxRhythm.rhythmLevel})`);
  console.log(`[INFO] Report: ${REPORT_MD_PATH}`);
}

run();
