import { BRAND_SYSTEM, escapeXml, withAlpha } from "./brand-system.mjs";

function hashSeed(input) {
  let hash = 2166136261;
  for (const character of String(input)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed) {
  let state = seed || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function svgPoint(point) {
  return `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
}

function svgPath(points) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${svgPoint(point)}`).join(" ");
}

function polylineXAtY(points, y) {
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    if (y < Math.min(start.y, end.y) || y > Math.max(start.y, end.y)) continue;
    const progress = end.y === start.y ? 0 : (y - start.y) / (end.y - start.y);
    return start.x + (end.x - start.x) * progress;
  }
  return points.at(-1)?.x ?? 0;
}

export function assertSemanticRiftLayout(layout) {
  const titleCenterY = layout.title.y + layout.title.fontSize * 0.52;
  const titleSeamX = polylineXAtY(layout.tearControlPoints, titleCenterY);
  const emberTitleRight = layout.title.emberX + layout.title.emberApproxWidth;
  const mossTitleLeft = layout.title.mossX;
  if (emberTitleRight > titleSeamX - layout.semanticGap) {
    throw new Error("Semantic rift layout places EMBER outside the Ember field");
  }
  if (mossTitleLeft < titleSeamX + layout.semanticGap) {
    throw new Error("Semantic rift layout places MOSS outside the Moss field");
  }
  if (layout.title.mossX !== layout.sample.rightX) {
    throw new Error("Semantic rift layout disconnects MOSS from its proof column");
  }
  if (layout.sample.fontSize < 24 * layout.scale || layout.sample.lineHeight < 36 * layout.scale) {
    throw new Error("Semantic rift layout makes the code proof secondary or unreadable");
  }

  const subheadingSeamX = polylineXAtY(layout.tearControlPoints, layout.subheading.y + layout.subheading.fontSize * 0.5);
  if (layout.subheading.leftX + layout.subheading.leftApproxWidth > subheadingSeamX - layout.semanticGap) {
    throw new Error("Semantic rift layout lets the Ember subheading cross the torn boundary");
  }
  if (layout.subheading.rightX == null || layout.subheading.rightX < subheadingSeamX + layout.semanticGap) {
    throw new Error("Semantic rift layout does not reserve a Moss subheading field");
  }

  for (const y of [layout.sample.darkY + layout.sample.blockHeight * 0.5, layout.sample.lightY + layout.sample.blockHeight * 0.5]) {
    const seamX = polylineXAtY(layout.tearControlPoints, y);
    if (layout.sample.leftX + layout.sample.approxWidth > seamX - layout.semanticGap) {
      throw new Error("Semantic rift layout lets Ember code cross the torn boundary");
    }
    if (layout.sample.rightX < seamX + layout.semanticGap) {
      throw new Error("Semantic rift layout lets Moss code cross the torn boundary");
    }
  }
}

export function buildSemanticRiftLayout({ width, height }) {
  const scale = Math.min(width / 1600, height / 900);
  const splitY = Math.round(height * 0.585);
  const rightColumnX = width * 0.59;
  const inset = width * 0.035;
  return {
    scale,
    splitY,
    semanticGap: width * 0.016,
    tearControlPoints: [
      { x: width * 0.465, y: 0 },
      { x: width * 0.46, y: height * 0.15 },
      { x: width * 0.475, y: height * 0.27 },
      { x: width * 0.49, y: height * 0.39 },
      { x: width * 0.505, y: height * 0.5 },
      { x: width * 0.515, y: splitY },
      { x: width * 0.522, y: height * 0.71 },
      { x: width * 0.532, y: height * 0.85 },
      { x: width * 0.545, y: height },
    ],
    title: {
      emberX: inset,
      mossX: rightColumnX,
      y: height * 0.065,
      fontSize: Math.min(height * 0.17, width * 0.096),
      emberApproxWidth: width * 0.34,
      mossApproxWidth: width * 0.27,
    },
    subheading: {
      leftX: inset,
      rightX: rightColumnX,
      y: height * 0.245,
      fontSize: Math.min(height * 0.038, width * 0.0215),
      leftApproxWidth: width * 0.34,
    },
    sample: {
      leftX: inset,
      rightX: rightColumnX,
      darkY: height * 0.335,
      lightY: height * 0.67,
      fontSize: Math.min(height * 0.036, width * 0.021),
      lineHeight: height * 0.049,
      labelSize: height * 0.016,
      swatchOffset: height * 0.226,
      swatchStep: width * 0.032,
      swatchWidth: width * 0.024,
      swatchHeight: Math.max(6 * scale, height * 0.008),
      blockHeight: height * 0.245,
      approxWidth: width * 0.34,
    },
  };
}

