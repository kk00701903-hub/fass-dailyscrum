/// <reference types="vite/client" />

// Global constants defined at build time
declare const __ROUTE_MESSAGING_ENABLED__: boolean;

interface ImportMetaEnv {
  /** Grafana 대시보드 전체 임베드 URL (kiosk·theme·from/to 쿼리 포함 가능) */
  readonly VITE_GRAFANA_DASHBOARD_EMBED_URL?: string;
  /** JIRA Cloud 사이트 URL (예: https://your-org.atlassian.net) */
  readonly VITE_JIRA_BASE_URL?: string;
  /** JIRA REST Basic 인증용 Atlassian 계정 이메일 */
  readonly VITE_JIRA_EMAIL?: string;
  /** Atlassian API 토큰 (https://id.atlassian.com/manage-profile/security/api-tokens) */
  readonly VITE_JIRA_API_TOKEN?: string;
  /** JQL 검색 시 프로젝트 키 (예: PROJ) */
  readonly VITE_JIRA_PROJECT_KEY?: string;
  /** Scrum 보드 숫자 ID — 설정 시 활성 스프린트 이슈를 Agile API 로 조회 */
  readonly VITE_JIRA_BOARD_ID?: string;
  /** 스토리 포인트 필드 id (미설정 시 customfield_10016) */
  readonly VITE_JIRA_STORY_POINTS_FIELD?: string;
  /** 시작일 커스텀 필드 id (미설정 시 customfield_10015 시도) */
  readonly VITE_JIRA_START_DATE_FIELD?: string;
  /** Supabase 프로젝트 URL */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase anon (public) key */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
