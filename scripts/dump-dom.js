// 개발용: 네이버 가격비교 페이지의 DOM을 msv-dom.html로 내려받는다.
// 크롬 개발자도구 콘솔에 이 파일 내용을 붙여 넣어 실행한다.
// 상품타입 드롭다운을 열기 전과 연 뒤의 전체 HTML을 같이 담는다.
(async () => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const matches = [...document.querySelectorAll('a, button, div, span')]
    .filter((el) => /^상품타입\(/.test(el.textContent.replace(/\s+/g, '')));
  const toggle = matches.find((el) => !matches.some((other) => other !== el && el.contains(other)));
  const meta = {
    url: location.href,
    toggle: toggle ? toggle.outerHTML.slice(0, 2000) : null,
    toggleParents: [],
  };
  for (let el = toggle, i = 0; el && i < 6; el = el.parentElement, i++) {
    meta.toggleParents.push(el.tagName + ' ' + el.className);
  }
  const before = document.documentElement.outerHTML;
  if (toggle) {
    (toggle.closest('a, button') || toggle).click();
    await sleep(1500);
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
  a.download = 'msv-dom.html';
  a.click();
  console.log('msv-dom.html 저장함', meta);
})();
