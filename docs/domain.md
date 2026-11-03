# 도메인

## 용어

- **MSV:** 팀의 시장조사 오퍼레이터.
- **capa:** 오퍼레이터의 생산성. 이 프로젝트의 목표는 작업을 단순하게 만들어 capa를 높이는 것이다.
- **n total:** 네이버 가격비교 검색 결과의 "전체" 탭(`search.shopping.naver.com/search/all`)에서 하는 시장조사.

## 네이버 가격비교 규칙

- **`fo=true`:** URL 쿼리에 붙이면 검색어 그대로만 검색한다("~로만 검색하기"). filter only의 약자로 보인다.
- **상품타입 필터:** 검색 결과 위 "상품타입(전체)" 드롭다운이다. 검색어에 따라 없거나 일부 항목만 있다. 페이지 데이터(`__NEXT_DATA__`)의 `subFilters` 중 `name: "productType"`이 정의다.

| 항목 | `filter_value_id` (`paramName`) | `excludeParam` |
|---|---|---|
| 해외직구보기 / 해외직구제외 | `agency` / `exagency` | 서로 반대쪽 |
| 중고보기 / 중고제외 | `used` / `exused` | 서로 반대쪽 |
| 렌탈보기 / 렌탈제외 | `rental` / `exrental` | 서로 반대쪽 |

- **드롭다운 DOM:** 토글과 항목이 모두 `a[data-shp-area-id="pdtype"]`이다. 항목에만 `data-shp-contents-dtl`이 있고, 그 JSON의 `filter_value_id`가 위 값이다. 드롭다운이 닫혀 있어도 항목은 DOM에 있고, 열리면 `subFilter_select_box__…`에 `open` 클래스가 붙는다. `__…` 뒤 해시는 배포마다 바뀔 수 있어 쓰지 않는다.
- **단일 선택 UI:** 필터 정의가 `multiSelect: false`라서 드롭다운으로는 한 번에 하나만 고르는 것으로 보인다. 실제로 확인하지는 않았다.
- **URL 직접 조작 금지:** `paramName`을 URL에 직접 붙이고 Next.js 라우터로 이동하면 검색 결과가 모두 사라졌다. 실제 클릭이 URL을 어떻게 바꾸는지는 아직 모른다.

## 북마클릿 동작

- **`fo=true`:** 없으면 붙여서 페이지를 다시 열고, 있을 때만 패널을 띄운다.
- **제외:** 사람이 하듯 토글을 누르고 `filter_value_id`로 찾은 항목을 클릭한 뒤, 주소나 토글 글자가 바뀔 때까지 기다린다. 클릭 뒤 DOM이 새로 그려지므로 항목은 매번 다시 찾는다. "모두 제외"는 셋을 차례로 누르고 마지막에 현재 상품타입을 보여준다.
