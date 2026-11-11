# 구조

- `bookmarklet.js`: 북마클릿 전체 코드. 즉시 실행 함수 하나로 감싸 페이지 전역 변수를 건드리지 않는다. 로더가 원격 `main`에서 받아 실행한다.
- `loader.js`: 북마크에 넣는 로더 원본. `raw.githubusercontent.com`에서 `main`의 `bookmarklet.js`를 받아 `new Function`으로 실행하고, 실패하면 알림을 띄운다.
- `scripts/build-oneline.js`: `bookmarklet.js`와 `loader.js`를 각각 북마크 URL용 한 줄로 바꾸고, 풀어서 문법을 확인한다.
- `loader-oneline.js`: 생성된 한 줄 로더. 팀원이 북마크 URL 칸에 그대로 붙인다.
- `bookmarklet-oneline.js`: 생성된 코드 전체 한 줄. 원격 없이 지금 코드를 바로 돌려 볼 때 북마크로 붙인다.
- `py-bookmarklet.js`: 파이썬 로더가 넣는 코드. `bookmarklet.js`를 바탕으로 iframe을 빼고 페이지를 바로 다룬다. 검색 페이지에서는 패널을 띄우고, NPCS(`/catalog`)에서는 "동일 판매처 묶어보기"만 끈다. `fo=true`를 붙이느라 페이지를 새로 열면 코드도 사라지므로, 이어서 할 제외는 sessionStorage(`msv-helper-next`)에 적어 두고 다시 들어올 때 잇는다. 한 줄로 바꾸지 않는다.
- `python/msv_helper.py`: 파이썬 로더(시험 중). 자동화 전용 프로필(`%LOCALAPPDATA%\msv-helper\chrome-profile`)로 Chrome을 디버그 포트 9333에 띄우거나 이미 떠 있으면 붙는다. Playwright로 모든 탭을 지켜보다가 `search.shopping.naver.com/search/`나 `/catalog` 페이지가 새로 열릴 때마다 HTML을 다 읽은 시점(`domcontentloaded`)에 `py-bookmarklet.js`를 읽어 `new Function`으로 넣는다. 이미지와 광고를 다 받는 `load`보다 빠르다. 이 시점에는 네이버 React가 요소에 아직 연결되지 않았을 수 있어서, 코드가 알아서 누르는 일(이어서 하는 제외, 카탈로그 묶어보기 끄기)은 요소에 `__react` 속성이 생긴 뒤에 누른다. 네이버가 연 새 탭도 잡는다. Chrome을 닫으면 끝난다. `python/msv-helper.bat`는 더블클릭 실행용이고, `python/requirements.txt`에 Playwright 버전을 둔다.
- `scripts/dump-dom.js`: 개발용. 네이버 페이지 콘솔에서 실행하면 `OPEN`에 적은 토글을 열기 전후의 전체 HTML을 `msv-dom-<토글>.html`로 내려받는다. 패널의 "DOM 덤프" 버튼도 쇼핑몰선택 기준으로 같은 일을 한다. 덤프 파일은 커밋하지 않는다.
- `docs/`: 프로젝트 문서.

## 실행 흐름

북마크를 누르면 브라우저가 현재 페이지 안에서 `javascript:` URL의 코드를 실행한다. 로더면 받아 온 `bookmarklet.js`를 같은 페이지에서 실행하고, 전체 한 줄이면 그대로 실행한다. 페이지의 DOM과 전역 객체에 접근할 수 있지만, 페이지의 CSP가 막으면 실행되지 않을 수 있다.
