# msv-helper-bookmarklet

팀의 시장조사 오퍼레이터(MSV)가 네이버 가격비교에서 하는 반복 작업을 줄여 생산성(capa)을 높이는 북마클릿이다. 팀 내부용이다. 북마크에는 짧은 로더(`loader.js`를 한 줄로 바꾼 `bookmarklet-oneline.js`)만 넣고, 로더가 누를 때마다 원격 `main`의 `bookmarklet.js`를 받아 실행한다.

## 꼭 지킬 것

- `main`에 푸시하면 5분쯤 안에 모든 팀원의 북마크에 반영된다. 확인하지 않은 코드는 `main`에 올리지 않는다.
- `loader.js`를 고치면 `node scripts/build-oneline.js`로 `bookmarklet-oneline.js`를 다시 만들어 같은 커밋에 넣는다. `bookmarklet-oneline.js`는 직접 고치지 않는다.
- 평소에는 로컬 작업 브랜치에 커밋만 하고 푸시하지 않는다. 소유자가 됐다고 하면 그때 `main`에 합치고 푸시한다.

## 명령

- 한 줄 로더 만들기: `node scripts/build-oneline.js`. 로더를 풀어서 문법 검사하고, `bookmarklet.js` 문법도 검사한다.
- 실행: 북마크를 새로 만들고 URL 칸에 `bookmarklet-oneline.js` 내용을 그대로 붙여 넣는다. 대상 페이지에서 그 북마크를 누른다. 로더는 한 번만 붙이면 된다.
- 푸시 전 로컬 코드 확인: 로더는 `main`을 받으므로, 작업 중인 코드는 대상 페이지 콘솔에 `bookmarklet.js` 내용을 붙여 실행해 본다.
- 합치기 전 검사: `node --check bookmarklet.js`와 `node scripts/build-oneline.js`. 뒤 명령 후 `git status`에 `bookmarklet-oneline.js` 변경이 없어야 한다.

## 문서

- `docs/domain.md`: 대상 사이트의 규칙, 용어, 계산 기준. 핵심 동작을 고치기 전에 읽는다.
- `docs/architecture.md`: 구조와 데이터 흐름. 구조를 바꾸거나 처음 맡은 영역을 고치기 전에 읽는다.
- `docs/decisions.md`: 왜 그렇게 정했는지와 버린 대안. 정해진 방식을 바꾸기 전에 읽는다.
- `docs/workflow.md`: 합치기 절차. 합치기 전에 읽는다.
- `docs/todo.md`: 남은 일과 확인 기록. 다음 작업을 찾거나 기록을 남길 때 읽는다.

## 문서 관리

- 이 파일에는 항상 지킬 규칙과 안내만 두고, 자세한 절차와 설명은 `docs/`에 둔다. `@`로 불러오면 매번 읽히므로 경로만 적는다.
- `docs/`의 규칙 문서에는 날짜별 기록을 넣지 않는다. 확인 기록은 `docs/todo.md`에 남긴다.
- 동작을 바꾸면 관련 문서도 같이 고친다.