export function buildTornPaperGeometry({
  controlPoints,
  seed = 1,
  segmentLength = 26,
  jitter = 8,
  paperWidth = 24,
  widthVariation = 0.52,
}) {
  if (!Array.isArray(controlPoints) || controlPoints.length < 2) {
    throw new Error("Torn paper geometry requires at least two control points");
  }

  const random = createSeededRandom(hashSeed(`torn-paper:${seed}`));
  const base = [];
  for (let segmentIndex = 0; segmentIndex < controlPoints.length - 1; segmentIndex += 1) {
    const start = controlPoints[segmentIndex];
    const end = controlPoints[segmentIndex + 1];
    const distance = Math.hypot(end.x - start.x, end.y - start.y);
    const steps = Math.max(2, Math.ceil(distance / segmentLength));
    for (let step = 0; step <= steps; step += 1) {
      if (segmentIndex > 0 && step === 0) continue;
      const progress = step / steps;
      base.push({
        x: start.x + (end.x - start.x) * progress,
        y: start.y + (end.y - start.y) * progress,
      });
    }
  }

  const center = [];
  const sideA = [];
  const sideB = [];
  const normals = [];
  const tangents = [];
  let centerNoise = 0;
  let widthNoise = 0;

  for (let index = 0; index < base.length; index += 1) {
    const previous = base[Math.max(0, index - 1)];
    const next = base[Math.min(base.length - 1, index + 1)];
    const tangentLength = Math.hypot(next.x - previous.x, next.y - previous.y) || 1;
    const tangent = {
      x: (next.x - previous.x) / tangentLength,
      y: (next.y - previous.y) / tangentLength,
    };
    const normal = { x: -tangent.y, y: tangent.x };
    const isCanvasEndpoint = index === 0 || index === base.length - 1;
    const centerTarget = (random() - 0.5) * jitter * 2;
    centerNoise = centerNoise * 0.68 + centerTarget * 0.32;
    const widthTarget = (random() - 0.5) * widthVariation;
    widthNoise = widthNoise * 0.58 + widthTarget * 0.42;
    const centerOffset = isCanvasEndpoint ? 0 : centerNoise;
    let halfWidth = paperWidth * 0.5 * (1 + widthNoise);
    if (!isCanvasEndpoint && random() < 0.12) {
      halfWidth *= random() < 0.5 ? 0.58 : 1.42;
    }
    const point = {
      x: base[index].x + normal.x * centerOffset,
      y: base[index].y + normal.y * centerOffset,
    };
    const firstSide = {
      x: point.x + normal.x * halfWidth,
      y: isCanvasEndpoint ? base[index].y : point.y + normal.y * halfWidth,
    };
    const secondSide = {
      x: point.x - normal.x * halfWidth,
      y: isCanvasEndpoint ? base[index].y : point.y - normal.y * halfWidth,
    };

    center.push(point);
    sideA.push(firstSide);
    sideB.push(secondSide);
    normals.push(normal);
    tangents.push(tangent);
  }

  return { center, sideA, sideB, normals, tangents, paperWidth };
}

