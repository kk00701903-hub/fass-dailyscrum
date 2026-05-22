export interface ScrumSaveFormSlice {
  yesterday: string;
  today: string;
  selectedTasks: string[];
}

/** 진행 중 담당 이슈가 1개 이상 있을 때만 태스크 선택 필수 */
export function isScrumFormSavable(
  form: ScrumSaveFormSlice,
  options?: { requireTaskSelection?: boolean }
): boolean {
  const requireTasks = options?.requireTaskSelection ?? true;
  if (requireTasks && form.selectedTasks.length === 0) return false;
  if (!form.yesterday.trim()) return false;
  if (!form.today.trim()) return false;
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
  if (!form.yesterday.trim()) missing.push("전일 성과 입력");
  if (!form.today.trim()) missing.push("오늘 계획 입력");

  if (missing.length === 0) return null;
  return `${missing.join(" · ")} 후 저장할 수 있습니다.`;
}
