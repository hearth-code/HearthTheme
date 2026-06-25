export function renderVscodeThemeJson(theme) {
  return `${JSON.stringify(theme, null, 4)}\n`
}