export function renderTornPaperSeam({
  id,
  geometry,
  paper,
  warmInk,
  coolInk,
  shadowInk,
  seed = 1,
  intensity = 1,
}) {
  const safeId = String(id).replaceAll(/[^a-zA-Z0-9_-]/g, "-");
  const random = createSeededRandom(hashSeed(`${safeId}:seam:${seed}`));
  const { center, sideA, sideB, normals, tangents, paperWidth } = geometry;
  const paperMarks = renderTextureMarks({ id: `${safeId}-paper`, ink: shadowInk, seed: seed + 11, intensity: intensity * 0.72 });
  const abrasionMarks = renderTextureMarks({ id: `${safeId}-abrasion`, ink: warmInk, seed: seed + 17, intensity: intensity * 2.4 });
  const ribbon = [...sideA, ...[...sideB].reverse()].map(svgPoint).join(" ");
  let abrasionDepth = paperWidth;
  const abrasionOuterA = sideA.map((point, index) => {
    const target = paperWidth * (1.1 + random() * 2.4 * intensity);
    abrasionDepth = abrasionDepth * 0.7 + target * 0.3;
    const burst = index > 0 && index < sideA.length - 1 && random() < 0.12
      ? paperWidth * random() * 1.8
      : 0;
    return {
      x: point.x + normals[index].x * (abrasionDepth + burst),
      y: point.y + normals[index].y * (abrasionDepth + burst),
    };
  });
  const abrasionRibbon = [...abrasionOuterA, ...[...sideA].reverse()].map(svgPoint).join(" ");
  const sideAPath = svgPath(sideA);
  const sideBPath = svgPath(sideB);
  const edgeSegments = sideA.slice(0, -1).map((point, index) => {
    if (random() < 0.2) return "";
    const width = (0.8 + random() * 1.8 * intensity).toFixed(2);
    const opacity = (0.34 + random() * 0.48).toFixed(3);
    return `<path d="M ${svgPoint(point)} L ${svgPoint(sideA[index + 1])}" fill="none" stroke="${warmInk}" stroke-opacity="${opacity}" stroke-width="${width}" stroke-linecap="round" />`;
  }).join("");
  const coolEdgeSegments = sideB.slice(0, -1).map((point, index) => {
    if (random() < 0.38) return "";
    const width = (0.7 + random() * 1.8 * intensity).toFixed(2);
    const opacity = (0.18 + random() * 0.34).toFixed(3);
    return `<path d="M ${svgPoint(point)} L ${svgPoint(sideB[index + 1])}" fill="none" stroke="${coolInk}" stroke-opacity="${opacity}" stroke-width="${width}" stroke-linecap="round" />`;
  }).join("");
  const abrasionSlashCount = Math.max(24, Math.round(center.length * 1.1 * intensity));
  const abrasionSlashes = Array.from({ length: abrasionSlashCount }, () => {
    const index = 1 + Math.floor(random() * Math.max(1, center.length - 2));
    const normal = normals[index];
    const tangent = tangents[index];
    const distance = paperWidth * (0.9 + random() * 3.2);
    const origin = {
      x: sideA[index].x + normal.x * distance + tangent.x * (random() - 0.5) * 18,
      y: sideA[index].y + normal.y * distance + tangent.y * (random() - 0.5) * 18,
    };
    const length = 3 + random() * 18 * intensity;
    const end = {
      x: origin.x + tangent.x * length + normal.x * (random() - 0.25) * 5,
      y: origin.y + tangent.y * length + normal.y * (random() - 0.25) * 5,
    };
    return `<path d="M ${svgPoint(origin)} L ${svgPoint(end)}" fill="none" stroke="${warmInk}" stroke-opacity="${(0.16 + random() * 0.42).toFixed(3)}" stroke-width="${(0.65 + random() * 1.65).toFixed(2)}" stroke-linecap="round" />`;
  }).join("");
  const fiberCount = Math.max(18, Math.round(center.length * 1.45 * intensity));
  const fibers = Array.from({ length: fiberCount }, (_, fiberIndex) => {
    const index = 1 + Math.floor(random() * Math.max(1, center.length - 2));
    const fromSideA = random() < 0.54;
    const origin = fromSideA ? sideA[index] : sideB[index];
    const direction = fromSideA ? 1 : -1;
    const normal = normals[index];
    const tangent = tangents[index];
    const length = 4 + random() * 19 * intensity;
    const sideways = (random() - 0.5) * 9;
    const start = {
      x: origin.x + tangent.x * sideways,
      y: origin.y + tangent.y * sideways,
    };
    const end = {
      x: start.x + normal.x * length * direction + tangent.x * (random() - 0.5) * 5,
      y: start.y + normal.y * length * direction + tangent.y * (random() - 0.5) * 5,
    };
    const ink = fiberIndex % 7 === 0 ? (fromSideA ? warmInk : coolInk) : paper;
    return `<path d="M ${svgPoint(start)} L ${svgPoint(end)}" fill="none" stroke="${ink}" stroke-opacity="${(0.32 + random() * 0.52).toFixed(3)}" stroke-width="${(0.55 + random() * 1.2).toFixed(2)}" stroke-linecap="round" />`;
  }).join("");
  const chipCount = Math.max(8, Math.round(center.length * 0.3 * intensity));
  const chips = Array.from({ length: chipCount }, (_, chipIndex) => {
    const index = 1 + Math.floor(random() * Math.max(1, center.length - 2));
    const fromSideA = random() < 0.5;
    const origin = fromSideA ? sideA[index] : sideB[index];
    const direction = fromSideA ? 1 : -1;
    const normal = normals[index];
    const tangent = tangents[index];
    const distance = 7 + random() * 27 * intensity;
    const size = 1.6 + random() * 4.5;
    const centerX = origin.x + normal.x * distance * direction + tangent.x * (random() - 0.5) * 16;
    const centerY = origin.y + normal.y * distance * direction + tangent.y * (random() - 0.5) * 16;
    const first = { x: centerX + tangent.x * size, y: centerY + tangent.y * size };
    const second = { x: centerX - tangent.x * size * 0.7, y: centerY - tangent.y * size * 0.7 };
    const third = { x: centerX + normal.x * size * direction, y: centerY + normal.y * size * direction };
    const fill = chipIndex % 4 === 0 ? (fromSideA ? warmInk : coolInk) : paper;
    return `<polygon points="${svgPoint(first)} ${svgPoint(second)} ${svgPoint(third)}" fill="${fill}" fill-opacity="${(0.28 + random() * 0.5).toFixed(3)}" />`;
  }).join("");
  const paperCuts = center.slice(2, -2).filter((_, index) => index % 3 === 0).map((point, index) => {
    const tangent = tangents[index * 3 + 2];
    const length = 2 + random() * 8;
    return `<path d="M ${svgPoint(point)} l ${(tangent.x * length).toFixed(2)} ${(tangent.y * length).toFixed(2)}" fill="none" stroke="${shadowInk}" stroke-opacity="${(0.1 + random() * 0.2).toFixed(3)}" stroke-width="${(0.6 + random()).toFixed(2)}" stroke-linecap="round" />`;
  }).join("");

  return `
    <defs>
      <pattern id="${safeId}-paper-grain" patternUnits="userSpaceOnUse" width="${paperMarks.grainWidth}" height="${paperMarks.grainHeight}">${paperMarks.grains}</pattern>
      <pattern id="${safeId}-paper-fiber" patternUnits="userSpaceOnUse" width="${paperMarks.fiberWidth}" height="${paperMarks.fiberHeight}" patternTransform="rotate(-7)">${paperMarks.fibers}</pattern>
      <pattern id="${safeId}-abrasion-grain" patternUnits="userSpaceOnUse" width="${abrasionMarks.grainWidth}" height="${abrasionMarks.grainHeight}">${abrasionMarks.grains}</pattern>
      <pattern id="${safeId}-abrasion-fiber" patternUnits="userSpaceOnUse" width="${abrasionMarks.fiberWidth}" height="${abrasionMarks.fiberHeight}" patternTransform="rotate(-11)">${abrasionMarks.fibers}</pattern>
    </defs>
    <g aria-hidden="true">
      <g id="${safeId}-abrasion">
        <polygon points="${abrasionRibbon}" fill="${warmInk}" fill-opacity="0.14" />
        <polygon points="${abrasionRibbon}" fill="url(#${safeId}-abrasion-grain)" />
        <polygon points="${abrasionRibbon}" fill="url(#${safeId}-abrasion-fiber)" />
        ${abrasionSlashes}
      </g>
      <path d="${sideBPath}" fill="none" stroke="${shadowInk}" stroke-opacity="0.78" stroke-width="${Math.max(3, paperWidth * 0.46).toFixed(2)}" stroke-linecap="butt" stroke-linejoin="miter" />
      <polygon points="${ribbon}" fill="${paper}" />
      <polygon points="${ribbon}" fill="url(#${safeId}-paper-grain)" />
      <polygon points="${ribbon}" fill="url(#${safeId}-paper-fiber)" />
      <path d="${sideAPath}" fill="none" stroke="${warmInk}" stroke-opacity="0.46" stroke-width="0.8" stroke-linecap="butt" stroke-linejoin="miter" />
      ${edgeSegments}
      ${coolEdgeSegments}
      ${paperCuts}
      ${fibers}
      ${chips}
    </g>
  `;
}

