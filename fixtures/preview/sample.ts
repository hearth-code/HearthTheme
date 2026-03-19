// Hearth preview fixture: stable screenshot source
type ThemeKind = "dark" | "dark-soft" | "light";

interface ThemeConfig {
  readonly id: ThemeKind;
  readonly title: string;
  readonly contrast: number;
}

const themes: ThemeConfig[] = [
  { id: "dark", title: "Hearth Dark", contrast: 9.9 },
  { id: "dark-soft", title: "Hearth Dark Soft", contrast: 9.4 },
  { id: "light", title: "Hearth Light", contrast: 12.6 },
];

function pickTheme(id: ThemeKind): ThemeConfig | undefined {
  return themes.find((theme) => theme.id === id);
}

const selected = pickTheme("dark");
const installCmd = "ext install hearth-code.hearth-theme";
