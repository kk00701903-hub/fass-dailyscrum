# FWK · 전체 인터페이스 통합테스트

JIRA 보드(웹프레임워크 TF) ↔ Supabase `jira_tasks` ↔ 데일리 스크럼·WBS UI가 같은 FWK 번호·상태 규칙을 따르는지 검증합니다.

## 실행 명령

| 명령 | 설명 | 환경 |
|------|------|------|
| `npm run test:interface` | **오프라인 통합** (37 tests, 항상 로컬 실행) | env 불필요 |
| `npm run test:interface:live` | JIRA REST (`/myself`, JQL, Agile sprint) | `.env.local` + 유효 토큰 |
| `npm run verify:fwk` | Supabase ↔ 앱 ↔ JIRA 3-way | Supabase + JIRA |
| `npm run verify:daily-scrum` | 멤버별 담당 이슈 DB 리포트 | Supabase |
| `npm run verify:interface` | `verify:fwk` + `verify:daily-scrum` | |
| `npm run test:interface:all` | 위 전체 일괄 | |

DB 최신화 후 실연동 검증:

```bash
npm run sync:jira:all
npm run test:interface
npm run verify:interface
```

## 오프라인 테스트 구성 (`npm run test:interface`)

| 파일 | 검증 범위 |
|------|-----------|
| `tests/daily-scrum-jira-interface.test.mjs` | 김희찬 FWK 골든 — 패널 표시·TODO 선택 불가·매트릭스 |
| `tests/interface-pipeline.test.mjs` | DB row 매핑·status·sanitize·저장·reconcile |
| `tests/scrum-save-validation.test.mjs` | 저장 필수 조건(이슈·전일·오늘) |
| `tests/scrum-backlog.test.mjs` | `resolveScrumEntrySprintId` |
| `tests/scrum-task-status-filter.test.mjs` | 담당 이슈 상태 필터(기본 진행 중) |
| `tests/jira-wbs-gantt-labels.test.mjs` | WBS 펼침 시 간트 라벨 비표시 |
| `tests/jira-wbs.test.mjs` | WBS 필터·타임라인·월 헤더·마일스톤 |

**최근 실행 결과 (로컬):** `37 pass / 0 fail`

## 골든 기준 (김희찬)

| 키 | JIRA 컬럼 | 앱 status | 패널(전체 backlog) | UI 기본 필터 | 체크·저장 |
|----|-----------|-----------|-------------------|--------------|-----------|
| FWK-215 | 진행 중 | IN_PROGRESS | O | O (진행 중) | O |
| FWK-220 | 해야 할 일 | TODO | O | X (할 일 토글 시) | X |
| FWK-221 | 해야 할 일 | TODO | O | X | X |
| FWK-112 | 해야 할 일 | TODO | O | X | X |
| FWK-227 | 해야 할 일 | TODO | O | X | X |

- **전체 backlog:** `getMemberActiveAssignedTasks` (DONE 제외)
- **화면 기본 표시:** `filterTasksByStatuses` + 단일 선택 `SCRUM_TASK_STATUS_FILTER_DEFAULT` = `IN_PROGRESS`
- 단일 소스: [`tests/fixtures/fwk-kim-golden.mjs`](../tests/fixtures/fwk-kim-golden.mjs)

## 환경 변수

| 용도 | 변수 |
|------|------|
| 오프라인 테스트 | 불필요 |
| Supabase 검증 | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| JIRA REST (Edge 우선) | `VITE_SUPABASE_*` + Edge `JIRA_*` 시크릿. 로컬 fallback: `VITE_JIRA_*` ([JIRA_AUTH.md](JIRA_AUTH.md)) |
| FWK 키 오버라이드 | `JIRA_TEST_FWK_KEYS=FWK-215,FWK-220,...` |
| TLS (사내 SSL) | `JIRA_TEST_TLS_INSECURE=1` 또는 `SUPABASE_TEST_TLS_INSECURE=1` |

## Node 테스트 환경 수정 (1차 수정)

Vite 없이 `tsx`로 `src/`를 import할 때 `import.meta.env`가 비어 있어 실패하던 문제를 수정했습니다.

| 파일 | 수정 |
|------|------|
| `src/lib/errors/log-error.ts` | `import.meta.env?.PROD` |
| `src/lib/supabase/client.ts` | `import.meta.env?.VITE_SUPABASE_*` |
| `scripts/supabase-test-client.mjs` | verify 스크립트 TLS 공용 |

## 실연동 실패 시 체크리스트

1. `npm run sync:jira:all` 로 `jira_tasks` 동기화
2. `.env.local` JIRA 토큰 재발급 후 `npm run test:jira` (401이면 토큰·이메일 불일치)
3. Supabase `fetch failed` → `JIRA_TEST_TLS_INSECURE=1` 후 `npm run verify:interface` 재실행
4. `npm run verify:fwk` 3-way 표에서 DB/JIRA 누락 키 확인
5. TODO 이슈는 JIRA에서 진행 중으로 변경 후 재동기화

## 관련 파일

- [`tests/daily-scrum-jira-interface.test.mjs`](../tests/daily-scrum-jira-interface.test.mjs)
- [`tests/interface-pipeline.test.mjs`](../tests/interface-pipeline.test.mjs)
- [`tests/scrum-task-status-filter.test.mjs`](../tests/scrum-task-status-filter.test.mjs)
- [`tests/jira-wbs-gantt-labels.test.mjs`](../tests/jira-wbs-gantt-labels.test.mjs)
- [`scripts/verify-fwk-interface.mjs`](../scripts/verify-fwk-interface.mjs)
