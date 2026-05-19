/** 빈·공백 문자열일 때 UI에 표시할 기본 문구 */
export const EMPTY_CONTENT_LABEL = "내용없음";

export function displayText(value: string | null | undefined, fallback = EMPTY_CONTENT_LABEL): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}
