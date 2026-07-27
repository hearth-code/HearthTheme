import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { validate } from "../json-schema-validator.mjs";

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const SPEC_PATH = resolve(ROOT, "products/hearthcode/marketing-assets.json");
const SCHEMA_PATH = resolve(ROOT, "schemas/marketing-assets.schema.json");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function loadMarketingAssetSpec() {
  const spec = readJson(SPEC_PATH);
  const schema = readJson(SCHEMA_PATH);
  const errors = validate(spec, schema);
  if (errors.length) {
    throw new Error(`Marketing asset spec is invalid:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  }

  const ids = new Set();
  const outputs = new Set();
  for (const asset of [...spec.assets, ...spec.managedAssets]) {
    if (ids.has(asset.id)) throw new Error(`Duplicate marketing asset id: ${asset.id}`);
    ids.add(asset.id);
    if (asset.format && !spec.formats[asset.format]) {
      throw new Error(`Marketing asset ${asset.id} references unknown format: ${asset.format}`);
    }
    if (asset.template === "family" && !asset.composition) {
      throw new Error(`Family marketing asset ${asset.id} must declare an explicit composition`);
    }
    if (asset.template !== "family" && asset.composition) {
      throw new Error(`Non-family marketing asset ${asset.id} cannot declare a family composition`);
    }
    for (const output of asset.outputs) {
      if (outputs.has(output)) throw new Error(`Duplicate marketing asset output: ${output}`);
      outputs.add(output);
    }
  }

  return spec;
}

export function indexMarketingAssets(spec) {
  return Object.fromEntries(spec.assets.map((asset) => [asset.id, {
    ...asset,
    canvas: spec.formats[asset.format],
  }]));
}
