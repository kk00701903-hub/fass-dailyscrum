/** 브라우저에 저장된 대시보드용 Grafana 임베드 URL (설정 화면에서 저장). */
export const GRAFANA_DASHBOARD_EMBED_STORAGE_KEY = "scrum_grafana_dashboard_embed_url";

export const GRAFANA_EMBED_URL_CHANGED_EVENT = "grafana-embed-url-changed";

function isAllowedEmbedUrl(raw: string): boolean {
  try {
    const { protocol } = new URL(raw);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

export function getStoredGrafanaDashboardEmbedUrl(): string {
  try {
    return localStorage.getItem(GRAFANA_DASHBOARD_EMBED_STORAGE_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function setStoredGrafanaDashboardEmbedUrl(url: string): void {
  try {
    const t = url.trim();
    if (!t) localStorage.removeItem(GRAFANA_DASHBOARD_EMBED_STORAGE_KEY);
    else localStorage.setItem(GRAFANA_DASHBOARD_EMBED_STORAGE_KEY, t);
  } catch {
    /* private mode / quota */
  }
  window.dispatchEvent(new Event(GRAFANA_EMBED_URL_CHANGED_EVENT));
}

/** 우선순위: `VITE_GRAFANA_DASHBOARD_EMBED_URL` → 로컬 설정(설정 페이지 저장값). */
export function resolveGrafanaDashboardEmbedUrl(): string {
  const env = import.meta.env.VITE_GRAFANA_DASHBOARD_EMBED_URL?.trim() ?? "";
  if (env && isAllowedEmbedUrl(env)) return env;
  const stored = getStoredGrafanaDashboardEmbedUrl();
  if (stored && isAllowedEmbedUrl(stored)) return stored;
  return "";
}
