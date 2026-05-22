# 웹 푸시 알림 (스크럼 미입력) — 설정 가이드

프론트는 **React + Vite** 정적 배포(GitHub Pages), 백엔드는 **Supabase**(DB + Edge Functions)를 기준으로 합니다.  
이 저장소에는 다음이 포함되어 있습니다.

| 구분 | 경로 |
|------|------|
| DB 마이그레이션 | `supabase/migrations/20260529120000_web_push_notifications.sql` |
| 구독 저장 Edge Function | `supabase/functions/register-push-subscription/` |
| 알림 ON/OFF Edge Function | `supabase/functions/push-notification-preferences/` |
| 매일 푸시 발송 Edge Function | `supabase/functions/send-scrum-reminder-push/` |
| 수동 푸시 발송 Edge Function | `supabase/functions/send-manual-push/` |
| 서비스 워커 (정적) | `public/sw-push.js` |
| React용 클라이언트 헬퍼 | `src/lib/web-push-client.ts` |

---

## 1. DB 스키마 요약

### `notification_preferences`

- `app_user_id` (PK, `app_users.id` FK): 사용자당 1행
- `scrum_reminder_enabled`: 스크럼 미입력 알림 ON/OFF (기본값 없을 때는 Edge/쿼리에서 **ON으로 간주**)

### `push_subscriptions`

- `endpoint` (UNIQUE): 브라우저 `PushSubscription`의 endpoint
- `p256dh`, `auth`: Web Push 암호화용 키
- `app_user_id`: 구독 소유자

### “오늘 미작성” 판별 (`web_push_scrum_reminder_targets`)

- **오늘**은 DB에서 `timezone('Asia/Seoul', now())::date` 기준입니다.
- 아래 **둘 중 하나라도** 만족하면 “작성함”으로 봅니다.
  - `scrum_entries`: 해당 `member_id`로, 오늘 날짜에 `yesterday`/`today` 중 하나라도 비어 있지 않거나 `selected_tasks`가 비어 있지 않음
  - `daily_reports`: 같은 날 `is_completed = true`
- `notification_preferences.scrum_reminder_enabled = true`(또는 행 없음 = 기본 ON)이고, `push_subscriptions`가 있는 `app_users`만 대상입니다.
- 동일 사용자에 여러 기기 구독이 있으면 **가장 최근 `updated_at` 구독 1건만** 발송 대상(`DISTINCT ON (au.id)`).

비즈니스 규칙을 바꾸려면 위 SQL 함수만 수정하면 됩니다.

---

## 2. VAPID 키 생성 및 환경변수

### 키 생성 (로컬에 Node/npm이 있을 때)

```bash
npx web-push generate-vapid-keys
```

출력되는 **Public Key** / **Private Key**를 복사합니다.

### 프론트엔드 (Vite, GitHub Pages 빌드)

`.env` / GitHub Actions secrets 등에 **공개키만** 넣습니다.

```env
# Vite 클라이언트에 노출됨 (공개키만)
VITE_WEB_PUSH_PUBLIC_KEY=BKx...
```

이미 사용 중인 Supabase 변수:

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### Supabase Edge Functions → Secrets

Dashboard → **Edge Functions → Secrets** 에 다음을 등록합니다.

| Secret 이름 | 설명 |
|-------------|------|
| `VAPID_PUBLIC_KEY` | 위와 동일한 공개키 |
| `VAPID_PRIVATE_KEY` | 절대 프론트에 넣지 말 것 |
| `VAPID_SUBJECT` | (선택) `mailto:팀@도메인` — Web Push 관행상 연락처 |
| `CRON_SECRET` | 임의 긴 문자열 — 스케줄 호출이 이 값을 헤더로 보내야만 발송 |
| `PUBLIC_APP_URL` | (선택) `https://계정.github.io/저장소명` — 알림 클릭 시 열 URL; 없으면 SW scope 사용 |

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`는 Supabase가 Edge에 자동으로 넣는 경우가 많습니다. 없다면 동일 이름으로 Secrets에 추가합니다.

---

## 3. 프론트엔드 (React) 연동

### 서비스 워커

`public/sw-push.js`가 빌드 시 `dist/`로 복사됩니다.  
`src/lib/web-push-client.ts`의 `registerWebPushSubscription(loginId, password)`가:

1. `Notification.requestPermission()`
2. `navigator.serviceWorker.register(.../sw-push.js)`
3. `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`
4. `POST /functions/v1/register-push-subscription` 으로 `endpoint` / `p256dh` / `auth` 저장

### 설정 UI 예시

```tsx
import { registerWebPushSubscription, fetchScrumReminderPreference, setScrumReminderPreference } from "@/lib/web-push-client";

// 로그인 직후 또는 설정 화면에서
const r = await registerWebPushSubscription(loginId, password);
if (!r.ok) toast.error(r.error);

