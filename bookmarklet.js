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
  const mallItems = () => Array.from(document.querySelectorAll('li[data-shp-area-id="shop"][data-shp-contents-dtl]'));
  const findMall = (mall) => mallItems().find((li) => filterValue(li) === mall.value || li.getAttribute('data-shp-contents-id') === mall.label);
  const isChecked = (li) => {
    const input = li && li.querySelector('input[type="checkbox"]');
    return !!(input && input.checked);
  };
  // 사람이 누르는 곳인 label을 누른다.
  const clickMall = (li) => (li.querySelector('label') || li).click();

  const selectOnlyMall = async (mall) => {
    const toggle = document.querySelector('a[data-shp-area-id="shoptype"]');
    if (!toggle) return mall.label + ': 쇼핑몰선택이 없는 화면';
    const layer = toggle.parentElement.querySelector('[class*="subFilter_layer_mall"]');
    if (!layer || !layer.classList.contains('open')) {
      toggle.click();
    }
    if (!(await waitFor(() => findMall(mall), 3000))) {
      const tab = document.querySelector('li[data-shp-area-id="shoptab"][data-shp-contents-type="오픈마켓/종합몰"] a');
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

    const save = document.querySelector('a[data-shp-area-id="shoptypesave"]');
    if (!save) return mall.label + ': 저장 버튼이 없음';
    const before = location.href;
    save.click();
    if (!(await waitFor(() => location.href !== before, 5000))) return mall.label + ': 저장했지만 주소 변화 없음';
    await sleep(1500);
    return mall.label + '만 선택함';
  };


  // 판매처 탭 "전체" 옆 숫자. 쿠팡만 선택하기 전에는 전체 수, 뒤에는 쿠팡 수다.
  const readTotal = () => {
    const tabs = Array.from(document.querySelectorAll('li[data-shp-area-id="tab"][data-shp-contents-dtl]'));
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
  close.onclick = () => panel.remove();
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

  const step3 = step(3, '전체 수 · 쿠팡 수');
  const counts = make('div', '', 'display:none;margin-top:6px;padding:6px 8px;border-radius:6px;background:#f0faf4;font-size:12px');
  step3.appendChild(action(make('button', '쿠팡만 선택', PRIMARY), async () => {
    const total = readTotal();
    const result = await selectOnlyMall(COUPANG);
    if (!result.endsWith('만 선택함')) return [result];
    counts.textContent = '';
    counts.appendChild(document.createTextNode('전체 '));
    counts.appendChild(make('b', total || '?'));
    counts.appendChild(document.createTextNode(' · 쿠팡 '));
    counts.appendChild(make('b', readTotal() || '?'));
    counts.style.display = 'block';
    return [result];
  }));
  step3.appendChild(counts);

  panel.appendChild(status);

  // 개발용 버튼은 맨 아래 작게 둔다.
  const footer = make('div', '', 'margin-top:8px;text-align:right');

  // 결과가 이상하면 이 버튼으로 상태를 복사해 개발자에게 보낸다.
  const diag = make('button', '진단 복사', LINK);
  diag.onclick = () => {
    const text = JSON.stringify({
      url: location.href,
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

  footer.appendChild(diag);
  footer.appendChild(dump);
  panel.appendChild(footer);
  document.body.appendChild(panel);
})();
