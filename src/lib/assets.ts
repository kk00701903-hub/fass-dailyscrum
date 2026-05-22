/** Vite `base` 경로 기준 public 정적 자산 */
export function publicAssetUrl(fileName: string): string {
  const base = import.meta.env.BASE_URL ?? "/";
  return `${base.replace(/\/?$/, "/")}${fileName.replace(/^\//, "")}`;
}

export const APP_LOGO_URL = publicAssetUrl("logo.png");
