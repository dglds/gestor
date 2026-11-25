export interface ThemePreset {
  name: string;
  primary: string;
  secondary: string;
}

export const DEFAULT_PRIMARY = "#FFE500";
export const DEFAULT_SECONDARY = "#FF6B6B";
export const DEFAULT_FONT_SCALE = 100;
export const MIN_FONT_SCALE = 85;
export const MAX_FONT_SCALE = 130;

export const FONT_SCALE_PRESETS = [
  { label: "Pequena", value: 90 },
  { label: "Padrão", value: 100 },
  { label: "Grande", value: 110 },
  { label: "Extra", value: 120 },
];

export const THEME_PRESETS: ThemePreset[] = [
  { name: "Clássico Brutal", primary: "#FFE500", secondary: "#FF6B6B" },
  { name: "Ácido & Lilás", primary: "#C4F000", secondary: "#C084FC" },
  { name: "Ciano & Laranja", primary: "#38BDF8", secondary: "#FB923C" },
  { name: "Menta & Rosa", primary: "#34D399", secondary: "#F472B6" },
  { name: "Azul Royal & Âmbar", primary: "#2563EB", secondary: "#FACC15" },
];

function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace("#", "").trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return Number.isNaN(r) ? null : [r, g, b];
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return Number.isNaN(r) ? null : [r, g, b];
  }
  return null;
}

/** Calcula cor de texto (#111111 ou #FFFFFF) com melhor contraste WCAG para qualquer hex */
export function getContrastInk(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#111111";
  const [r, g, b] = rgb.map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.36 ? "#111111" : "#FFFFFF";
}

export function applyThemeColors(primary: string, secondary: string): void {
  const root = document.documentElement;
  root.style.setProperty("--color-primary", primary);
  root.style.setProperty("--color-primary-ink", getContrastInk(primary));
  root.style.setProperty("--color-secondary", secondary);
  root.style.setProperty("--color-secondary-ink", getContrastInk(secondary));
}

export function applyFontScale(scale: number): void {
  const clamped = Math.min(MAX_FONT_SCALE, Math.max(MIN_FONT_SCALE, Math.round(scale)));
  document.documentElement.style.fontSize = `${clamped}%`;
}
