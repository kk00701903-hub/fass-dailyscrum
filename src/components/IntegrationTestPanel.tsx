import { useCallback, useMemo, useRef, useState, type ChangeEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  MinusCircle,
  FileSpreadsheet,
} from "lucide-react";
import { Card, SectionHeader } from "@/components/Stats";
import {
  INTEGRATION_TEST_CATALOG,
  runExporterFileTest,
  runIntegrationTest,
  summarizeTestResults,
  type IntegrationTestId,
  type IntegrationTestResult,
} from "@/lib/integration-test";

const STATUS_STYLE: Record<
  IntegrationTestResult["status"],
  { color: string; bg: string; Icon: typeof CheckCircle2 }
> = {
  pending: { color: "var(--muted-foreground)", bg: "rgba(255,255,255,0.06)", Icon: MinusCircle },
  running: { color: "var(--primary)", bg: "rgba(34,211,238,0.12)", Icon: Loader2 },
  pass: { color: "#34d399", bg: "rgba(52,211,153,0.12)", Icon: CheckCircle2 },
  fail: { color: "#f87171", bg: "rgba(248,113,113,0.12)", Icon: XCircle },
  skip: { color: "#94a3b8", bg: "rgba(148,163,184,0.12)", Icon: MinusCircle },
};

type Props = {
  title?: string;
  subtitle?: string;
  /** 지정 시 해당 테스트만 표시·실행 */
  includeIds?: IntegrationTestId[];
  defaultOpen?: boolean;
  /** Exporter CSV 파일 파싱 테스트 버튼 */
  showCsvFileTest?: boolean;
};

export function IntegrationTestPanel({
  title = "연동 인터페이스 테스트",
  subtitle = "REST · Exporter CSV · 환경 설정을 브라우저에서 바로 검증합니다.",
  includeIds,
  defaultOpen = false,
  showCsvFileTest = true,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<IntegrationTestResult[]>([]);
  const csvTestInputRef = useRef<HTMLInputElement>(null);

  const catalog = useMemo(() => {
    if (!includeIds?.length) return INTEGRATION_TEST_CATALOG;
    const set = new Set(includeIds);
    return INTEGRATION_TEST_CATALOG.filter((t) => set.has(t.id));
  }, [includeIds]);

  const resultMap = useMemo(() => {
    const m = new Map<IntegrationTestId, IntegrationTestResult>();
    for (const r of results) m.set(r.id, r);
    return m;
  }, [results]);

  const summary = useMemo(() => summarizeTestResults(results), [results]);

  const upsertResult = useCallback((result: IntegrationTestResult) => {
    setResults((prev) => {
      const idx = prev.findIndex((r) => r.id === result.id);
      if (idx < 0) return [...prev, result];
      const next = [...prev];
      next[idx] = result;
      return next;
    });
  }, []);

  const runAll = useCallback(async () => {
    setRunning(true);
    setResults([]);
    for (const meta of catalog) {
      upsertResult({ ...meta, status: "running", message: "실행 중…" });
      const result = await runIntegrationTest(meta.id);
      upsertResult(result);
    }
    setRunning(false);
  }, [catalog, upsertResult]);

  const runOne = useCallback(
    async (id: IntegrationTestId) => {
      const meta = catalog.find((t) => t.id === id);
      if (!meta) return;
      setRunning(true);
      upsertResult({ ...meta, status: "running", message: "실행 중…" });
      upsertResult(await runIntegrationTest(id));
      setRunning(false);
    },
    [catalog, upsertResult]
  );

  const handleCsvTestChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setRunning(true);
    const meta = {
      id: "exporter-sample" as const,
      name: `Exporter CSV · ${file.name}`,
      description: "업로드한 CSV 파일 파싱",
    };
    upsertResult({ ...meta, status: "running", message: "파싱 중…" });
    upsertResult(await runExporterFileTest(file));
    setRunning(false);
  };

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 p-4 text-left"
      >
        <div>
          <SectionHeader title={title} subtitle={subtitle} />
        </div>
        <ChevronDown
          className="w-5 h-5 shrink-0 transition-transform"
          style={{
            color: "var(--muted-foreground)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <motion.div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              <div className="flex flex-wrap items-center gap-2 pt-3">
                <button
                  type="button"
                  onClick={runAll}
                  disabled={running}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-medium disabled:opacity-50"
                  style={{
                    background: "linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 60%, black))",
                    color: "var(--primary-foreground)",
                  }}
                >
                  {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  전체 테스트 ({catalog.length})
                </button>
                {showCsvFileTest && (
                  <>
                    <input
                      ref={csvTestInputRef}
                      type="file"
                      accept=".csv,.txt,text/csv"
                      className="hidden"
                      onChange={handleCsvTestChange}
                    />
                    <button
                      type="button"
                      onClick={() => csvTestInputRef.current?.click()}
                      disabled={running}
                      className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-medium disabled:opacity-50"
                      style={{
                        background: "rgba(167,139,250,0.15)",
                        border: "1px solid rgba(167,139,250,0.35)",
                        color: "#c4b5fd",
                      }}
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      CSV 파싱만 테스트
                    </button>
                  </>
                )}
                {results.length > 0 && (
                  <span className="text-[10px] ml-auto tabular-nums" style={{ color: "var(--muted-foreground)" }}>
                    <span style={{ color: "#34d399" }}>{summary.pass} 통과</span>
                    {" · "}
                    <span style={{ color: "#f87171" }}>{summary.fail} 실패</span>
                    {" · "}
                    <span>{summary.skip} 건너뜀</span>
                  </span>
                )}
              </div>

              <ul className="space-y-2">
                {catalog.map((meta) => {
                  const r = resultMap.get(meta.id);
                  const status = r?.status ?? "pending";
                  const { color, bg, Icon } = STATUS_STYLE[status];
                  return (
                    <li
                      key={meta.id}
                      className="rounded-lg border p-3"
                      style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}
                    >
                      <div className="flex items-start gap-2">
                        <Icon
                          className={`w-4 h-4 shrink-0 mt-0.5 ${status === "running" ? "animate-spin" : ""}`}
                          style={{ color }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>
                              {meta.name}
                            </span>
                            {r?.durationMs != null && (
                              <span className="text-[10px] tabular-nums" style={{ color: "var(--muted-foreground)" }}>
                                {r.durationMs}ms
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                            {meta.description}
                          </p>
                          {r?.message && (
                            <p
                              className="text-[10px] mt-1.5 px-2 py-1 rounded"
                              style={{ color, background: bg }}
                            >
                              {r.message}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => runOne(meta.id)}
                          disabled={running}
                          className="text-[10px] px-2 py-1 rounded shrink-0 disabled:opacity-40"
                          style={{
                            border: "1px solid rgba(255,255,255,0.12)",
                            color: "var(--muted-foreground)",
                          }}
                        >
                          실행
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                REST 테스트는 <code className="text-[10px]">npm run dev</code> +{" "}
                <code className="text-[10px]">.env.local</code> 이 필요합니다. CLI 검증은{" "}
                <code className="text-[10px]">npm run test:jira</code> 를 사용하세요.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

/** JIRA 동기화 화면용 테스트 목록 (Grafana 제외) */
export const JIRA_SYNC_TEST_IDS: IntegrationTestId[] = [
  "env-config",
  "rest-availability",
  "rest-myself",
  "rest-jql",
  "rest-board",
  "exporter-sample",
  "exporter-snapshot",
];
