# JIRA → Supabase 데이터 정합성

## 마스터 키

| 필드 | 출처 | 역할 |
|------|------|------|
| `jira_issue_id` | JIRA REST `issue.id` | **유일 upsert 키** (`onConflict: jira_issue_id`) |
| `id` (PK) | = `jira_issue_id` | `parent_id` FK |
| `issue_key` | JIRA REST `issue.key` | 가변 (FWK-164 → FWK-220). **유니크 아님** |

`issue_key` 로 매핑·조인하면 번호 변경·재사용 시 고스트 데이터가 남습니다.

## 3방향 동기화

구현: [`src/lib/jira-tasks-upsert.ts`](../src/lib/jira-tasks-upsert.ts) (Edge: [`supabase/functions/_shared/jira-tasks-upsert.ts`](../supabase/functions/_shared/jira-tasks-upsert.ts))

1. **INSERT/UPDATE** — `.upsert(rows, { onConflict: 'jira_issue_id', ignoreDuplicates: false })`  
   summary, status, assignee, `issue_key` 등 JIRA 최신값으로 **항상 덮어쓰기**
2. **DELETE** — 현재 JIRA fetch 집합에 없는 `jira_issue_id` 행 제거 (고스트 수거)
3. **스크럼 키 마이그레이션** — 동일 `jira_issue_id`에서 `issue_key`만 바뀐 경우 `scrum_entries.selected_tasks` 갱신

## 마이그레이션

- `supabase/migrations/20260527120000_jira_tasks_master_jira_issue_id.sql` — `issue_key` 유니크 제거, `jira_issue_id` 유니크

배포 후:

```bash
npx supabase db push
# 또는 SQL Editor에서 마이그레이션 실행
```

## 검증

```bash
npm run test:interface   # upsert · key migration 단위 테스트 포함
npm run sync:jira:all    # CLI 전체 동기화
npm run test:edge-invoke # Edge + JIRA 인증
```
