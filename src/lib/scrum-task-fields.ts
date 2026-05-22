/** 이슈 키(FWK-215) 또는 jira_issue_id → 텍스트 */
export type ScrumTaskTextMap = Record<string, string>;

export type ScrumTaskLogRow = {
  issueKey: string;
  jiraIssueId: string | null;
  yesterday: string;
  today: string;
};

const LEGACY_BLOCK_RE = /^\[([A-Z][A-Z0-9]+-\d+)\]\s*$/;

/** 선택된 키만 유지, 신규 키는 빈 문자열 */
export function pruneTaskTextMap(
  map: ScrumTaskTextMap | null | undefined,
  selectedKeys: string[]
): ScrumTaskTextMap {
  const src = map ?? {};
  const next: ScrumTaskTextMap = {};
  for (const key of selectedKeys) {
    next[key] = src[key] ?? "";
  }
  return next;
}

export function mergeTaskTextMaps(
  base: ScrumTaskTextMap,
  patch: ScrumTaskTextMap,
  selectedKeys: string[]
): ScrumTaskTextMap {
  const merged = { ...base, ...patch };
  return pruneTaskTextMap(merged, selectedKeys);
}

/** scrum_entries 레거시 단일 컬럼용 직렬화 */
export function serializeTaskTexts(map: ScrumTaskTextMap, selectedKeys: string[]): string {
  const parts: string[] = [];
  for (const key of selectedKeys) {
    const body = (map[key] ?? "").trim();
    if (!body) continue;
    parts.push(`[${key}]\n${body}`);
  }
  return parts.join("\n\n");
}

/** 레거시 단일 문자열 → 태스크별 맵 (선택 키 기준 병합) */
export function parseLegacyTaskTexts(text: string, selectedKeys: string[]): ScrumTaskTextMap {
  const trimmed = text.trim();
  if (!trimmed) return pruneTaskTextMap({}, selectedKeys);

  const map: ScrumTaskTextMap = {};
  const blocks = trimmed.split(/\n\n+/);
  let currentKey: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (!currentKey) return;
    map[currentKey] = buffer.join("\n").trim();
    buffer = [];
  };

  for (const block of blocks) {
    const lines = block.split("\n");
    const first = lines[0]?.trim() ?? "";
    const m = first.match(LEGACY_BLOCK_RE);
    if (m) {
      flush();
      currentKey = m[1]!;
      buffer = lines.slice(1);
    } else if (currentKey) {
      buffer.push(...lines);
    } else {
      for (const key of selectedKeys) {
        if (!map[key]) map[key] = block.trim();
      }
      return pruneTaskTextMap(map, selectedKeys);
    }
  }
  flush();

  if (Object.keys(map).length === 0 && selectedKeys.length === 1) {
    map[selectedKeys[0]!] = trimmed;
  }
  return pruneTaskTextMap(map, selectedKeys);
}

export function taskLogsToMaps(
  logs: ScrumTaskLogRow[],
  selectedKeys: string[]
): { yesterdayByTask: ScrumTaskTextMap; todayByTask: ScrumTaskTextMap } {
  const yesterdayByTask: ScrumTaskTextMap = {};
  const todayByTask: ScrumTaskTextMap = {};
  for (const row of logs) {
    yesterdayByTask[row.issueKey] = row.yesterday;
    todayByTask[row.issueKey] = row.today;
  }
  return {
    yesterdayByTask: pruneTaskTextMap(yesterdayByTask, selectedKeys),
    todayByTask: pruneTaskTextMap(todayByTask, selectedKeys),
  };
}

export function buildTaskLogRows(
  selectedKeys: string[],
  yesterdayByTask: ScrumTaskTextMap,
  todayByTask: ScrumTaskTextMap,
  jiraIssueIdByKey: Map<string, string>
): ScrumTaskLogRow[] {
  return selectedKeys.map((issueKey) => ({
    issueKey,
    jiraIssueId: jiraIssueIdByKey.get(issueKey) ?? null,
    yesterday: (yesterdayByTask[issueKey] ?? "").trim(),
    today: (todayByTask[issueKey] ?? "").trim(),
  }));
}