const pref = await fetchScrumReminderPreference(loginId, password);
if ("error" in pref) toast.error(pref.error);
else setToggle(pref.scrumReminderEnabled);

await setScrumReminderPreference(loginId, password, false);
```

> 현재 앱은 **커스텀 로그인(RPC)** 이라 JWT에 `app_user_id`가 없습니다. 그래서 구독/설정 API는 **Edge Function에서 `login_app_user`로 비밀번호 검증** 후 service role로 DB에 씁니다. 장기적으로는 Supabase Auth + RLS로 옮기는 편이 더 안전합니다.

---

## 4. Edge Function 배포

```bash
supabase functions deploy register-push-subscription --no-verify-jwt
supabase functions deploy push-notification-preferences --no-verify-jwt
supabase functions deploy send-scrum-reminder-push --no-verify-jwt
supabase functions deploy send-manual-push --no-verify-jwt
```

`supabase/config.toml`에 `verify_jwt = false`가 들어가 있으면 Dashboard 설정과 맞춰 주세요.

---

## 5. 매일 오전 10시 (한국) 실행

한국 표준시 **10:00** = UTC **01:00** (한국은 일광절약시 없음).

### 방법 A: Supabase **pg_cron** + **pg_net** (프로젝트에서 확장 사용 가능할 때)

SQL 에디터에서 (프로젝트 URL·시크릿은 본인 값으로 교체):

```sql
-- 확장 (이미 있으면 생략)
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'scrum-reminder-web-push',
  '0 1 * * *',  -- 매일 01:00 UTC = 10:00 KST
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-scrum-reminder-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', '<CRON_SECRET과_동일한_값>'
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
```

- `CRON_SECRET`은 Edge Function Secrets에 넣은 값과 **완전히 동일**해야 합니다.
- `net.http_post`는 비동기 큐이므로, Dashboard에서 `net._http_response` 등으로 실패 여부를 확인할 수 있습니다.

### 방법 B: GitHub Actions `schedule`

저장소에 워크플로를 두고 매일 UTC 01:00에 `curl`로 Edge Function을 호출합니다. Repository secrets에 `CRON_SECRET`, Supabase URL을 넣습니다.

### 방법 C: 외부 크론 (Uptime Kuma, cron-job.org 등)

`POST` + 헤더 `X-Cron-Secret: ...` 만 맞추면 됩니다.

---

## 6. 설정 화면에서 수동 알림

**설정 → 알림 설정**에서 제목·내용을 입력하고 **알림 발송**을 누릅니다.

1. 로그인 ID는 자동 표시, **비밀번호**는 구독·발송·ON/OFF 저장 시 본인 확인용으로 입력합니다.
2. **구독 등록**: 이 브라우저에서 푸시를 받을 수 있게 `register-push-subscription`을 호출합니다.
3. **수동 알림**: `POST /functions/v1/send-manual-push` — 구독이 있는 사용자에게만 발송합니다. `memberIds`를 넘기면 해당 `app_users.member_id`만 대상으로 합니다.

마이그레이션 `20260531120000_web_push_manual_targets.sql`의 RPC `web_push_manual_targets`가 배포되어 있어야 합니다.

---

## 7. 수동 테스트 (스크럼 리마인더)

```bash
curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/send-scrum-reminder-push" \
  -H "Content-Type: application/json" \
  -H "X-Cron-Secret: <CRON_SECRET>" \
  -d "{}"
```

응답의 `targets`, `sent`, `failed`를 확인합니다.  
구독이 없거나, 오늘 이미 스크럼을 썼거나, 알림 OFF면 `targets`는 0일 수 있습니다.

---

## 8. 보안·운영 참고

- **VAPID 개인키**와 **Service Role 키**는 브라우저·GitHub Pages 정적 파일에 넣지 마세요.
- `register-push-subscription` / `push-notification-preferences`는 요청마다 비밀번호를 받습니다. HTTPS만 사용하고, 가능하면 이후 **짧은 수명 세션 토큰**으로 교체하는 것을 권장합니다.
- 푸시 실패 시 `410`/`404`는 만료된 구독으로 보고 DB에서 `endpoint` 행을 삭제합니다 (`send-scrum-reminder-push`).

---

## 9. 문제 해결

| 증상 | 확인 |
|------|------|
| `subscribe` 실패 | `VITE_WEB_PUSH_PUBLIC_KEY`가 URL-safe Base64인지, HTTPS(또는 localhost)인지 |
| SW 등록 실패 | `vite`의 `base`와 실제 배포 경로가 같아야 함 (`BASE_URL`과 `sw-push.js` 경로) |
| Edge 401 | `X-Cron-Secret` 불일치 |
| 항상 targets 0 | `web_push_scrum_reminder_targets` 정의·`member_id` 매칭·오늘 날짜(서울) |

이 문서와 코드는 이 레포의 `app_users` / `scrum_entries` / `daily_reports` 스키마에 맞춰져 있습니다.
