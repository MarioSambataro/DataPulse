import { createContext, useContext, useEffect, useState } from "react";

// Provider tema light/dark in stile shadcn: applica la classe `.dark` su <html>
// e persiste la scelta in localStorage. Default: dark (il globo 3D rende meglio
// su fondo scuro). "system" segue la preferenza OS.
type Theme = "dark" | "light" | "system";

interface ThemeProviderState {
  theme: Theme;
  resolvedTheme: "dark" | "light";
  setTheme: (theme: Theme) => void;
}

const STORAGE_KEY = "datapulse-theme";

const ThemeProviderContext = createContext<ThemeProviderState | null>(null);

function systemTheme(): "dark" | "light" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({
  children,
  defaultTheme = "dark",
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
}) {
  const [theme, setThemeState] = useState<Theme>(
    () => (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? defaultTheme,
  );
  const [resolvedTheme, setResolvedTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const root = window.document.documentElement;
    const applied = theme === "system" ? systemTheme() : theme;
    root.classList.remove("light", "dark");
    root.classList.add(applied);
    root.style.colorScheme = applied;
    setResolvedTheme(applied);
  }, [theme]);

  // Se "system", reagisci ai cambi di preferenza OS.
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const applied = systemTheme();
      const root = window.document.documentElement;
      root.classList.remove("light", "dark");
      root.classList.add(applied);
      root.style.colorScheme = applied;
      setResolvedTheme(applied);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = (next: Theme) => {
    localStorage.setItem(STORAGE_KEY, next);
    setThemeState(next);
  };

  return (
    <ThemeProviderContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeProviderContext);
  if (!ctx) throw new Error("useTheme deve essere usato dentro <ThemeProvider>");
  return ctx;
}