function renderTextureMarks({ id, ink, seed, intensity }) {
  const random = createSeededRandom(hashSeed(`${id}:${seed}`));
  const grainWidth = 97;
  const grainHeight = 89;
  const fiberWidth = 163;
  const fiberHeight = 149;
  const grainCount = Math.max(18, Math.round(42 * intensity));
  const fiberCount = Math.max(7, Math.round(13 * intensity));
  const grains = Array.from({ length: grainCount }, () => {
    const x = (random() * grainWidth).toFixed(2);
    const y = (random() * grainHeight).toFixed(2);
    const radius = (0.35 + random() * 1.15).toFixed(2);
    const opacity = (0.045 + random() * 0.12).toFixed(3);
    return `<circle cx="${x}" cy="${y}" r="${radius}" fill="${ink}" fill-opacity="${opacity}" />`;
  }).join("");
  const fibers = Array.from({ length: fiberCount }, () => {
    const x = random() * fiberWidth;
    const y = random() * fiberHeight;
    const length = 3 + random() * 11;
    const angle = (random() - 0.5) * 0.9;
    const dx = Math.cos(angle) * length;
    const dy = Math.sin(angle) * length;
    const opacity = (0.035 + random() * 0.085).toFixed(3);
    return `<path d="M ${x.toFixed(2)} ${y.toFixed(2)} l ${dx.toFixed(2)} ${dy.toFixed(2)}" fill="none" stroke="${ink}" stroke-opacity="${opacity}" stroke-width="${(0.45 + random() * 0.65).toFixed(2)}" stroke-linecap="round" />`;
  }).join("");
  return {
    grainWidth,
    grainHeight,
    fiberWidth,
    fiberHeight,
    grains,
    fibers,
  };
}

