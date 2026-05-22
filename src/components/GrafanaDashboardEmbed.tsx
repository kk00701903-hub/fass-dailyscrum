/**
 * @license
 * UI Design inspired by Untitled UI Lite (untitledui.com)
 * Free for personal and commercial projects under Untitled UI Lite License.
 */
import { useSyncExternalStore } from "react";
import { ExternalLink, Settings2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, SectionHeader } from "@/components/Stats";
import { ROUTES } from "@/lib/index";
import {
  GRAFANA_EMBED_URL_CHANGED_EVENT,
  resolveGrafanaDashboardEmbedUrl,
} from "@/lib/grafana-embed-url";
import { ui } from "@/lib/design-system";
import { cn } from "@/lib/utils";

function subscribe(onStoreChange: () => void) {
  const handler = () => onStoreChange();
  window.addEventListener(GRAFANA_EMBED_URL_CHANGED_EVENT, handler);
  return () => window.removeEventListener(GRAFANA_EMBED_URL_CHANGED_EVENT, handler);
}

function getSnapshot() {
  return resolveGrafanaDashboardEmbedUrl();
}

function getServerSnapshot() {
  return "";
}

/**
 * 대시보드 시각화용 Grafana 임베드 (iframe `src` = 임베드 URL 전체).
 * - 빌드: `VITE_GRAFANA_DASHBOARD_EMBED_URL`
 * - 또는 설정 → Grafana → 대시보드 임베드 URL 저장
 * Grafana에서 iframe 허용이 필요합니다.
 */
export function GrafanaDashboardEmbed() {
  const embedUrl = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <Card className={cn(!embedUrl && "p-6", embedUrl && "overflow-hidden p-0")}>
        <SectionHeader
          title="Grafana 시각화"
          subtitle={
            embedUrl
              ? "Share → Embed 대시보드"
              : "Share → Embed에서 받은 주소로 대시보드를 iframe에 표시합니다"
          }
          action={
            <Link to={ROUTES.SETTINGS} className={ui.link}>
              설정에서 URL 입력 <Settings2 className="w-3 h-3" />
            </Link>
          }
        />
        {!embedUrl ? (
          <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-5 text-sm leading-relaxed text-slate-600">
            <p className="mb-2 font-medium text-slate-900">임베드 URL이 없습니다</p>
            <p className="mb-3 text-xs">
              <strong className="text-slate-800">방법 1</strong> — 프로젝트 루트{" "}
              <code className="rounded bg-white px-1 py-0.5 text-[10px]">.env</code>에 변수 추가 후 서버 재시작:
            </p>
            <pre className="mb-4 overflow-x-auto rounded-lg border border-gray-200 bg-white p-3 font-mono text-[11px] text-slate-700">
              {`VITE_GRAFANA_DASHBOARD_EMBED_URL=https://grafana.example/d/uid/slug?orgId=1&kiosk&theme=light`}
            </pre>
            <p className="mb-2 text-xs">
              <strong className="text-slate-800">방법 2</strong> —{" "}
              <Link to={ROUTES.SETTINGS} className="font-semibold text-slate-900 underline underline-offset-2">
                설정
              </Link>
              의 <strong className="text-slate-800">Grafana → 대시보드 임베드 URL</strong>에 Grafana{" "}
              <em>Share → Embed</em>의 <code className="rounded bg-white px-1 text-[10px]">src</code>와 동일한 전체
              URL을 붙여 넣고 저장하세요.
            </p>
            <p className="mt-3 text-[11px] text-slate-500">
              서버의 <code className="rounded bg-white px-1 text-[10px]">allow_embedding</code> 등으로 iframe이
              허용되어야 합니다.
            </p>
          </div>
        ) : (
          <>
            <div className={cn(ui.cardHeader, "flex items-center justify-between border-t border-border/50 py-3")}>
              <p className="min-w-0 break-all pr-2 text-[11px] text-slate-500">{embedUrl}</p>
              <a
                href={embedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  ui.btnSecondary,
                  "shrink-0 border-orange-200 bg-orange-50 px-3 py-1.5 text-xs text-orange-700 hover:bg-orange-100"
                )}
              >
                새 탭 <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            <iframe
              title="Grafana 대시보드"
              src={embedUrl}
              className="min-h-[min(70vh,640px)] w-full border-0 bg-slate-50"
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              allow="fullscreen"
            />
          </>
        )}
    </Card>
  );
}
