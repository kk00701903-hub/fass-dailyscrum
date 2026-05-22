/** 스프린트 이름 앞부분 코드 태그 — 예: "[S08] 상태관리…" → "[S08]" */
export function extractSprintCodeTag(sprintName: string): string {
  const name = sprintName.trim();
  if (!name) return "—";

  const leading = name.match(/^(\[[sS]\s*0*\d+\])/);
  if (leading) return leading[1]!.replace(/\s+/g, "");

  const anywhere = name.match(/(\[[sS]\s*0*\d+\])/);
  if (anywhere) return anywhere[1]!.replace(/\s+/g, "");

  const num = parseSprintNumber(name);
  if (num !== null) {
    const n = num < 10 ? `0${num}` : String(num);
    return `[S${n}]`;
  }

  return name;
}

/** 스프린트 이름에서 S01, S1, Sprint 01 등 번호 추출 */
export function parseSprintNumber(sprintName: string): number | null {
  const name = sprintName.trim();
  if (!name) return null;

  const sTag = name.match(/\b[sS]\s*0*(\d+)\b/);
  if (sTag) return Number.parseInt(sTag[1]!, 10);

  const sprintWord = name.match(/(?:sprint|스프린트)\s*[#-]?\s*0*(\d+)/i);
  if (sprintWord) return Number.parseInt(sprintWord[1]!, 10);

  return null;
}

/** S01 → S02 → … 오름차순 (번호 없는 항목은 맨 뒤, 이름순) */
export function compareSprintNamesByNumber(a: string, b: string): number {
  const na = parseSprintNumber(a);
  const nb = parseSprintNumber(b);

  if (na !== null && nb !== null && na !== nb) return na - nb;
  if (na !== null && nb === null) return -1;
  if (na === null && nb !== null) return 1;

  return a.localeCompare(b, "ko", { numeric: true, sensitivity: "base" });
}

export function sortSprintsByNumber<T extends { sprint_name: string }>(sprints: T[]): T[] {
  return [...sprints].sort((a, b) => compareSprintNamesByNumber(a.sprint_name, b.sprint_name));
}

/** WBS·의존성 맵 펼침 상태 키 (load / row.id / toggle 동일 값) */
export function sprintExpandId(sprint: {
  jira_sprint_id?: string | null;
  id?: string | null;
  sprint_name: string;
}): string {
  const link = sprint.jira_sprint_id?.trim();
  if (link) return link;
  const rowId = sprint.id?.trim();
  if (rowId) return rowId;
  return sprint.sprint_name;
}