export function renderMaterialTexture({
  id,
  ink,
  x = 0,
  y = 0,
  width,
  height,
  points = null,
  seed = 1,
  intensity = 1,
}) {
  const safeId = String(id).replaceAll(/[^a-zA-Z0-9_-]/g, "-");
  const marks = renderTextureMarks({ id: safeId, ink, seed, intensity });
  const shape = points
    ? `<polygon points="${points}" fill="url(#${safeId}-grain)" /><polygon points="${points}" fill="url(#${safeId}-fiber)" />`
    : `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="url(#${safeId}-grain)" /><rect x="${x}" y="${y}" width="${width}" height="${height}" fill="url(#${safeId}-fiber)" />`;

  return `
    <defs>
      <pattern id="${safeId}-grain" patternUnits="userSpaceOnUse" width="${marks.grainWidth}" height="${marks.grainHeight}">${marks.grains}</pattern>
      <pattern id="${safeId}-fiber" patternUnits="userSpaceOnUse" width="${marks.fiberWidth}" height="${marks.fiberHeight}" patternTransform="rotate(-7)">${marks.fibers}</pattern>
    </defs>
    <g aria-hidden="true">${shape}</g>
  `;
}

export function renderDistressedText({
  id,
  text,
  x,
  y,
  fill,
  wear,
  fontSize,
  fontFamily = BRAND_SYSTEM.typography.display,
  fontWeight = 850,
  letterSpacing = "-0.04em",
  textAnchor = null,
  seed = 1,
  intensity = 1,
}) {
  const safeId = String(id).replaceAll(/[^a-zA-Z0-9_-]/g, "-");
  const marks = renderTextureMarks({ id: `${safeId}-type`, ink: wear, seed, intensity: intensity * 1.3 });
  const anchor = textAnchor ? ` text-anchor="${textAnchor}"` : "";
  const attributes = `x="${x}" y="${y}" font-size="${fontSize}" font-family="${fontFamily}" font-weight="${fontWeight}" letter-spacing="${letterSpacing}" dominant-baseline="text-before-edge"${anchor}`;
  return `
    <defs>
      <pattern id="${safeId}-wear" patternUnits="userSpaceOnUse" width="${marks.grainWidth}" height="${marks.grainHeight}">${marks.grains}${marks.fibers}</pattern>
    </defs>
    <text ${attributes} fill="${fill}">${escapeXml(text)}</text>
    <text ${attributes} fill="url(#${safeId}-wear)">${escapeXml(text)}</text>
  `;
}

