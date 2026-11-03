// msv-helper: 네이버 가격비교 n total 작업 보조.
// 고친 뒤에는 node scripts/build-oneline.js로 한 줄 버전을 다시 만든다.
(() => {
  const PANEL_ID = 'msv-helper-panel';
  const FRAME_ID = 'msv-helper-frame';

  // 상품타입 드롭다운의 제외 항목. value는 항목 data-shp-contents-dtl의 filter_value_id다.
  const EXCLUDES = [
    { label: '해외직구', value: 'exagency' },
    { label: '중고', value: 'exused' },
    { label: '렌탈', value: 'exrental' },
  ];

  // fo=true가 없으면 붙인 주소를, 있으면 null을 돌려준다.
  // 검색어 인코딩을 그대로 두려고 URLSearchParams 대신 문자열로 다룬다.
  const withFo = (loc) => {
    const pairs = loc.search.replace(/^\?/, '').split('&').filter(Boolean);
    if (pairs.includes('fo=true')) return null;
    const rest = pairs.filter((p) => p.split('=')[0] !== 'fo');
    return loc.pathname + '?' + rest.concat('fo=true').join('&') + loc.hash;
  };

  // 한 번만 누르면 되도록 지금 페이지 위에 같은 사이트를 iframe으로 띄우고, 패널은 바깥 페이지에 둔다.
  // iframe 안에서 다시 검색해도 패널은 남는다. 네이버는 X-Frame-Options와 CSP가 없어 iframe이 열린다.
  const oldFrame = document.getElementById(FRAME_ID);
  const start = new URL(oldFrame ? oldFrame.contentWindow.location.href : location.href);
  if (oldFrame) oldFrame.remove();
  const oldPanel = document.getElementById(PANEL_ID);
  if (oldPanel) oldPanel.remove();

  const frame = document.createElement('iframe');
  frame.id = FRAME_ID;
  frame.src = withFo(start) || start.pathname + start.search + start.hash;
  frame.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;border:0;margin:0;z-index:2147483646;background:#fff';
  document.documentElement.style.overflow = 'hidden';
  document.body.appendChild(frame);
  const win = () => frame.contentWindow;
  const doc = () => frame.contentDocument;

  // iframe 주소를 바깥 주소창에 맞추고, 새로 검색해서 fo=true가 빠지면 다시 붙인다.
  const sync = setInterval(() => {
    if (!frame.isConnected) {
      clearInterval(sync);
      return;
    }
    let loc;
    try {
      loc = win().location;
      if (loc.href === 'about:blank') return;
    } catch (err) {
      // 다른 사이트로 나가면 읽을 수 없다.
      return;
    }
    const next = loc.pathname === '/search/all' && withFo(loc);
    if (next) {
      loc.replace(next);
    } else if (location.href !== loc.href) {
      history.replaceState(null, '', loc.href);
    }
  }, 500);

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
  const findToggle = () => doc().querySelector('a[data-shp-area-id="pdtype"]:not([data-shp-contents-dtl])');
  const findOption = (value) => {
    const links = doc().querySelectorAll('a[data-shp-area-id="pdtype"][data-shp-contents-dtl]');
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
    const before = win().location.href + '|' + toggleText();
    const toggle = findToggle();
    if (toggle) {
      toggle.click();
      await sleep(300);
    }
    option.click();
    const changed = await waitFor(() => win().location.href + '|' + toggleText() !== before, 5000);
    if (!changed) return target.label + ': 눌렀지만 변화 없음';
    // 결과 목록이 다시 그려질 시간을 준다.
    await sleep(1500);
    return target.label + ': 적용 → ' + (toggleText() || '?');
  };

  // 쇼핑몰선택 레이어. 열 때 목록을 불러오고, 열리면 레이어에 open 클래스가 붙는다.
  // 목록 항목은 li[data-shp-area-id="shop"]이고 data-shp-contents-dtl의 filter_value_id가 몰 번호다.
  const COUPANG = { label: '쿠팡', value: '613264' };
  const filterValue = (el) => {
    try {
      const item = JSON.parse(el.getAttribute('data-shp-contents-dtl')).find((i) => i.key === 'filter_value_id');
      return item ? item.value : null;
    } catch (err) {
      return null;
    }
  };
  const mallItems = () => Array.from(doc().querySelectorAll('li[data-shp-area-id="shop"][data-shp-contents-dtl]'));
  const findMall = (mall) => mallItems().find((li) => filterValue(li) === mall.value || li.getAttribute('data-shp-contents-id') === mall.label);
  const isChecked = (li) => {
    const input = li && li.querySelector('input[type="checkbox"]');
    return !!(input && input.checked);
  };
  // 사람이 누르는 곳인 label을 누른다.
  const clickMall = (li) => (li.querySelector('label') || li).click();

  const selectOnlyMall = async (mall) => {
    const toggle = doc().querySelector('a[data-shp-area-id="shoptype"]');
    if (!toggle) return mall.label + ': 쇼핑몰선택이 없는 화면';
    const layer = toggle.parentElement.querySelector('[class*="subFilter_layer_mall"]');
    if (!layer || !layer.classList.contains('open')) {
      toggle.click();
    }
    if (!(await waitFor(() => findMall(mall), 3000))) {
      const tab = doc().querySelector('li[data-shp-area-id="shoptab"][data-shp-contents-type="오픈마켓/종합몰"] a');
      if (tab) {
        tab.click();
        await waitFor(() => findMall(mall), 3000);
      }
    }
    const target = findMall(mall);
    if (!target) return mall.label + ': 쇼핑몰 목록에 없음';

    for (const li of mallItems()) {
      if (li !== target && isChecked(li)) {
        clickMall(li);
        await sleep(150);
      }
    }
    if (!isChecked(target)) {
      clickMall(target);
      await sleep(300);
    }

    const save = doc().querySelector('a[data-shp-area-id="shoptypesave"]');
    if (!save) return mall.label + ': 저장 버튼이 없음';
    const before = win().location.href;
    save.click();
    if (!(await waitFor(() => win().location.href !== before, 5000))) return mall.label + ': 저장했지만 주소 변화 없음';
    await sleep(1500);
    return mall.label + '만 선택함';
  };


  // 판매처 탭 "전체" 옆 숫자. 쿠팡만 선택하기 전에는 전체 수, 뒤에는 쿠팡 수다.
  const readTotal = () => {
    const tabs = Array.from(doc().querySelectorAll('li[data-shp-area-id="tab"][data-shp-contents-dtl]'));
    const total = tabs.find((li) => filterValue(li) === 'total');
    const num = total && total.querySelector('[class*="subFilter_num"]');
    return num ? num.textContent.trim() : null;
  };

  // 패널은 n total 작업 순서(docs/domain.md)대로 나눈다. 혼재 제거는 사람이 하므로 안내만 둔다.
  const make = (tag, text, style) => {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (style) node.style.cssText = style;
    return node;
  };
  const GREEN = '#03c75a';
  const PRIMARY = 'display:block;box-sizing:border-box;width:100%;padding:7px;border:0;border-radius:6px;'
    + 'background:' + GREEN + ';color:#fff;font:bold 13px sans-serif;cursor:pointer';
  const SMALL = 'flex:1;padding:5px 0;border:1px solid #e1e4e8;border-radius:6px;background:#f5f6f8;'
    + 'color:#333;font:12px sans-serif;cursor:pointer';
  const LINK = 'border:0;background:none;padding:0;margin-left:8px;color:#999;font:11px sans-serif;cursor:pointer';

  const panel = make('div', '', [
    'position:fixed', 'top:12px', 'right:12px', 'z-index:2147483647', 'width:236px',
    'padding:12px', 'background:#fff', 'color:#222', 'border:1px solid #dfe3e8', 'border-radius:10px',
    'box-shadow:0 6px 20px rgba(0,0,0,.15)', 'font:13px/1.4 sans-serif', 'text-align:left',
  ].join(';'));
  panel.id = PANEL_ID;

  const header = make('div', '', 'display:flex;justify-content:space-between;align-items:center;margin-bottom:10px');
  header.appendChild(make('strong', 'MSV · n total', 'font-size:14px'));
  const close = make('button', '×', 'border:0;background:none;padding:0 2px;font-size:18px;line-height:1;color:#999;cursor:pointer');
  close.title = '닫기';
  // 닫으면 iframe에서 보던 주소를 바깥 페이지로 그대로 연다.
  close.onclick = () => {
    clearInterval(sync);
    let href = null;
    try {
      href = win().location.href;
    } catch (err) {
      // 다른 사이트로 나갔으면 원래 페이지로 돌아간다.
    }
    panel.remove();
    frame.remove();
    document.documentElement.style.overflow = '';
    if (href && href !== 'about:blank') location.href = href;
  };
  header.appendChild(close);
  panel.appendChild(header);

  const step = (num, title) => {
    const box = make('div', '', 'margin-top:10px');
    const head = make('div', '', 'display:flex;align-items:center;margin-bottom:6px;font-weight:bold;font-size:12px;color:#444');
    head.appendChild(make('span', String(num), 'display:inline-block;width:18px;height:18px;margin-right:6px;border-radius:50%;'
      + 'background:' + GREEN + ';color:#fff;font-size:11px;line-height:18px;text-align:center'));
    head.appendChild(document.createTextNode(title));
    box.appendChild(head);
    panel.appendChild(box);
    return box;
  };

  const status = make('div', '', 'margin-top:10px;font-size:11px;color:#888;white-space:pre-line');

  // 작업 중에는 모든 버튼을 막아 같은 동작이 겹치지 않게 한다.
  const actions = [];
  const action = (btn, run) => {
    btn.onclick = async () => {
      actions.forEach((b) => { b.disabled = true; b.style.opacity = '.5'; });
      status.textContent = '처리 중...';
      try {
        status.textContent = (await run()).join('\n');
      } catch (err) {
        status.textContent = '오류: ' + err.message;
      }
      actions.forEach((b) => { b.disabled = false; b.style.opacity = ''; });
    };
    actions.push(btn);
    return btn;
  };

  const step1 = step(1, '해외직구·중고·렌탈 제외');
  step1.appendChild(action(make('button', '모두 제외', PRIMARY), async () => {
    const results = [];
    for (const target of EXCLUDES) {
      results.push(await clickExclude(target));
    }
    // 드롭다운이 하나만 고르는 방식이면 마지막 항목만 남으므로 최종 상태를 같이 보여준다.
    results.push('지금 상품타입: ' + (toggleText() || '?'));
    return results;
  }));
  const singles = make('div', '', 'display:flex;gap:4px;margin-top:4px');
  for (const target of EXCLUDES) {
    const btn = make('button', target.label, SMALL);
    btn.title = target.label + '만 제외';
    singles.appendChild(action(btn, async () => [await clickExclude(target)]));
  }
  step1.appendChild(singles);

  const step2 = step(2, '혼재 제거');
  step2.appendChild(make('div', '검색창에 -단어를 붙여 혼재를 뺀다.', 'font-size:12px;color:#666'));

  // 칸반(스프레드시트)에 붙일 한 줄: 검색어, URL, 전체 수, 쿠팡 수를 탭으로 나눈다.
  // URL은 쿠팡을 고르기 전 "전체" 상태의 주소다. 숫자는 쉼표를 빼서 숫자 칸으로 들어가게 한다.
  const searchQuery = () => {
    const pair = win().location.search.replace(/^\?/, '').split('&').find((p) => p.split('=')[0] === 'query');
    return pair ? decodeURIComponent(pair.slice(6).replace(/\+/g, ' ')) : '';
  };
  const toNumber = (text) => (text || '').replace(/[^0-9]/g, '');
  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      return false;
    }
  };

  const step3 = step(3, '전체 수 · 쿠팡 수');
  const counts = make('div', '', 'display:none;margin-top:6px;padding:6px 8px;border-radius:6px;background:#f0faf4;font-size:12px');
  let row = '';
  step3.appendChild(action(make('button', '쿠팡만 선택', PRIMARY), async () => {
    const query = searchQuery();
    const url = win().location.href;
    const total = readTotal();
    const result = await selectOnlyMall(COUPANG);
    if (!result.endsWith('만 선택함')) return [result];
    const coupang = readTotal();
    row = [query, url, toNumber(total), toNumber(coupang)].join('\t');

    counts.textContent = '';
    counts.appendChild(document.createTextNode('전체 '));
    counts.appendChild(make('b', total || '?'));
    counts.appendChild(document.createTextNode(' · 쿠팡 '));
    counts.appendChild(make('b', coupang || '?'));
    // 자동 복사가 막히면(클릭 뒤 시간이 지나면 브라우저가 막는다) 이 버튼으로 다시 복사한다.
    const again = make('button', '복사', 'float:right;border:0;background:none;padding:0;color:' + GREEN + ';font:bold 12px sans-serif;cursor:pointer');
    again.onclick = async () => {
      status.textContent = (await copyText(row)) ? '칸반용 한 줄을 복사했어.' : '복사 실패';
    };
    counts.appendChild(again);
    counts.style.display = 'block';

    const copied = await copyText(row);
    return [result, copied ? '칸반용 한 줄을 복사했어. 시트에 붙여 넣어.' : '자동 복사가 막혔어. 숫자 옆 "복사"를 눌러.'];
  }));
  step3.appendChild(counts);

  panel.appendChild(status);

  // 개발용 버튼은 맨 아래 작게 둔다.
  const footer = make('div', '', 'margin-top:8px;text-align:right');

  // 결과가 이상하면 이 버튼으로 상태를 복사해 개발자에게 보낸다.
  const diag = make('button', '진단 복사', LINK);
  diag.onclick = () => {
    const text = JSON.stringify({
      url: win().location.href,
      toggle: toggleText(),
      options: EXCLUDES.map((t) => t.value + ':' + !!findOption(t.value)),
      total: readTotal(),
      status: status.textContent,
    }, null, 1);
    navigator.clipboard.writeText(text).then(() => { diag.textContent = '복사함'; }, () => { prompt('복사해서 보내줘', text); });
  };

  // 개발용: 쇼핑몰선택을 열기 전과 연 뒤의 전체 HTML을 msv-dom-shoptype.html로 내려받는다.
  const dump = make('button', 'DOM 덤프', LINK);
  dump.onclick = async () => {
    dump.disabled = true;
    dump.textContent = '덤프 중...';
    const toggle = doc().querySelector('a[data-shp-area-id="shoptype"]');
    const meta = { url: win().location.href, open: 'shoptype', found: !!toggle };
    const before = doc().documentElement.outerHTML;
    if (toggle) {
      toggle.click();
      await sleep(2500);
    }
    meta.urlAfterOpen = win().location.href;
    const after = doc().documentElement.outerHTML;
    const file = ['<!--META ' + JSON.stringify(meta) + ' -->', '<!--BEFORE-->', before, '<!--AFTER-->', after].join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([file], { type: 'text/html' }));
    link.download = 'msv-dom-shoptype.html';
    link.click();
    dump.textContent = '덤프 저장함';
    dump.disabled = false;
  };

  footer.appendChild(diag);
  footer.appendChild(dump);
  panel.appendChild(footer);
  document.body.appendChild(panel);
})();
