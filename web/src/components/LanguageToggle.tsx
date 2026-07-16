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
      className="h-8 gap-1.5 px-2.5"
      aria-label={`Switch language to ${next}`}
      title={`Switch language to ${next}`}
      onClick={toggleLocale}
    >
      <Languages className="size-3.5" />
      <span className="font-mono text-[11px] font-semibold tracking-[0.12em]">{locale.toUpperCase()}</span>
    </Button>
  );
}
