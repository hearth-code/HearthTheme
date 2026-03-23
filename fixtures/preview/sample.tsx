// Hearth preview fixture: role-rich TSX scene for color-language coverage
import React from "react";

type VariantId = "dark" | "dark-soft" | "light" | "light-soft";

interface SceneSpec {
  readonly title: string;
  readonly focus: string;
  readonly hours: number;
  readonly lowStimulus: boolean;
}

enum Surface {
  VSCode = "vscode",
  OpenVSX = "openvsx",
  Obsidian = "obsidian",
}

const scenes: Record<VariantId, SceneSpec> = {
  dark: { title: "Hearth Dark", focus: "daily mixed light", hours: 8, lowStimulus: true },
  "dark-soft": { title: "Hearth Dark Soft", focus: "night focus", hours: 6, lowStimulus: true },
  light: { title: "Hearth Light", focus: "daytime docs", hours: 7, lowStimulus: true },
  "light-soft": { title: "Hearth Light Soft", focus: "long daytime", hours: 10, lowStimulus: true },
};

class PaletteEngine {
  readonly seed = "hearth";
  private readonly cache = new Map<string, number>();

  build(variant: VariantId, surface: Surface) {
    const scene = scenes[variant];
    const ratio = Math.max(2, scene.hours / 2 + 3.4);
    this.cache.set(`${variant}:${surface}`, ratio);
    return {
      variant,
      surface,
      scene,
      ratio,
      ok: ratio >= 7 && scene.lowStimulus,
      note: scene.focus ?? "steady",
    };
  }
}

const engine = new PaletteEngine();
const surfaces = [Surface.VSCode, Surface.OpenVSX, Surface.Obsidian];
const reports = surfaces.map((surface) => engine.build("dark", surface));
const primary = reports.find((item) => item.ok)?.scene.title ?? "Hearth";

function PreviewCard(props: { title: string; accent: string; count: number }) {
  return (
    <section data-surface={props.title} className="card shell">
      <h2>{props.title}</h2>
      <p>{`${props.accent}:${props.count}`}</p>
      <code>{reports.map((row) => `${row.surface}:${row.ratio.toFixed(1)}`).join(" | ")}</code>
    </section>
  );
}

export function PreviewGrid() {
  return (
    <main id="hearth-preview">
      <PreviewCard title={primary} accent="semantic-parity" count={reports.length} />
      <div className="tags">
        <span data-kind="keyword">if</span>
        <span data-kind="operator">=&gt;</span>
        <span data-kind="function">build()</span>
        <span data-kind="method">map()</span>
        <span data-kind="property">scene.title</span>
        <span data-kind="type">VariantId</span>
      </div>
    </main>
  );
}
