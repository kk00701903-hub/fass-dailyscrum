# JIRA 인증 — 서버 전용 토큰 (재발급 최소화)

Atlassian API 토큰은 **기본 최대 365일** 만료입니다. 개발자마다 토큰을 발급·갱신하지 않도록 **팀 공용 서비스 계정 1개**만 쓰고, 인증 정보는 **Supabase Edge 시크릿**에만 둡니다.

## 권장 구성

| 항목 | 내용 |
|------|------|
| Atlassian 계정 | 전용 계정 1개 (예: `scrum-sync@회사.com`) — 개인 계정과 분리 |
| API 토큰 | [API tokens](https://id.atlassian.com/manage-profile/security/api-tokens)에서 생성, **만료 365일** |
| 저장 위치 | Supabase Dashboard → **Edge Functions → Secrets** (Vault 아님) |
| 로컬 `.env.local` | `VITE_SUPABASE_*` + `VITE_JIRA_BOARD_ID` 만 필수. `VITE_JIRA_API_TOKEN` **불필요** |

## Vault vs Edge Secrets (자주 헷갈림)

| 위치 | 용도 | JIRA 동기화 |
|------|------|-------------|
| **Project → Vault → Secrets** | DB 암호화·Vault 확장 | **사용 안 함** |
| **Edge Functions → Secrets** | `jira-proxy`, `sync-jira-all` 의 `Deno.env.get("JIRA_*")` | **여기에 등록** |
| **GitHub → Settings → Secrets → Actions** | `jira-sync.yml`, `deploy-supabase-edge.yml` | **별도 등록** |

Vault에 `JIRA_API_TOKEN`만 넣어도 Edge는 읽지 않습니다.  
로컬 `.env.local`과 동일 값을 Edge에 반영:

```bash
# sbp_ 토큰: Dashboard → Account → Access Tokens
$env:SUPABASE_ACCESS_TOKEN="sbp_..."
npm run secrets:push-jira
npm run test:edge-invoke
```

## Supabase Edge Secrets (단일 소스)

| Secret | 예시 |
|--------|------|
| `JIRA_BASE_URL` | `https://your-org.atlassian.net` |
| `JIRA_EMAIL` | 서비스 계정 이메일 |
| `JIRA_API_TOKEN` | 해당 계정 API 토큰 |
| `JIRA_BOARD_ID` | 스크럼 보드 ID (숫자) |
| `JIRA_PROJECT_KEY` | (선택) `FWK` 등 |

배포 대상 함수: `jira-proxy`, `sync-jira-all`, `sync-jira-sprints`

```bash
npx supabase functions deploy jira-proxy sync-jira-all sync-jira-sprints --no-verify-jwt
```

## GitHub Actions (일일 배치)

[`.github/workflows/jira-sync.yml`](../.github/workflows/jira-sync.yml)는 **동일한** `JIRA_EMAIL` / `JIRA_API_TOKEN`을 Repository Secrets에 넣습니다.

갱신 시 **Supabase Secrets와 GitHub Secrets를 같은 날·같은 토큰으로** 맞추세요.

## 앱·개발 서버 동작

```text
브라우저 / npm run dev
    → Supabase Edge jira-proxy (서버에 저장된 JIRA_* 사용)
    → JIRA Cloud

(선택) 로컬 VITE_JIRA_* + Vite 프록시 — Edge 미배포·디버그용만
```

- 운영(GitHub Pages): 처음부터 Edge만 사용 ([`jira-client.ts`](../src/lib/jira-client.ts))
- 개발: Edge 우선, 실패 시에만 로컬 프록시 fallback

## 토큰 갱신 절차 (연 1회 권장)

1. 서비스 계정으로 Atlassian에서 **새 API 토큰** 발급 (만료 365일)
2. Supabase Edge Secrets `JIRA_API_TOKEN` 갱신
3. GitHub Actions Secrets `JIRA_API_TOKEN` 갱신
4. (선택) 로컬 디버그용 `VITE_JIRA_API_TOKEN` 갱신
5. 검증:

```bash
npm run test:jira
npm run verify:jira-sync
```

6. 앱에서 **JIRA 동기화** 또는 `npm run sync:jira:all` 실행

## 로컬 CLI 동기화

`npm run sync:jira:all`은 **Node**에서 `JIRA_API_TOKEN`(접두사 없음)을 읽습니다. 개인 토큰 없이 하려면:

- 앱/브라우저에서 동기화 버튼 사용 (Edge), 또는
- CI/GitHub Actions `workflow_dispatch` 사용

## OAuth (중기)

수동 토큰 없이 refresh 자동 갱신이 필요하면 [`docs/JIRA_OAUTH_FUTURE.md`](JIRA_OAUTH_FUTURE.md) 설계안을 참고하세요.

## 관련 문서

- [README.md](../README.md) — 환경 변수·트러블슈팅
- [INTERFACE_TEST.md](INTERFACE_TEST.md) — 연동 테스트
