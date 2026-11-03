# 도메인

## 용어

- **MSV:** 팀의 시장조사 오퍼레이터.
- **capa:** 오퍼레이터의 생산성. 이 프로젝트의 목표는 작업을 단순하게 만들어 capa를 높이는 것이다.
- **n total:** 네이버 가격비교 검색 결과의 "전체" 탭(`search.shopping.naver.com/search/all`)에서 하는 시장조사.

## 네이버 가격비교 규칙

- **`fo=true`:** URL 쿼리에 붙이면 검색어 그대로만 검색한다("~로만 검색하기"). filter only의 약자로 보인다.
- **상품타입 필터:** 검색 결과 위 "상품타입(전체)" 드롭다운이다. 검색어에 따라 없거나 일부 항목만 있다. 페이지 데이터(`__NEXT_DATA__`)의 `subFilters` 중 `name: "productType"`이 정의다.

| 항목 | URL 파라미터 | 같이 지우는 파라미터 |
|---|---|---|
| 해외직구보기 / 해외직구제외 | `agency=true` / `exagency=true` | 서로 반대쪽 |
| 중고보기 / 중고제외 | `used=true` / `exused=true` | 서로 반대쪽 |
| 렌탈보기 / 렌탈제외 | `rental=true` / `exrental=true` | 서로 반대쪽 |

- **드롭다운 DOM:** 토글과 항목이 모두 `a[data-shp-area-id="pdtype"]`이다. 항목에만 `data-shp-contents-dtl`이 있고, 그 JSON의 `filter_value_id`가 위 파라미터 이름이다. 드롭다운이 닫혀 있어도 항목은 DOM에 있고, 열리면 `subFilter_select_box__…`에 `open` 클래스가 붙는다. `__…` 뒤 해시는 배포마다 바뀔 수 있어 쓰지 않는다.
- **단일 선택 UI:** 필터 정의가 `multiSelect: false`라서 드롭다운으로는 한 번에 하나만 고르는 것으로 보인다. 세 가지를 같이 제외하려면 파라미터를 함께 붙인다.

## 북마클릿 동작

- **`fo=true`:** 없으면 붙여서 페이지를 다시 열고, 있을 때만 패널을 띄운다.
- **제외:** 어떤 항목이 있는지는 드롭다운 DOM에서 읽고, 적용은 그 항목의 파라미터를 URL에 붙여서 한다. 이동은 페이지의 Next.js 라우터(`window.next.router.push`)로 해서 패널이 남는다. 라우터가 없으면 페이지를 새로 연다.
