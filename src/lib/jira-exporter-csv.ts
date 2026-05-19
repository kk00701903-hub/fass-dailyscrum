/**
 * Atlassian Marketplace 「Exporter for Jira」 등에서보낸 CSV/Excel(→CSV) 파싱.
 * @see https://marketplace.atlassian.com/apps/1212073/exporter-for-jira-export-issues-to-excel-csv
 */
import type { JiraTask, Priority, Sprint, TaskStatus, TeamMember } from "@/lib/index";
import { TEAM_MEMBERS } from "@/lib/index";

const JIRA_UNASSIGNED: TeamMember = {
  id: "jira-unassigned",
  name: "미배정",
  avatar: "?",
  role: "—",
  color: "#64748b",
};

/** 간단한 RFC4180 스타일 CSV 파서 (따옴표·쉼표 처리) */
export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i]!;
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQuotes = !inQuotes;
      } else if ((c === "," || c === ";") && !inQuotes) {
        out.push(cur.trim());
        cur = "";
      } else cur += c;
    }
    out.push(cur.trim());
    return out;
  };

  const headers = parseLine(lines[0]!).map((h) => h.replace(/^\uFEFF/, "").trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseLine(lines[i]!);
    if (cells.every((c) => !c)) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, j) => {
      row[h] = cells[j] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

function normHeader(h: string): string {
  return h.toLowerCase().replace(/\s+/g, " ").trim();
}

function pick(row: Record<string, string>, ...candidates: string[]): string {
  const map = new Map<string, string>();
  for (const [k, v] of Object.entries(row)) map.set(normHeader(k), v);
  for (const c of candidates) {
    const v = map.get(normHeader(c));
    if (v != null && v.trim() !== "") return v.trim();
  }
  return "";
}

function mapStatus(raw: string): TaskStatus {
  const n = raw.toLowerCase();
  if (n.includes("done") || n.includes("완료")) return "DONE";
  if (n.includes("review") || n.includes("검토")) return "IN_REVIEW";
  if (n.includes("block")) return "BLOCKED";
  if (n.includes("progress") || n.includes("진행")) return "IN_PROGRESS";
  if (n.includes("todo") || n.includes("할 일") || n.includes("해야")) return "TODO";
  return "TODO";
}

function mapPriority(raw: string): Priority {
  const n = raw.toLowerCase();
  if (n.includes("highest") || n.includes("최긴급")) return "HIGHEST";
  if (n.includes("high") || n.includes("높음")) return "HIGH";
  if (n.includes("lowest") || n.includes("최저")) return "LOWEST";
  if (n.includes("low") || n.includes("낮음")) return "LOW";
  return "MEDIUM";
}

function mapAssignee(raw: string): TeamMember {
  if (!raw) return JIRA_UNASSIGNED;
  const byName = TEAM_MEMBERS.find((m) => raw.includes(m.name) || m.name === raw);
  if (byName) return byName;
  const name = raw.split(/[<(]/)[0]?.trim() || raw;
  return {
    id: `exporter-${name.slice(0, 32)}`,
    name,
    avatar: (name[0] ?? "?").toUpperCase(),
    role: "JIRA",
    color: "#94a3b8",
  };
}

function slugSprint(name: string): string {
  const t = name.trim();
  if (!t) return "jira-exporter-sprint";
  return `exporter-${t.replace(/\s+/g, "-").slice(0, 48)}`;
}

export type ExporterParseResult = {
  tasks: JiraTask[];
  sprint: Sprint;
  warnings: string[];
};

/** Exporter for Jira / Jira 기본 CSV 컬럼명을 유연하게 매핑 */
export function parseExporterCsvToJiraTasks(csvText: string): ExporterParseResult {
  const rows = parseCsv(csvText);
  const warnings: string[] = [];
  if (rows.length === 0) {
    return {
      tasks: [],
      sprint: {
        id: "jira-exporter-empty",
        name: "Exporter 가져오기",
        state: "active",
        startDate: "—",
        endDate: "—",
        goal: "CSV에 데이터 행이 없습니다.",
      },
      warnings: ["CSV 헤더 또는 데이터 행을 찾을 수 없습니다."],
    };
  }

  const sprintName =
    pick(rows[0]!, "Sprint", "스프린트", "Sprint Name") ||
    "Exporter for Jira";
  const sprintId = slugSprint(sprintName);

  const tasks: JiraTask[] = [];
  rows.forEach((row, i) => {
    const key = pick(row, "Issue key", "Key", "Issue Key", "이슈 키", "키");
    const summary = pick(row, "Summary", "제목", "Description");
    if (!key && !summary) {
      warnings.push(`${i + 2}행: 이슈 키·요약이 비어 있어 건너뜁니다.`);
      return;
    }

    const labelsRaw = pick(row, "Labels", "라벨");
    const labels = labelsRaw ? labelsRaw.split(/[,;]/).map((l) => l.trim()).filter(Boolean) : [];
    const spRaw = pick(row, "Story Points", "Story points", "스토리 포인트", "Custom field (Story Points)");
    const storyPoints = spRaw ? parseFloat(spRaw) || 0 : 0;
    const updatedRaw = pick(row, "Updated", "Updated Date", "수정일", "Last Viewed");
    const updatedAt = updatedRaw
      ? new Date(updatedRaw).toISOString()
      : new Date().toISOString();

    const rowSprint = pick(row, "Sprint", "스프린트") || sprintName;

    tasks.push({
      id: key || `exporter-row-${i}`,
      key: key || `ROW-${i + 1}`,
      summary: summary || "—",
      status: mapStatus(pick(row, "Status", "상태")),
      priority: mapPriority(pick(row, "Priority", "우선순위")),
      assignee: mapAssignee(pick(row, "Assignee", "담당자", "Assignee Name")),
      storyPoints,
      updatedAt: Number.isNaN(Date.parse(updatedAt)) ? new Date().toISOString() : updatedAt,
      labels,
      sprintId: slugSprint(rowSprint),
    });
  });

  if (warnings.length > 5) {
    warnings.length = 5;
    warnings.push("…추가 경고는 생략되었습니다.");
  }

  return {
    tasks,
    sprint: {
      id: sprintId,
      name: sprintName,
      state: "active",
      startDate: "—",
      endDate: "—",
      goal: `Exporter for Jira CSV · ${tasks.length}건`,
    },
    warnings,
  };
}
