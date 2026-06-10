// Ember preview fixture: stable screenshot source
type ThemeKind = "dark" | "light";

interface ThemeConfig {
  readonly id: ThemeKind;
  readonly title: string;
  readonly contrast: number;
}

const themes: ThemeConfig[] = [
  { id: "dark", title: "Ember Dark", contrast: 9.9 },
  { id: "light", title: "Ember Light", contrast: 12.6 },
];

function pickTheme(id: ThemeKind): ThemeConfig | undefined {
  return themes.find((theme) => theme.id === id);
}

const selected = pickTheme("dark");
const installCmd = "ext install hearth-code.hearth-theme";
