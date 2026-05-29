import type { ScrumTaskTextMap } from "@/lib/scrum-task-fields";
import { pruneTaskTextMap } from "@/lib/scrum-task-fields";

export interface ScrumSaveFormSlice {
  yesterdayByTask: ScrumTaskTextMap;
  todayByTask: ScrumTaskTextMap;
  selectedTasks: string[];
}

/** 전일 성과·오늘 계획·병목 입력 가능 여부
 *  - 선택 이슈가 정확히 1개일 때만 입력·저장 가능
 *  - 2개 이상이면 조회 전용
 */
export function canEditScrumTextFields(options: {
  hasSelectableTasks: boolean;
  selectedTaskCount: number;
}): boolean {
  if (!options.hasSelectableTasks) return true;
  return options.selectedTaskCount === 1;
}

function mapsForValidation(form: ScrumSaveFormSlice): {
  yesterday: ScrumTaskTextMap;
  today: ScrumTaskTextMap;
} {
  const keys = form.selectedTasks ?? [];
  return {
    yesterday: pruneTaskTextMap(form.yesterdayByTask ?? {}, keys),
    today: pruneTaskTextMap(form.todayByTask ?? {}, keys),
  };
}

/** 담당 이슈가 정확히 1개 선택된 경우에만 저장 가능.
 *  2개 이상 선택 시 조회 전용으로 저장 불가. */
export function isScrumFormSavable(
  form: ScrumSaveFormSlice,
  options?: { requireTaskSelection?: boolean }
): boolean {
  const requireTasks = options?.requireTaskSelection ?? true;
  if (requireTasks && form.selectedTasks.length === 0) return false;
  // 2개 이상 선택 → 조회 전용
  if (form.selectedTasks.length > 1) return false;

  const { yesterday, today } = mapsForValidation(form);
  if (form.selectedTasks.length === 0) {
    const yAny = Object.values(form.yesterdayByTask ?? {}).some((v) => v.trim());
    const tAny = Object.values(form.todayByTask ?? {}).some((v) => v.trim());
    return yAny && tAny;
  }

  for (const key of form.selectedTasks) {
    if (!(yesterday[key] ?? "").trim()) return false;
    if (!(today[key] ?? "").trim()) return false;
  }
  return true;
}

/** 저장 불가 시 사용자용 안내 (null이면 저장 가능) */
export function getScrumSaveValidationMessage(
  form: ScrumSaveFormSlice,
  options?: { requireTaskSelection?: boolean }
): string | null {
  const requireTasks = options?.requireTaskSelection ?? true;
  const missing: string[] = [];

  if (form.selectedTasks.length > 1) {
    return "담당 이슈를 1개만 선택하면 입력·저장할 수 있습니다. (2개 이상 선택 시 조회 전용)";
  }
  if (requireTasks && form.selectedTasks.length === 0) {
    missing.push("좌측 목록에서 담당 이슈 1개 선택");
  }

  const { yesterday, today } = mapsForValidation(form);
  const emptyYesterday = form.selectedTasks.filter((k) => !(yesterday[k] ?? "").trim());
  const emptyToday = form.selectedTasks.filter((k) => !(today[k] ?? "").trim());

  if (emptyYesterday.length > 0) {
    missing.push(
      emptyYesterday.length === 1
        ? `${emptyYesterday[0]} 전일 성과 입력`
        : `전일 성과 입력 (${emptyYesterday.length}건 미입력)`
    );
  }
  if (emptyToday.length > 0) {
    missing.push(
      emptyToday.length === 1
        ? `${emptyToday[0]} 오늘 계획 입력`
        : `오늘 계획 입력 (${emptyToday.length}건 미입력)`
    );
  }

  if (missing.length === 0) return null;
  return `${missing.join(" · ")} 후 저장할 수 있습니다.`;
}
