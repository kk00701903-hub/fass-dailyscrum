import type { ScrumTaskTextMap } from "@/lib/scrum-task-fields";
import { pruneTaskTextMap } from "@/lib/scrum-task-fields";

export interface ScrumSaveFormSlice {
  yesterdayByTask: ScrumTaskTextMap;
  todayByTask: ScrumTaskTextMap;
  selectedTasks: string[];
}

/** 전일 성과·오늘 계획·병목 입력 가능 여부 (저장 시 requireTaskSelection 과 동일 조건) */
export function canEditScrumTextFields(options: {
  hasSelectableTasks: boolean;
  selectedTaskCount: number;
}): boolean {
  if (!options.hasSelectableTasks) return true;
  return options.selectedTaskCount > 0;
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

/** 진행 중 담당 이슈가 1개 이상 있을 때: 선택된 각 태스크별 전일·오늘 필수 */
export function isScrumFormSavable(
  form: ScrumSaveFormSlice,
  options?: { requireTaskSelection?: boolean }
): boolean {
  const requireTasks = options?.requireTaskSelection ?? true;
  if (requireTasks && form.selectedTasks.length === 0) return false;

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

  if (requireTasks && form.selectedTasks.length === 0) {
    missing.push("좌측 목록에서 담당 이슈 클릭(체크)으로 선택");
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
