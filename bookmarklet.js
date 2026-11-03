// msv-helper: 네이버 가격비교 n total 작업 보조.
// 고친 뒤에는 node scripts/build-oneline.js로 한 줄 버전을 다시 만든다.
(() => {
  const PANEL_ID = 'msv-helper-panel';

  // 상품타입 드롭다운의 제외 항목. value는 항목 data-shp-contents-dtl의 filter_value_id다.
  const EXCLUDES = [
    { label: '해외직구', value: 'exagency' },
    { label: '중고', value: 'exused' },
    { label: '렌탈', value: 'exrental' },
  ];

  // fo=true가 없으면 붙여서 다시 열고 끝낸다. 다시 열린 페이지에서 북마클릿을 한 번 더 누른다.
  // 검색어 인코딩을 그대로 두려고 URLSearchParams 대신 문자열로 다룬다.
  const pairs = location.search.replace(/^\?/, '').split('&').filter(Boolean);
  if (!pairs.includes('fo=true')) {
    const rest = pairs.filter((p) => p.split('=')[0] !== 'fo');
    location.href = location.pathname + '?' + rest.concat('fo=true').join('&') + location.hash;
    return;
  }

  const old = document.getElementById(PANEL_ID);
  if (old) old.remove();

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const waitFor = async (check, timeout) => {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      if (check()) return true;
      await sleep(100);
    }
    return false;
  };

  // 드롭다운의 토글과 항목은 모두 a[data-shp-area-id="pdtype"]이고, 항목에만 data-shp-contents-dtl이 있다.
  const findToggle = () => document.querySelector('a[data-shp-area-id="pdtype"]:not([data-shp-contents-dtl])');
  const findOption = (value) => {
    const links = document.querySelectorAll('a[data-shp-area-id="pdtype"][data-shp-contents-dtl]');
    for (const link of links) {
      try {
        const items = JSON.parse(link.getAttribute('data-shp-contents-dtl'));
        if (items.some((item) => item.key === 'filter_value_id' && item.value === value)) return link;
      } catch (err) {
        // 형식이 바뀐 항목은 건너뛴다.
      }
    }
    return null;
  };
  const toggleText = () => {
    const toggle = findToggle();
    return toggle ? toggle.textContent.trim() : '';
  };

  // 사람이 하듯 드롭다운을 열고 항목을 누른 뒤, 주소나 토글 글자가 바뀔 때까지 기다린다.
  const clickExclude = async (target) => {
    const option = findOption(target.value);
    if (!option) return target.label + ': 이 검색어에는 없음';
    const before = location.href + '|' + toggleText();
    const toggle = findToggle();
    if (toggle) {
      toggle.click();
      await sleep(300);
    }
    option.click();
    const changed = await waitFor(() => location.href + '|' + toggleText() !== before, 5000);
    if (!changed) return target.label + ': 눌렀지만 변화 없음';
    // 결과 목록이 다시 그려질 시간을 준다.
    await sleep(1500);
    return target.label + ': 적용 → ' + (toggleText() || '?');
  };

  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.style.cssText = [
    'position:fixed', 'top:12px', 'right:12px', 'z-index:2147483647',
    'width:220px', 'padding:10px', 'background:#fff', 'color:#222',
    'border:1px solid #03c75a', 'border-radius:8px',
    'box-shadow:0 4px 12px rgba(0,0,0,.2)', 'font:13px/1.4 sans-serif',
  ].join(';');

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;font-weight:bold';
  header.textContent = 'MSV helper';
  const close = document.createElement('button');
  close.textContent = '×';
  close.title = '닫기';
  close.style.cssText = 'border:0;background:none;font-size:16px;cursor:pointer;color:#666';
  close.onclick = () => panel.remove();
  header.appendChild(close);
  panel.appendChild(header);

  const status = document.createElement('div');
  status.style.cssText = 'margin-top:8px;font-size:12px;color:#666;white-space:pre-line';

  const buttons = [];
  const addButton = (text, run, primary) => {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = 'display:block;box-sizing:border-box;width:100%;margin-top:4px;padding:6px;'
      + 'border:1px solid ' + (primary ? '#03c75a' : '#ccc') + ';border-radius:4px;cursor:pointer;font:inherit;'
      + 'background:' + (primary ? '#03c75a;color:#fff' : '#f7f7f7;color:#222');
    btn.onclick = async () => {
      buttons.forEach((b) => { b.disabled = true; });
      status.textContent = '처리 중...';
      try {
        status.textContent = (await run()).join('\n');
      } catch (err) {
        status.textContent = '오류: ' + err.message;
      }
      buttons.forEach((b) => { b.disabled = false; });
    };
    buttons.push(btn);
    panel.appendChild(btn);
  };

  addButton('해외직구·중고·렌탈 모두 제외', async () => {
    const results = [];
    for (const target of EXCLUDES) {
      results.push(await clickExclude(target));
    }
    // 드롭다운이 하나만 고르는 방식이면 마지막 항목만 남으므로 최종 상태를 같이 보여준다.
    results.push('지금 상품타입: ' + (toggleText() || '?'));
    return results;
  }, true);
  for (const target of EXCLUDES) {
    addButton(target.label + ' 제외', async () => [await clickExclude(target)]);
  }

  // 결과가 이상하면 이 버튼으로 상태를 복사해 개발자에게 보낸다.
  const diag = document.createElement('button');
  diag.textContent = '진단 복사';
  diag.style.cssText = 'margin-top:8px;padding:2px 6px;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;font-size:11px;color:#666';
  diag.onclick = () => {
    const text = JSON.stringify({
      url: location.href,
      toggle: toggleText(),
      options: EXCLUDES.map((t) => t.value + ':' + !!findOption(t.value)),
      status: status.textContent,
    }, null, 1);
    navigator.clipboard.writeText(text).then(() => { diag.textContent = '복사함'; }, () => { prompt('복사해서 보내줘', text); });
  };

  // 개발용: 쇼핑몰선택을 열기 전과 연 뒤의 전체 HTML을 msv-dom-shoptype.html로 내려받는다.
  const dump = document.createElement('button');
  dump.textContent = 'DOM 덤프';
  dump.style.cssText = diag.style.cssText + ';margin-left:4px';
  dump.onclick = async () => {
    dump.disabled = true;
    dump.textContent = '덤프 중...';
    const toggle = document.querySelector('a[data-shp-area-id="shoptype"]');
    const meta = { url: location.href, open: 'shoptype', found: !!toggle };
    const before = document.documentElement.outerHTML;
    if (toggle) {
      toggle.click();
      await sleep(2500);
    }
    meta.urlAfterOpen = location.href;
    const after = document.documentElement.outerHTML;
    const file = ['<!--META ' + JSON.stringify(meta) + ' -->', '<!--BEFORE-->', before, '<!--AFTER-->', after].join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([file], { type: 'text/html' }));
    link.download = 'msv-dom-shoptype.html';
    link.click();
    dump.textContent = '덤프 저장함';
    dump.disabled = false;
  };

  panel.appendChild(status);
  panel.appendChild(diag);
  panel.appendChild(dump);
  document.body.appendChild(panel);
})();
