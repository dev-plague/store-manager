import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "sm-theme";

// Script que se inyecta antes de pintar para evitar el "flash" de tema claro
// cuando el usuario prefiere oscuro. Debe ser síncrono y mínimo.
export const themeInitScript = `(function(){try{var t=localStorage.getItem("${STORAGE_KEY}");var d=window.matchMedia("(prefers-color-scheme: dark)").matches;if(t==="dark"||(t!=="light"&&d)){document.documentElement.classList.add("dark");}}catch(e){}})();`;

// Aplica el tema al <html>. El token `.dark` vive en un ancestro.
function applyTheme(theme: Theme) {
  const prefersDark = window.matchMedia(
    "(prefers-color-scheme: dark)",
  ).matches;
  const isDark = theme === "dark" || (theme === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", isDark);
}

// Botón que alterna claro → oscuro → sistema y recuerda la preferencia.
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("system");

  // Se lee en el cliente para no romper la hidratación.
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    setTheme(saved === "light" || saved === "dark" ? saved : "system");
  }, []);

  function cycle() {
    const next: Theme =
      theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    setTheme(next);
    try {
      if (next === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* modo privado: se ignora */
    }
    applyTheme(next);
  }

  const label =
    theme === "light"
      ? "Tema claro"
      : theme === "dark"
        ? "Tema oscuro"
        : "Tema del sistema";

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={cycle}
      aria-label={`${label}. Pulsa para cambiar.`}
      title={label}
      className={cn("size-10 rounded-xl text-muted-foreground", className)}
    >
      {theme === "light" ? (
        <Sun className="size-5" aria-hidden />
      ) : theme === "dark" ? (
        <Moon className="size-5" aria-hidden />
      ) : (
        <Monitor className="size-5" aria-hidden />
      )}
    </Button>
  );
}
