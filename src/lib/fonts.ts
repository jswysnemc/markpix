export interface FontOption {
  value: string;
  label: string;
}

const DEFAULT_FONT_VALUE = "system-ui";
const DEFAULT_FONT_LABEL = "系统默认";

export function buildFontOptions(fonts: string[], currentFont?: string): FontOption[] {
  const options: FontOption[] = [];
  const seen = new Set<string>();

  const addOption = (value: string, label = value) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    options.push({ value: trimmed, label });
  };

  addOption(DEFAULT_FONT_VALUE, DEFAULT_FONT_LABEL);
  if (currentFont) {
    addOption(currentFont);
  }
  fonts.forEach((font) => addOption(font));

  return options;
}
