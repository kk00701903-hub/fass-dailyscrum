# Supabase Realtime Presence (팀원 접속)

## DB 마이그레이션

**필요 없음.** Presence는 Postgres 테이블이 아니라 Realtime 채널 `online-users` 위에서 동작합니다.

## Supabase 대시보드 설정

1. [Project Settings → API](https://supabase.com/dashboard/project/_/settings/api)에서 URL·anon key 확인 (`.env.local`과 동일).
2. **Realtime**이 활성화되어 있는지 확인 (기본적으로 켜져 있음).
3. 별도 publication에 presence 채널을 추가할 필요 없습니다.

## 동작

- 로그인 후 `AppShell` 마운트 시 `useTeamPresence`가 채널을 구독하고 `track()`으로 본인 정보를 전송합니다.
- 로그아웃·탭 종료(`pagehide`)·컴포넌트 unmount 시 `untrack()` 및 `removeChannel()`로 접속 종료를 반영합니다.
- 사이드바 **팀원** 팝오버에서 초록 점 = 접속 중, 회색 점·반투명 = 오프라인.

## payload 필드

`user_id`, `login_id`, `member_id`, `display_name`, `name`, `avatar`, `online_at`
