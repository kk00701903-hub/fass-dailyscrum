/**
 * UI 라이브러리 출처 — UI 미리보기·문서용
 */

export const UI_DESIGN_SYSTEM = {
  name: "Smart Scrum Monitoring · shadcn/ui",
  siteUrl: "https://ui.shadcn.com/",
  licenseNote:
    "MIT License. 청록(cyan) primary · oklch 토큰은 src/index.css, src/lib/design-system.ts에서 관리합니다.",
  legacyNote:
    "스마트 스크럼 모니터링 ZIP 프로토타입(Grafana형 다크) + shadcn/ui 기반으로 통일되었습니다.",
} as const;

/** @deprecated Use UI_DESIGN_SYSTEM */
export const UNTITLED_UI_DESIGN_SYSTEM = {
  name: UI_DESIGN_SYSTEM.name,
  siteUrl: UI_DESIGN_SYSTEM.siteUrl,
  freeKitUrl: UI_DESIGN_SYSTEM.siteUrl,
  figmaUrl: UI_DESIGN_SYSTEM.siteUrl,
  reactDocsUrl: UI_DESIGN_SYSTEM.siteUrl,
  reactRepoUrl: "https://github.com/shadcn-ui/ui",
  downloadFigmaUrl: UI_DESIGN_SYSTEM.siteUrl,
  licenseNote: UI_DESIGN_SYSTEM.licenseNote,
} as const;

export const UI_SCREEN_REFERENCES = [
  {
    appArea: "전역 레이아웃 · 사이드바",
    appRoutes: "AppShell (모든 페이지)",
    pattern: "Custom w-60 sidebar · sprint status card · cyan nav",
    referenceUrl: "Smart Scrum Monitoring (attached prototype)",
    note: "스프린트 위젯 · 팀원 · 로그인 사용자",
  },
  {
    appArea: "대시보드 · 애널리틱스",
    appRoutes: "/analytics",
    pattern: "KPI cards · Recharts · dense grid",
    referenceUrl: "https://ui.shadcn.com/docs/components/card",
    note: "번다운 2+1 · 블로커 피드",
  },
  {
    appArea: "데일리 스크럼",
    appRoutes: "/scrum",
    pattern: "Member pill tabs · gradient save CTA",
    referenceUrl: "Smart Scrum Monitoring",
    note: "3열 그리드 · 컴팩트 툴바",
  },
  {
    appArea: "공통 토큰 · 테마",
    appRoutes: "src/lib/design-system.ts, src/lib/theme.ts, src/index.css",
    pattern: "oklch cyan · dark default · light/system toggle",
    referenceUrl: "https://ui.shadcn.com/docs/theming",
    note: "설정 > 화면 테마",
  },
] as const;

/** @deprecated */
export const UNTITLED_UI_SCREEN_REFERENCES = UI_SCREEN_REFERENCES;
