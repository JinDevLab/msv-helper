// msv-helper: 네이버 가격비교 n total 작업 보조.
// 고친 뒤에는 node scripts/build-oneline.js로 한 줄 버전을 다시 만든다.
(() => {
  const PANEL_ID = 'msv-helper-panel';
  const FRAME_ID = 'msv-helper-frame';

  // 상품타입 드롭다운의 제외 항목. value는 항목 data-shp-contents-dtl의 filter_value_id이자 주소 파라미터 이름이고,
  // show는 반대쪽(보기) 파라미터 이름이다.
  const EXCLUDES = [
    { label: '해외직구', value: 'exagency', show: 'agency' },
    { label: '중고', value: 'exused', show: 'used' },
    { label: '렌탈', value: 'exrental', show: 'rental' },
  ];

  // 지금 페이지 위에 같은 사이트를 iframe으로 띄우고, 패널은 바깥 페이지에 둔다.
  // iframe 안에서 다시 검색해도 패널은 남는다. 네이버는 X-Frame-Options와 CSP가 없어 iframe이 열린다.
  const oldFrame = document.getElementById(FRAME_ID);
  const start = new URL(oldFrame ? oldFrame.contentWindow.location.href : location.href);
  if (oldFrame) oldFrame.remove();
  const oldPanel = document.getElementById(PANEL_ID);
  if (oldPanel) oldPanel.remove();

  const frame = document.createElement('iframe');
  frame.id = FRAME_ID;
  frame.src = start.pathname + start.search + start.hash;
  frame.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;border:0;margin:0;z-index:2147483646;background:#fff';
  document.documentElement.style.overflow = 'hidden';
  document.body.appendChild(frame);
  const win = () => frame.contentWindow;
  const doc = () => frame.contentDocument;

  // iframe 주소를 바깥 주소창에 맞춘다. fo=true는 n total이 아닌 작업에서는 필요 없어서 자동으로 붙이지 않는다.
  const sync = setInterval(() => {
    if (!frame.isConnected) {
      clearInterval(sync);
      return;
    }
    let href;
    try {
      href = win().location.href;
    } catch (err) {
      // 다른 사이트로 나가면 읽을 수 없다.
      return;
    }
    if (href !== 'about:blank' && location.href !== href) history.replaceState(null, '', href);
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

  // 쇼핑몰선택 결과는 주소의 mall=몰 번호로 남는다. 쿠팡은 613264다.
  const COUPANG = { label: '쿠팡', value: '613264' };
  const filterValue = (el) => {
    try {
      const item = JSON.parse(el.getAttribute('data-shp-contents-dtl')).find((i) => i.key === 'filter_value_id');
      return item ? item.value : null;
    } catch (err) {
      return null;
    }
  };

  // 필터를 스크립트로 클릭하면 네이버가 실제 마우스 클릭이 아니라고 보고 검색 요청을 418로 막는다.
  // 그래서 파라미터만 바꾼 주소로 iframe을 새로 연다. 공유받은 링크를 여는 것과 같은 일반 페이지 로드다.
  // changes는 { 이름: 값 }이고, 값이 null이면 그 파라미터를 뺀다.
  const openWith = async (changes) => {
    const loc = win().location;
    const names = Object.keys(changes);
    const pairs = loc.search.replace(/^\?/, '').split('&').filter((p) => p && !names.includes(p.split('=')[0]));
    for (const name of names) {
      if (changes[name] !== null) pairs.push(name + '=' + changes[name]);
    }
    const before = doc();
    loc.href = loc.pathname + '?' + pairs.join('&') + loc.hash;
    return waitFor(() => {
      try {
        return doc() !== before && doc().readyState === 'complete' && !!readTotal();
      } catch (err) {
        return false;
      }
    }, 15000);
  };

  // n total을 시작할 때 fo=true와 제외를 한 번의 페이지 로드로 같이 붙인다.
  // 여러 개를 한 번에 제외해도 드롭다운에 "해외직구제외,중고제외"처럼 같이 적용된다(실제 네이버에서 확인).
  const exclude = async (targets) => {
    const changes = { fo: 'true' };
    for (const target of targets) {
      changes[target.value] = 'true';
      changes[target.show] = null;
    }
    const names = ['fo'].concat(targets.map((t) => t.label)).join('·');
    if (!(await openWith(changes))) return names + ': 새 페이지에서 전체 수를 못 읽음';
    return names + ' 제외함 → ' + (toggleText() || '?');
  };

  const selectOnlyMall = async (mall) => {
    if (!(await openWith({ mall: mall.value }))) return mall.label + ': 새 페이지에서 전체 수를 못 읽음';
    return mall.label + '만 선택함';
  };

  // 판매처 탭 "전체" 옆 숫자. 쿠팡만 선택하기 전에는 전체 수, 뒤에는 쿠팡 수다.
  const readTotal = () => {
    const tabs = Array.from(doc().querySelectorAll('li[data-shp-area-id="tab"][data-shp-contents-dtl]'));
    const total = tabs.find((li) => filterValue(li) === 'total');
    const num = total && total.querySelector('[class*="subFilter_num"]');
    return num ? num.textContent.trim() : null;
  };

  // 패널은 상태를 칩으로 보여주고, 작업자가 누르는 버튼은 모두 제외·쿠팡 선택·시트 복사만 크게 둔다.
  const make = (tag, text, style) => {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (style) node.style.cssText = style;
    return node;
  };
  const GREEN = '#03c75a';
  const MUTED = '#b5b9be';
  const TEXT_BTN = 'border:0;background:none;padding:0 2px;font:16px/1 sans-serif;color:#999;cursor:pointer';
  const BTN = 'flex:1;padding:6px 0;border:1px solid #dfe3e8;border-radius:6px;background:#fff;color:#333;font:12px sans-serif;cursor:pointer';
  const LINK = 'border:0;background:none;padding:0;margin-left:8px;color:#aaa;font:11px sans-serif;cursor:pointer';

  const panel = make('div', '', [
    'position:fixed', 'top:12px', 'right:12px', 'z-index:2147483647', 'width:230px', 'box-sizing:border-box',
    'padding:10px 12px', 'background:#fff', 'color:#222', 'border:1px solid #dfe3e8', 'border-radius:10px',
    'box-shadow:0 4px 14px rgba(0,0,0,.12)', 'font:12px/1.4 sans-serif', 'text-align:left',
  ].join(';'));
  panel.id = PANEL_ID;

  const header = make('div', '', 'display:flex;align-items:center');
  header.appendChild(make('strong', 'N Total Helper', 'flex:1;font-size:13px'));
  const body = make('div');
  const fold = make('button', '−', TEXT_BTN);
  fold.title = '접기';
  fold.onclick = () => {
    const open = body.style.display !== 'none';
    body.style.display = open ? 'none' : '';
    fold.textContent = open ? '+' : '−';
    fold.title = open ? '펼치기' : '접기';
  };
  header.appendChild(fold);
  // iframe을 걷어내고 보던 주소를 일반 페이지로 다시 연다.
  const close = make('button', '×', TEXT_BTN + ';margin-left:4px');
  close.title = '닫기';
  header.appendChild(close);
  panel.appendChild(header);
  panel.appendChild(body);

  const status = make('div', '', 'margin-top:6px;font-size:11px;color:#888;white-space:pre-line');

  // 작업 중에는 모든 버튼을 막아 같은 동작이 겹치지 않게 한다.
  let busy = false;
  const run = async (task) => {
    if (busy) return;
    busy = true;
    status.textContent = '처리 중...';
    render();
    try {
      status.textContent = (await task()).join('\n');
    } catch (err) {
      status.textContent = '오류: ' + err.message;
    }
    busy = false;
    render();
  };

  // 칸반(스프레드시트)에 붙일 값: 검색어, URL, 전체 수, 쿠팡 수.
  // URL과 전체 수는 쿠팡을 고르기 직전 값이다. 숫자는 쉼표를 빼서 숫자 칸으로 들어가게 한다.
  // 주소의 query는 필터를 바꾸면 "-단어"가 빠지고(xq로 따로 감), 검색창에는 입력한 그대로 남는다.
  // 그래서 복사할 검색어는 검색창에서 읽고, 검색어가 바뀌었는지는 주소로 본다.
  // 나뉜 주소에서는 origQuery에 입력 그대로가 있으므로 그쪽을 먼저 본다.
  const urlQuery = () => {
    const pairs = win().location.search.replace(/^\?/, '').split('&');
    const read = (name) => {
      const pair = pairs.find((p) => p.split('=')[0] === name);
      return pair ? decodeURIComponent(pair.slice(name.length + 1).replace(/\+/g, ' ')) : '';
    };
    return read('origQuery') || read('query');
  };
  const searchQuery = () => {
    const input = doc().querySelector('input[data-shp-area-id="input"]');
    return (input && input.value.trim()) || urlQuery();
  };
  const toNumber = (text) => (text || '').replace(/[^0-9]/g, '');
  const copyText = async (text, what) => {
    try {
      await navigator.clipboard.writeText(text);
      status.textContent = what + ' 복사함';
      return true;
    } catch (err) {
      status.textContent = what + ' 자동 복사가 막혔어. 시트 복사를 다시 눌러.';
      return false;
    }
  };
  // 쿠팡을 고르기 직전 상태. 검색어가 바뀌면 지운다.
  let saved = null;
  const sheetRow = () => {
    const before = saved || { query: searchQuery(), url: win().location.href, total: readTotal() };
    return [before.query, before.url, toNumber(before.total), saved ? toNumber(readTotal()) : ''].join('\t');
  };

  // 상태 칩: 적용됨은 초록, 아직이면 회색 테두리, 이 검색어에 없으면 흐리게 줄을 긋는다.
  const paramOn = (name) => win().location.search.replace(/^\?/, '').split('&').includes(name + '=true');
  const excludeState = (target) => {
    if (paramOn(target.value)) return 'done';
    return findOption(target.value) ? 'ready' : 'none';
  };
  const CHIP = 'padding:2px 7px;border-radius:10px;font-size:11px;';
  const CHIP_STYLES = {
    done: 'background:' + GREEN + ';color:#fff;border:1px solid ' + GREEN,
    ready: 'background:#fff;color:#555;border:1px solid #cfd3d8',
    none: 'background:#fff;color:' + MUTED + ';border:1px solid #eceef1;text-decoration:line-through',
  };
  const chips = make('div', '', 'display:flex;flex-wrap:wrap;gap:4px;margin-top:8px');
  body.appendChild(chips);
  const chipList = [];
  const addChip = (label, getState) => {
    const chip = make('span', label, CHIP);
    chips.appendChild(chip);
    chipList.push({ chip, getState });
  };
  addChip('fo', () => (paramOn('fo') ? 'done' : 'ready'));
  for (const target of EXCLUDES) addChip(target.label.slice(0, 2), () => excludeState(target));
  addChip('쿠팡', () => (saved ? 'done' : 'ready'));

  const actions = make('div', '', 'display:flex;gap:6px;margin-top:8px');
  body.appendChild(actions);
  // fo=true와, 셋 중 이 검색어에 있고 아직 적용 안 된 제외를 한 번에 붙인다.
  const excludeBtn = make('button', 'fo + 모두 제외', BTN);
  excludeBtn.onclick = () => run(async () => [await exclude(EXCLUDES.filter((target) => excludeState(target) === 'ready'))]);
  const coupangBtn = make('button', '쿠팡 선택', BTN);
  coupangBtn.onclick = () => run(async () => {
    const before = { query: searchQuery(), url: win().location.href, total: readTotal() };
    const result = await selectOnlyMall(COUPANG);
    if (!result.endsWith('만 선택함')) return [result];
    saved = before;
    render();
    // 쿠팡을 고르면 작업이 끝난 것이므로 스프레드시트용 한 줄을 바로 복사한다.
    await copyText(sheetRow(), '시트 한 줄');
    return [result, status.textContent];
  });
  actions.appendChild(excludeBtn);
  actions.appendChild(coupangBtn);

  // 전체 수(쿠팡 선택 전)와 쿠팡 수(선택 후). 숫자를 누르면 그 숫자만 복사한다.
  const totalNow = () => (saved ? saved.total : readTotal());
  const coupangNow = () => (saved ? readTotal() : null);
  const counts = make('div', '', 'display:flex;gap:6px;margin-top:8px');
  body.appendChild(counts);
  const countBox = (label, getValue) => {
    const box = make('button', '', 'flex:1;padding:4px 0;border:0;border-radius:6px;background:#f5f6f8;color:#222;font:12px sans-serif;cursor:pointer');
    box.title = '눌러서 복사';
    box.appendChild(make('div', label, 'font-size:10px;color:#888'));
    const num = make('div', '', 'font-weight:bold;font-size:13px');
    box.appendChild(num);
    box.onclick = () => copyText(toNumber(getValue()), label);
    counts.appendChild(box);
    return num;
  };
  const totalLabel = countBox('전체 수', totalNow);
  const coupangLabel = countBox('쿠팡 수', coupangNow);

  const sheetBtn = make('button', '시트 한 줄 복사', 'display:block;box-sizing:border-box;width:100%;margin-top:8px;padding:7px 0;border:0;border-radius:6px;'
    + 'background:' + GREEN + ';color:#fff;font:bold 12px sans-serif;cursor:pointer');
  sheetBtn.onclick = () => copyText(sheetRow(), '시트 한 줄');
  body.appendChild(sheetBtn);
  body.appendChild(status);

  // 따로 복사와 개발용 버튼은 맨 아래 작게 둔다.
  const footer = make('div', '', 'margin-top:6px;text-align:right');
  const titleBtn = make('button', '검색어', LINK);
  titleBtn.onclick = () => copyText(saved ? saved.query : searchQuery(), '검색어');
  const urlBtn = make('button', 'URL', LINK);
  urlBtn.onclick = () => copyText(saved ? saved.url : win().location.href, 'URL');

  // 결과가 이상하면 이 버튼으로 상태를 복사해 개발자에게 보낸다.
  const diag = make('button', '진단', LINK);
  diag.onclick = () => {
    const text = JSON.stringify({
      url: win().location.href,
      toggle: toggleText(),
      options: EXCLUDES.map((t) => t.value + ':' + !!findOption(t.value)),
      total: readTotal(),
      saved,
      status: status.textContent,
    }, null, 1);
    navigator.clipboard.writeText(text).then(() => { diag.textContent = '복사함'; }, () => { prompt('복사해서 보내줘', text); });
  };

  // 개발용: 쇼핑몰선택을 열기 전과 연 뒤의 전체 HTML을 msv-dom-shoptype.html로 내려받는다.
  const dump = make('button', '덤프', LINK);
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
  for (const btn of [titleBtn, urlBtn, diag, dump]) footer.appendChild(btn);
  body.appendChild(footer);

  // 상태와 버튼을 지금 페이지에 맞춘다. iframe 안에서 페이지가 바뀌므로 주기적으로 부른다.
  let lastQuery = null;
  const setEnabled = (btn, on) => {
    btn.disabled = !on || busy;
    btn.style.color = btn.disabled ? MUTED : '#333';
    btn.style.cursor = btn.disabled ? 'default' : 'pointer';
  };
  function render() {
    let loaded = true;
    try {
      loaded = win().location.href !== 'about:blank';
    } catch (err) {
      loaded = false;
    }
    if (!loaded) return;

    const query = urlQuery();
    if (lastQuery !== null && query !== lastQuery) saved = null;
    lastQuery = query;

    for (const { chip, getState } of chipList) chip.style.cssText = CHIP + CHIP_STYLES[getState()];
    setEnabled(excludeBtn, !paramOn('fo') || EXCLUDES.some((target) => excludeState(target) === 'ready'));
    setEnabled(coupangBtn, !saved && !!readTotal());

    totalLabel.textContent = totalNow() || '-';
    coupangLabel.textContent = coupangNow() || '-';
  }

  const ticker = setInterval(() => {
    if (!panel.isConnected) {
      clearInterval(ticker);
      return;
    }
    render();
  }, 700);

  close.onclick = () => {
    clearInterval(sync);
    clearInterval(ticker);
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

  document.body.appendChild(panel);
  render();
})();
