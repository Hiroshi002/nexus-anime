// @nexus/ui — Theme types and constants
// Values and resolution order from docs/04-design-system/Theme.md

export const THEME_COOKIE_NAME = "nexus-theme";
export const THEME_STORAGE_KEY = "nexus-theme";

// Reserved for future themes (Dawn, Aurora). Only "midnight" ships in v1.
export type Theme = "midnight" | "system";
export type ResolvedTheme = "midnight";

export interface ThemeState {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}
