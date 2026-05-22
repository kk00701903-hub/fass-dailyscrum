# FWK 인터페이스 통합테스트

JIRA 보드(웹프레임워크 TF) ↔ Supabase `jira_tasks` ↔ 데일리 스크럼 담당 이슈 패널이 같은 FWK 번호·상태 규칙을 따르는지 검증합니다.

## 골든 기준 (김희찬)

| 키 | JIRA 컬럼 | 앱 status | 패널 표시 | 체크·저장 |
|----|-----------|-----------|-----------|-----------|
| FWK-215 | 진행 중 | IN_PROGRESS | O | O |
| FWK-220 | 해야 할 일 | TODO | O | X (안내 다이얼로그) |
| FWK-221 | 해야 할 일 | TODO | O | X |
| FWK-112 | 해야 할 일 | TODO | O | X |
| FWK-227 | 해야 할 일 | TODO | O | X |

단일 소스: [`tests/fixtures/fwk-kim-golden.mjs`](../tests/fixtures/fwk-kim-golden.mjs)

## 실행 명령

| 명령 | 설명 |
|------|------|
| `npm run test:interface` | 오프라인 단위·파이프라인 (항상 green) |
| `npm run test:interface:live` | JIRA REST 통합(자격 없으면 skip, 토큰 무효 시 fail) |
| `npm run verify:fwk` | Supabase ↔ 앱 로직 ↔ JIRA 3-way (env 없으면 해당 단계 skip) |
| `npm run verify:daily-scrum` | 멤버별 담당 이슈 DB 리포트 (Supabase 필수) |
| `npm run verify:interface` | `verify:fwk` + `verify:daily-scrum` |
| `npm run test:interface:all` | 위 테스트 + 검증 스크립트 전체 |

DB 최신화 후 실연동 검증:

```bash
npm run sync:jira:all
npm run test:interface:all
```

## 환경 변수

- **오프라인**: 불필요
- **Supabase 검증**: `.env.local` — `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- **JIRA REST**: `VITE_JIRA_BASE_URL`, `VITE_JIRA_EMAIL`, `VITE_JIRA_API_TOKEN`, `VITE_JIRA_PROJECT_KEY=FWK` (선택)
- **FWK 키 오버라이드**: `JIRA_TEST_FWK_KEYS=FWK-215,FWK-220,FWK-221,FWK-112,FWK-227`
- **TLS**: `JIRA_TEST_TLS_INSECURE=1`

## 실패 시 체크리스트

1. `npm run sync:jira:all` 로 `jira_tasks` 동기화
2. DB에서 `assignee_id=kim` 또는 `assignee_name=김희찬` 확인
3. JIRA에서 TODO 이슈를 진행 중으로 옮긴 뒤 다시 동기화 (스크럼에서 선택하려면)
4. `npm run verify:fwk` 3-way 표에서 DB/JIRA 누락 키 확인

## 관련 파일

- [`tests/daily-scrum-jira-interface.test.mjs`](../tests/daily-scrum-jira-interface.test.mjs) — 패널·선택 규칙
- [`tests/interface-pipeline.test.mjs`](../tests/interface-pipeline.test.mjs) — DB row·status·저장 검증
- [`scripts/verify-fwk-interface.mjs`](../scripts/verify-fwk-interface.mjs) — 실연동 3-way