export function renderFieldGuideGrid({
  width = 1600,
  height = 900,
  color,
  opacity = BRAND_SYSTEM.fieldGuide.gridOpacity,
  step = BRAND_SYSTEM.fieldGuide.gridStep,
}) {
  const vertical = Array.from({ length: Math.ceil(width / step) + 1 }, (_, index) => (
    `<line x1="${index * step}" y1="0" x2="${index * step}" y2="${height}" stroke="${color}" />`
  )).join("");
  const horizontal = Array.from({ length: Math.ceil(height / step) + 1 }, (_, index) => (
    `<line x1="0" y1="${index * step}" x2="${width}" y2="${index * step}" stroke="${color}" />`
  )).join("");
  return `<g opacity="${opacity}" stroke-width="1">${vertical}${horizontal}</g>`;
}

export function renderRegistrationMarks({ width = 1600, height = 900, color }) {
  const inset = BRAND_SYSTEM.fieldGuide.registrationInset;
  const size = BRAND_SYSTEM.fieldGuide.registrationSize;
  const farX = width - inset;
  const farY = height - inset;
  return `
    <g fill="none" stroke="${withAlpha(color, 0.42)}" stroke-width="1.5">
      <path d="M ${inset} ${inset + size} V ${inset} H ${inset + size}" />
      <path d="M ${farX - size} ${inset} H ${farX} V ${inset + size}" />
      <path d="M ${inset} ${farY - size} V ${farY} H ${inset + size}" />
      <path d="M ${farX - size} ${farY} H ${farX} V ${farY - size}" />
    </g>
  `;
}

export function renderFieldGuideHeader({
  width,
  inset,
  serial,
  heading,
  subheading,
  foreground,
  muted,
  ruleY = 196,
  headingSize = 45,
}) {
  return `
    <text x="${inset}" y="48" fill="${muted}" font-size="12" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.2em" dominant-baseline="text-before-edge">${escapeXml(`${BRAND_SYSTEM.copy.fieldGuideKicker} ${serial}`)}</text>
    <text x="${inset}" y="80" fill="${foreground}" font-size="${headingSize}" font-family="${BRAND_SYSTEM.typography.display}" font-weight="750" dominant-baseline="text-before-edge">${escapeXml(heading)}</text>
    <text x="${inset}" y="138" fill="${muted}" font-size="18" font-family="${BRAND_SYSTEM.typography.ui}" dominant-baseline="text-before-edge">${escapeXml(subheading)}</text>
    <line x1="${inset}" y1="${ruleY}" x2="${width - inset}" y2="${ruleY}" stroke="${withAlpha(foreground, 0.28)}" />
  `;
}

export function renderFieldGuideFooter({ width, height, inset, left, right, muted }) {
  const y = height - 34;
  return `
    <text x="${inset}" y="${y}" fill="${muted}" font-size="11" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="700" letter-spacing="0.12em" dominant-baseline="text-before-edge">${escapeXml(left)}</text>
    <text x="${width - inset}" y="${y}" text-anchor="end" fill="${muted}" font-size="11" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="700" letter-spacing="0.12em" dominant-baseline="text-before-edge">${escapeXml(right)}</text>
  `;
}
