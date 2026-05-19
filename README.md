# 기술 스택

이 프로젝트는 다음 기술 스택을 사용합니다.

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

# 개발 흐름

1. 사용자 요구에 맞춰 `src/index.css`와 Tailwind 관련 설정의 테마·스타일을 조정합니다.
2. 사용자 요구에 따라 구현할 페이지를 나눕니다.
3. 페이지별로 필요한 기능을 정리한 뒤, `src/pages` 아래에 해당 페이지 컴포넌트(예: `Something.tsx`)를 만듭니다.
4. `App.tsx`에 라우트를 추가하고 방금 만든 페이지를 연결합니다.
5. 요구가 단순하면 해당 페이지 파일 하나에서 화면을 모두 구현할 수 있습니다.
6. 요구가 복잡하면 페이지를 여러 컴포넌트로 나누어 구현합니다. 예시 구조는 다음과 같습니다.
   - 페이지 진입 컴포넌트
   - `components/` — UI 컴포넌트
   - `hooks/` — 커스텀 훅
   - `stores/` — 상태가 복잡할 때 zustand 등으로 모듈화
7. 구현이 끝나면 `pnpm i`(또는 `npm install`)로 의존성을 설치하고, `npm run lint`와 `npx tsc --noEmit -p tsconfig.app.json --strict`로 검사한 뒤 문제를 수정합니다.

# 백엔드·API 연동

- 새 API나 Supabase 연동이 필요하면 먼저 `src/api`에 API 모듈을 추가하고, 사용할 데이터 타입을 export합니다. 예시는 `src/api/demo.ts` 등을 참고합니다. Supabase를 쓰는 경우 타입과 구현을 맞춥니다.
- 프론트엔드와 Supabase를 구현할 때는 정해 둔 데이터 타입을 최대한 유지하고, 타입을 바꿀 경우 해당 타입을 참조하는 모든 파일을 다시 확인합니다.
