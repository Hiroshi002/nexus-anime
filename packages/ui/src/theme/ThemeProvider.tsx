// @nexus/ui — Theme provider
// Resolution order from docs/04-design-system/Theme.md:
//   Cookie → localStorage → prefers-color-scheme → "midnight" (default)
// The server sets data-theme on <html> from the cookie to avoid FOWT;
// this provider is the client-side engine for theme switching and system detection.

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/* eslint-disable import/no-unresolved -- relative TS import resolved by tsconfig project */
import {
  THEME_COOKIE_NAME,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type Theme,
  type ThemeState,
} from "./types";

const ThemeContext = createContext<ThemeState | null>(null);

function readCookieTheme(): Theme | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${THEME_COOKIE_NAME}=([^;]*)`));
  if (!match?.[1]) return null;
  const value = decodeURIComponent(match[1]) as Theme;
  return value === "midnight" || value === "system" ? value : null;
}

function readStorageTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
    return value === "midnight" || value === "system" ? value : null;
  } catch {
    return null;
  }
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "midnight";
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "midnight" // Dawn not designed; fall back to midnight regardless of OS preference
    : "midnight";
}

function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === "system") return getSystemTheme();
  return theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("midnight");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("midnight");
  const [mounted, setMounted] = useState(false);

  // On mount, resolve preference from cookie → localStorage → system.
  useEffect(() => {
    const fromCookie = readCookieTheme();
    const candidate = fromCookie ?? readStorageTheme() ?? "system";
    setThemeState(candidate);
    setResolvedTheme(resolveTheme(candidate));
    setMounted(true);
  }, []);

  // Persist to cookie + localStorage and flip data-theme on <html>.
  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    const resolved = resolveTheme(next);
    setResolvedTheme(resolved);

    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", resolved);
      // Cookie is server-readable for the next request (no FOWT on navigation).
      document.cookie = `${THEME_COOKIE_NAME}=${encodeURIComponent(next)}; path=/; max-age=31536000; SameSite=Lax`;
    }
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        // Ignore quota / privacy-mode errors.
      }
    }
  }, []);

  // Track OS preference changes while theme is "system".
  useEffect(() => {
    if (theme !== "system" || typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const handler = () => {
      setResolvedTheme(getSystemTheme());
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  // Keep data-theme in sync with resolvedTheme after mount.
  useEffect(() => {
    if (!mounted) return;
    document.documentElement.setAttribute("data-theme", resolvedTheme);
  }, [resolvedTheme, mounted]);

  const value = useMemo<ThemeState>(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a <ThemeProvider>");
  }
  return ctx;
}
