# 구조

- `bookmarklet.js`: 북마클릿 전체 코드. 즉시 실행 함수 하나로 감싸 페이지 전역 변수를 건드리지 않는다. 로더가 원격 `main`에서 받아 실행한다.
- `loader.js`: 북마크에 넣는 로더 원본. `raw.githubusercontent.com`에서 `main`의 `bookmarklet.js`를 받아 `new Function`으로 실행하고, 실패하면 알림을 띄운다.
- `scripts/build-oneline.js`: 로더를 북마크 URL용 한 줄로 바꾸고, 풀어서 문법을 확인한다. `bookmarklet.js` 문법도 검사한다.
- `bookmarklet-oneline.js`: 생성된 한 줄 로더. 북마크 URL 칸에 그대로 붙인다.
- `scripts/dump-dom.js`: 개발용. 네이버 페이지 콘솔에서 실행하면 `OPEN`에 적은 토글을 열기 전후의 전체 HTML을 `msv-dom-<토글>.html`로 내려받는다. 패널의 "DOM 덤프" 버튼도 쇼핑몰선택 기준으로 같은 일을 한다. 덤프 파일은 커밋하지 않는다.
- `docs/`: 프로젝트 문서.

## 실행 흐름

북마크를 누르면 브라우저가 현재 페이지 안에서 `javascript:` URL의 로더를 실행하고, 로더가 받아 온 `bookmarklet.js`를 같은 페이지에서 실행한다. 페이지의 DOM과 전역 객체에 접근할 수 있지만, 페이지의 CSP가 막으면 실행되지 않을 수 있다.
