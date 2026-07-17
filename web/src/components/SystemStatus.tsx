// Operational status for database health, ETL freshness, SSE, and API latency.

import { Database, Radio, Server, Timer } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { useLocale } from "@/components/locale-provider";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useStatusLoader } from "@/hooks/useStatusLoader";
import { timeAgo } from "@/lib/format";
import { isMockMode } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useStore } from "@/store/useStore";

function Row({
  icon: Icon,
  label,
  value,
  ok,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  ok?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="size-3" />
        {label}
      </span>
      <span
        className={cn(
          "font-mono tabular-nums",
          ok === undefined ? "text-foreground/90" : ok ? "text-primary" : "text-warning",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function SystemStatus() {
  const { t } = useLocale();
  const { status, latencyMs, error } = useStatusLoader();
  const live = useStore((s) => s.live);

  if (isMockMode()) return null;

  const dbOk = status?.db === "ok" && !error;
  const freshness = status?.last_ingested_at ? timeAgo(status.last_ingested_at) : t("notAvailable");
  const uptime =
    status != null ? `${Math.floor(status.uptime_s / 3600)}h ${Math.floor((status.uptime_s % 3600) / 60)}m` : t("notAvailable");

  return (
    <Card className="glass pointer-events-auto" aria-label={t("system")}>
      <CardHeader className="flex-row items-center justify-between space-y-0 px-3.5 py-2.5">
        <span className="eyebrow flex items-center gap-1.5 text-foreground/80">
          <Server className="size-3" /> {t("system")}
        </span>
        <Badge variant={error ? "warning" : "muted"} className="tabular-nums">
          {error ? t("offline") : (status?.status ?? "…")}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-1.5 px-3.5 pb-3 pt-0">
        <Row icon={Database} label={t("database")} value={dbOk ? "ok" : t("error")} ok={dbOk} />
        <Row icon={Timer} label={t("lastIngestion")} value={freshness} />
        <Row icon={Radio} label="Feed" value={live ? "live (sse)" : "polling"} ok={live} />
        <Row
          icon={Server}
          label={t("latencyUptime")}
          value={`${latencyMs != null ? Math.round(latencyMs) : "–"} ms · ${uptime}`}
        />
      </CardContent>
    </Card>
  );
}
