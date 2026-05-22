/**
 * @license
 * UI Design inspired by Untitled UI Lite (untitledui.com)
 */
import { useState } from "react";
import { Check, Copy, Database, Gauge, LayoutDashboard, Table2 } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, SectionHeader } from "@/components/Stats";
import {
  GRAFANA_DASHBOARD_LAYOUT_TIP,
  GRAFANA_POSTGRES_MONITORING_PANELS,
  GRAFANA_SUPABASE_CONNECTION_TIPS,
  type GrafanaPanelKind,
} from "@/lib/grafana-postgres-monitoring";
import { ui } from "@/lib/design-system";
import { cn } from "@/lib/utils";

function panelKindIcon(kind: GrafanaPanelKind) {
  switch (kind) {
    case "stat":
      return LayoutDashboard;
    case "gauge":
      return Gauge;
    case "table":
      return Table2;
  }
}

function CopySqlButton({ sql }: { sql: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className={cn(
        ui.btnSecondary,
        "absolute right-2 top-2 z-10 gap-1 border-slate-200 bg-white/90 px-2 py-1 text-[10px] shadow-sm backdrop-blur-sm hover:bg-white"
      )}
    >
      {copied ? (
        <>
          <Check className="h-3 w-3 text-emerald-600" />
          복사됨
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" />
          SQL 복사
        </>
      )}
    </button>
  );
}

export function GrafanaPostgresMonitoringGuide() {
  return (
    <Card className={cn(ui.panelDense, "mt-3 hover:translate-y-0")}>
      <SectionHeader
        dense
        title="Supabase PostgreSQL 모니터링"
        subtitle="Grafana PostgreSQL Data Source에 붙여 넣을 SQL · 패널 설정 가이드"
      />

      <div className="mb-3 rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-2.5 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
        <p className="mb-1.5 flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-100">
          <Database className="h-3.5 w-3.5 text-cyan-600" />
          Data Source 연결 (Supabase)
        </p>
        <ul className="list-inside list-disc space-y-0.5 text-[10px]">
          {GRAFANA_SUPABASE_CONNECTION_TIPS.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
        <p className="mt-2 text-[10px] text-muted-foreground">
          <strong className="text-slate-700 dark:text-slate-200">레이아웃:</strong>{" "}
          {GRAFANA_DASHBOARD_LAYOUT_TIP}
        </p>
      </div>

      <Accordion type="multiple" defaultValue={["active-connections"]} className="w-full">
        {GRAFANA_POSTGRES_MONITORING_PANELS.map((panel) => {
          const Icon = panelKindIcon(panel.panelKind);
          return (
            <AccordionItem key={panel.id} value={panel.id} className="border-border/60">
              <AccordionTrigger className="py-2.5 text-left hover:no-underline">
                <div className="flex min-w-0 flex-1 items-start gap-2 pr-2">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {panel.order}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground">{panel.title}</p>
                    <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                      {panel.subtitle}
                    </p>
                  </div>
                  <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[9px] font-medium text-muted-foreground">
                    <Icon className="h-3 w-3" />
                    {panel.panelKindLabel}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-3 pt-0">
                {panel.fieldHint && (
                  <p className="mb-2 text-[10px] text-muted-foreground">
                    <span className="font-medium text-slate-700 dark:text-slate-300">필드:</span>{" "}
                    {panel.fieldHint}
                  </p>
                )}
                {panel.thresholds && (
                  <p className="mb-2 text-[10px] text-amber-700 dark:text-amber-400">
                    Thresholds: {panel.thresholds}
                  </p>
                )}
                <div className="relative">
                  <CopySqlButton sql={panel.sql} />
                  <pre className="max-h-[min(320px,50vh)] overflow-auto rounded-lg border border-slate-200 bg-slate-950 p-3 pr-24 font-mono text-[10px] leading-relaxed text-slate-100 dark:border-slate-700">
                    {panel.sql}
                  </pre>
                </div>
                <div className="mt-2.5 rounded-md border border-border/50 bg-muted/20 px-2.5 py-2">
                  <p className="mb-1 text-[10px] font-semibold text-slate-700 dark:text-slate-200">
                    Grafana 패널 설정 팁
                  </p>
                  <ul className="list-inside list-disc space-y-0.5 text-[10px] text-muted-foreground">
                    {panel.grafanaTips.map((tip) => (
                      <li key={tip}>{tip}</li>
                    ))}
                  </ul>
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
        PostgreSQL 13 이하에서는 <code className="rounded bg-muted px-1">total_exec_time</code> 대신{" "}
        <code className="rounded bg-muted px-1">total_time</code>,{" "}
        <code className="rounded bg-muted px-1">mean_exec_time</code> 대신{" "}
        <code className="rounded bg-muted px-1">mean_time</code> 컬럼명을 사용하세요. Supabase는
        보통 15+입니다.
      </p>
    </Card>
  );
}
