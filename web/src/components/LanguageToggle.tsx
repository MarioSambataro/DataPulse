import { Languages } from "lucide-react";

import { useLocale } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";

export function LanguageToggle() {
  const { locale, toggleLocale } = useLocale();
  const next = locale === "it" ? "English" : "Italiano";

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-9 gap-1 px-2 sm:h-8 sm:gap-1.5 sm:px-2.5"
      aria-label={`Switch language to ${next}`}
      title={`Switch language to ${next}`}
      onClick={toggleLocale}
    >
      <Languages className="size-3.5" />
      <span className="font-mono text-[11px] font-semibold tracking-[0.12em]">{locale.toUpperCase()}</span>
    </Button>
  );
}
