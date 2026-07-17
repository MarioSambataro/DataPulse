import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useLocale } from "@/components/locale-provider";
import { useTheme } from "@/components/theme-provider";

/** Single control that keeps the interface theme and globe lighting synchronized. */
export function ModeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const { t } = useLocale();
  const isDark = resolvedTheme === "dark";
  const toggleMode = () => {
    const nextTheme = isDark ? "light" : "dark";
    setTheme(nextTheme);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 gap-1.5 bg-card/60 px-2.5 backdrop-blur"
      aria-label={isDark ? t("switchDay") : t("switchNight")}
      title={isDark ? t("switchDay") : t("switchNight")}
      onClick={toggleMode}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
      <span className="text-xs font-medium">{isDark ? t("toDay") : t("toNight")}</span>
    </Button>
  );
}
