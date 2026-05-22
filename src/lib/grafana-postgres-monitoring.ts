/**
 * Supabase PostgreSQL → Grafana PostgreSQL Data Source 패널용 쿼리·설정 가이드.
 * pg_stat_statements 확장이 활성화되어 있어야 3~5번 지표를 사용할 수 있습니다.
 */

export type GrafanaPanelKind = "stat" | "gauge" | "table";

export type GrafanaPostgresMonitoringPanel = {
  id: string;
  order: number;
  title: string;
  subtitle: string;
  panelKind: GrafanaPanelKind;
  panelKindLabel: string;
  sql: string;
  fieldHint?: string;
  grafanaTips: string[];
  thresholds?: string;
};

/** Grafana Data Source 연결 (Supabase) */
export const GRAFANA_SUPABASE_CONNECTION_TIPS = [
  "Grafana → Connections → Data sources → PostgreSQL 추가",
  "Host: Supabase 프로젝트 설정 → Database → Host (`db.<ref>.supabase.co`)",
  "Port: `5432` (Direct, 모니터링 권장) — Transaction pooler `6543`는 pg_stat_* 스냅샷에 부적합할 수 있음",
  "Database / User / Password: 동일 화면의 connection string 또는 `postgres` 역할",
  "TLS/SSL Mode: `require` (Supabase 필수)",
  "PostgreSQL version: 15+ 선택, Max open connections: 5~10 권장",
  "SQL Editor에서 `SELECT * FROM pg_extension WHERE extname = 'pg_stat_statements';` 로 확장 설치 확인",
  "미설치 시 Supabase SQL Editor: `CREATE EXTENSION IF NOT EXISTS pg_stat_statements;` (권한 필요)",
];

