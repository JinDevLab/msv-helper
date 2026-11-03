// 개발용: 네이버 가격비교 페이지의 DOM을 msv-dom.html로 내려받는다.
// 크롬 개발자도구 콘솔에 이 파일 내용을 붙여 넣어 실행한다.
// OPEN에 적은 토글(data-shp-area-id)을 열기 전과 연 뒤의 전체 HTML을 같이 담는다.
(async () => {
  const OPEN = 'shoptype';
  const WAIT_MS = 2500;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const toggle = document.querySelector('a[data-shp-area-id="' + OPEN + '"]:not([data-shp-contents-dtl])');
  const meta = {
    url: location.href,
    open: OPEN,
    toggle: toggle ? toggle.outerHTML.slice(0, 2000) : null,
  };
  const before = document.documentElement.outerHTML;
  if (toggle) {
    toggle.click();
    await sleep(WAIT_MS);
  }
  meta.urlAfterOpen = location.href;
  const after = document.documentElement.outerHTML;
  const body = [
    '<!--META ' + JSON.stringify(meta, null, 1) + ' -->',
    '<!--BEFORE-->', before,
    '<!--AFTER-->', after,
  ].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([body], { type: 'text/html' }));
  a.download = 'msv-dom-' + OPEN + '.html';
  a.click();
  console.log('msv-dom-' + OPEN + '.html 저장함', meta);
})();
