import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { getThemePref, setThemePref, type ThemePref } from "./localStore.js";

type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  pref: ThemePref;
  resolved: ResolvedTheme;
  setPref: (pref: ThemePref) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  pref: "system",
  resolved: "dark",
  setPref: () => {},
  toggle: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function resolve(pref: ThemePref): ResolvedTheme {
  return pref === "system" ? getSystemTheme() : pref;
}

function applyTheme(theme: ResolvedTheme) {
  document.documentElement.setAttribute("data-theme", theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", theme === "light" ? "#f4f7f5" : "#1f7a3d");
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(getThemePref);
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolve(pref));

  function setPref(next: ThemePref) {
    setPrefState(next);
    setThemePref(next);
    const r = resolve(next);
    setResolved(r);
    applyTheme(r);
  }

  function toggle() {
    setPref(resolved === "dark" ? "light" : "dark");
  }

  // Listen for system theme changes when in "system" mode
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    function handler() {
      if (pref === "system") {
        const r = getSystemTheme();
        setResolved(r);
        applyTheme(r);
      }
    }
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [pref]);

  // Sync on mount (the inline script in index.html already set the attribute,
  // but this ensures React state matches)
  useEffect(() => {
    applyTheme(resolved);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ThemeContext.Provider value={{ pref, resolved, setPref, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