export const GRAFANA_POSTGRES_MONITORING_PANELS: GrafanaPostgresMonitoringPanel[] = [
  {
    id: "active-connections",
    order: 1,
    title: "현재 활성 커넥션 수",
    subtitle: "Active Connections — 지금 쿼리를 실행 중인 백엔드 세션",
    panelKind: "stat",
    panelKindLabel: "Stat (또는 Gauge)",
    fieldHint: "값 필드: `active_connections`",
    sql: `-- Stat / Gauge — Instant 쿼리 (Refresh 10s 권장)
SELECT
  COUNT(*)::bigint AS active_connections
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid <> pg_backend_pid()
  AND backend_type = 'client backend'
  AND state = 'active';`,
    grafanaTips: [
      "패널 타입: Stat — 큰 숫자 + 상태 색상에 적합. Gauge는 상한선(예: max_connections) 대비 비율 표시 시 사용",
      "Query: Format = Table → Transform 없이 필드 `active_connections` 선택",
      "Grafana 10+: Query options → Type = Instant (시계열 불필요)",
      "Standard options → Unit: none, Decimals: 0",
      "Thresholds 예: base=green, 50=yellow, 80=red (max_connections의 80% 기준 Gauge일 때)",
      "Dashboard refresh: 10s~30s",
    ],
    thresholds: "Stat: 0=green · 30=yellow · 50=orange · 80=red (환경별 조정)",
  },
  {
    id: "waiting-queries",
    order: 2,
    title: "대기 중인 쿼리 수",
    subtitle: "Waiting / Blocked — Lock·IO 등 wait_event가 걸린 세션",
    panelKind: "gauge",
    panelKindLabel: "Gauge (또는 Stat)",
    fieldHint: "값 필드: `waiting_queries`",
    sql: `-- Gauge / Stat — Lock·리소스 대기 세션 (idle 제외)
SELECT
  COUNT(*)::bigint AS waiting_queries
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid <> pg_backend_pid()
  AND backend_type = 'client backend'
  AND state <> 'idle'
  AND wait_event_type IS NOT NULL;

-- Lock만 보려면 아래 조건으로 교체:
-- AND wait_event_type = 'Lock';`,
    grafanaTips: [
      "패널 타입: Gauge — 0에 가까울수록 정상. Stat으로도 동일 쿼리 사용 가능",
      "0이 아닐 때 알림(Alert) 연동 권장: waiting_queries > 0 for 1m",
      "Lock 전용 모니터링이면 SQL 주석의 `wait_event_type = 'Lock'` 조건 사용",
      "동시에 panel 1(활성)과 비교해 활성은 많은데 대기도 많으면 병목 의심",
    ],
    thresholds: "Gauge: 0=green · 1=yellow · 5=red",
  },
  {
    id: "total-exec-time",
    order: 3,
    title: "쿼리별 총 실행 시간",
    subtitle: "Total Execution Time per Query — 누적 CPU/실행 시간 상위",
    panelKind: "table",
    panelKindLabel: "Table",
    fieldHint: "컬럼: query_short, total_exec_time_ms, calls, pct_of_total",
    sql: `-- Table — pg_stat_statements (현재 DB, 누적 total_exec_time 상위)
WITH stats AS (
  SELECT
    s.queryid,
    LEFT(REGEXP_REPLACE(s.query, E'[\\n\\r\\t]+', ' ', 'g'), 120) AS query_short,
    ROUND(s.total_exec_time::numeric, 2) AS total_exec_time_ms,
    s.calls::bigint AS calls
  FROM pg_stat_statements s
  INNER JOIN pg_database d ON d.oid = s.dbid AND d.datname = current_database()
  WHERE s.calls > 0
),
totals AS (
  SELECT SUM(total_exec_time_ms) AS grand_total FROM stats
)
SELECT
  st.query_short,
  st.total_exec_time_ms,
  st.calls,
  ROUND(100.0 * st.total_exec_time_ms / NULLIF(t.grand_total, 0), 2) AS pct_of_total
FROM stats st
CROSS JOIN totals t
ORDER BY st.total_exec_time_ms DESC
LIMIT 25;`,
    grafanaTips: [
      "패널 타입: Table — 정렬·컬럼 폭 조절에 유리",
      "Column: `total_exec_time_ms` → Unit: milliseconds (ms)",
      "Column: `pct_of_total` → Unit: percent (0-100)",
      "Table → Cell display: `query_short`는 Wrap text, Tooltip에 전체 쿼리는 별도 패널(Logs) 연동",
      "주기적으로 `SELECT pg_stat_statements_reset();` 하면 누적 기준점이 리셋됨 (운영 시 주의)",
    ],
  },
  {
    id: "call-count",
    order: 4,
    title: "쿼리별 호출 횟수",
    subtitle: "Call Count per Query — 가장 자주 실행되는 쿼리",
    panelKind: "table",
    panelKindLabel: "Table",
    fieldHint: "컬럼: query_short, call_count, mean_exec_time_ms",
    sql: `-- Table — 호출 횟수 상위 (평균 실행 시간 함께 표시)
SELECT
  LEFT(REGEXP_REPLACE(s.query, E'[\\n\\r\\t]+', ' ', 'g'), 120) AS query_short,
  s.calls::bigint AS call_count,
  ROUND(s.mean_exec_time::numeric, 2) AS mean_exec_time_ms,
  ROUND(s.total_exec_time::numeric, 2) AS total_exec_time_ms
FROM pg_stat_statements s
INNER JOIN pg_database d ON d.oid = s.dbid AND d.datname = current_database()
WHERE s.calls > 0
ORDER BY call_count DESC
LIMIT 25;`,
    grafanaTips: [
      "패널 타입: Table — 호출 횟수·평균 시간을 나란히 두면 N+1·과다 폴링 탐지에 유용",
      "call_count 높고 mean_exec_time_ms도 높으면 인덱스·캐시 점검",
      "Supabase API·Realtime 폴링 쿼리가 상위에 오르는지 확인",
      "필요 시 `AND s.query NOT LIKE '%pg_stat%'` 로 메타 쿼리 제외",
    ],
  },
  {
    id: "top-slowest",
    order: 5,
    title: "가장 느린 상위 5개 쿼리",
    subtitle: "Top 5 Slowest — 평균 실행 시간(mean_exec_time) 기준",
    panelKind: "table",
    panelKindLabel: "Table",
    fieldHint: "컬럼: query_short, mean_exec_time_ms, max_exec_time_ms, calls",
    sql: `-- Table — 평균 실행 시간 Top 5 (최소 5회 이상 실행된 쿼리만)
SELECT
  LEFT(REGEXP_REPLACE(s.query, E'[\\n\\r\\t]+', ' ', 'g'), 120) AS query_short,
  ROUND(s.mean_exec_time::numeric, 2) AS mean_exec_time_ms,
  ROUND(s.max_exec_time::numeric, 2) AS max_exec_time_ms,
  s.calls::bigint AS calls,
  ROUND(s.total_exec_time::numeric, 2) AS total_exec_time_ms
FROM pg_stat_statements s
INNER JOIN pg_database d ON d.oid = s.dbid AND d.datname = current_database()
WHERE s.calls >= 5
ORDER BY mean_exec_time_ms DESC
LIMIT 5;`,
    grafanaTips: [
      "패널 타입: Table — Bar gauge 컬럼으로 `mean_exec_time_ms` 시각화 가능 (Table → Cell type: Gauge)",
      "calls >= 5 조건으로 1회성 이상치 제외 (환경에 맞게 조정)",
      "max_exec_time_ms가 mean 대비 매우 크면 간헐적 스파이크·락 대기 의심",
      "패널 3(총 시간)과 함께 보면 '자주 + 느림' vs '가끔 + 매우 느림' 구분 가능",
    ],
  },
];

/** 대시보드 JSON import 없이 패널을 수동 구성할 때 권장 레이아웃 */
export const GRAFANA_DASHBOARD_LAYOUT_TIP =
  "1행: Stat(활성 커넥션) + Gauge(대기 쿼리) · 2행: Table(총 실행 시간) 전체 너비 · 3행: Table(호출 횟수) + Table(Top 5 느린 쿼리)";
