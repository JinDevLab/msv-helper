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

  // fo=true는 화면에 누를 곳이 없는 주소 옵션이라, 파라미터만 바꾼 주소로 iframe을 새로 연다.
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

  // 필터는 화면에서 누른다. 페이지를 새로 여는 주소 방식은 캡차가 자주 떴다.
  // click 하나만 보내면 네이버 검색 API가 418로 막아서, 예전 확장 프로그램처럼 마우스 이벤트를 차례로 보낸다.
  const press = (el) => {
    const init = { bubbles: true, cancelable: true, view: win() };
    for (const type of ['mouseenter', 'mouseover', 'mousedown', 'mouseup', 'click']) {
      el.dispatchEvent(new (win().MouseEvent)(type, init));
    }
  };

  // 드롭다운을 열고 항목을 누른 뒤, 주소나 토글 글자가 바뀔 때까지 기다린다.
  // 끌 때도 같은 항목을 다시 누른다. 클릭 뒤 DOM이 새로 그려지므로 항목은 매번 다시 찾는다.
  const clickOption = async (target) => {
    const option = findOption(target.value);
    if (!option) return target.label + ': 이 검색어에는 없음';
    const before = win().location.href + '|' + toggleText();
    const toggle = findToggle();
    if (toggle) {
      press(toggle);
      await sleep(100);
    }
    const totalBefore = readTotal();
    press(option);
    if (!(await waitFor(() => win().location.href + '|' + toggleText() !== before, 5000))) return target.label + ': 눌렀지만 변화 없음';
    // 고정으로 쉬지 않고 "전체" 숫자가 바뀔 때까지 기다린다. 제외할 상품이 없으면 숫자가 그대로라 3초에서 멈춘다.
    await waitFor(() => readTotal() !== totalBefore, 3000);
    return target.label + (paramOn(target.value) ? ' 제외함' : ' 제외 끔');
  };

  // fo=true가 없으면 먼저 주소로 붙이고, 이 검색어에 있고 아직 적용 안 된 제외를 차례로 누른다.
  const foAndExclude = async () => {
    const lines = [];
    if (!paramOn('fo')) {
      if (!(await openWith({ fo: 'true' }))) return ['fo: 새 페이지에서 전체 수를 못 읽음'];
      lines.push('fo 켬');
    }
    for (const target of EXCLUDES) {
      if (excludeState(target) === 'ready') lines.push(await clickOption(target));
    }
    return lines;
  };

  // 쇼핑몰선택 레이어. 열 때 목록을 불러오고, 열리면 레이어에 open 클래스가 붙는다.
  // 목록 항목은 li[data-shp-area-id="shop"]이고 data-shp-contents-dtl의 filter_value_id가 몰 번호다.
  const mallItems = () => Array.from(doc().querySelectorAll('li[data-shp-area-id="shop"][data-shp-contents-dtl]'));
  const findMall = (mall) => mallItems().find((li) => filterValue(li) === mall.value || li.getAttribute('data-shp-contents-id') === mall.label);
  const isChecked = (li) => {
    const input = li && li.querySelector('input[type="checkbox"]');
    return !!(input && input.checked);
  };

  // on이면 그 몰만 체크하고, 아니면 모든 체크를 풀고 저장한다.
  const setMall = async (mall, on) => {
    const toggle = doc().querySelector('a[data-shp-area-id="shoptype"]');
    if (!toggle) return mall.label + ': 쇼핑몰선택이 없는 화면';
    const layer = toggle.parentElement.querySelector('[class*="subFilter_layer_mall"]');
    if (!layer || !layer.classList.contains('open')) press(toggle);
    if (!(await waitFor(() => findMall(mall), 3000))) {
      const tab = doc().querySelector('li[data-shp-area-id="shoptab"][data-shp-contents-type="오픈마켓/종합몰"] a');
      if (tab) {
        press(tab);
        await waitFor(() => findMall(mall), 3000);
      }
    }
    // 목록은 바로 보이지만 몰 목록 응답이 오기 전에 누르면 저장이 반영되지 않을 수 있어 조금 기다린다.
    await sleep(100);
    const target = findMall(mall);
    if (!target) return mall.label + ': 쇼핑몰 목록에 없음';
    for (const li of mallItems()) {
      if (isChecked(li) !== (on && li === target)) {
        press(li.querySelector('label') || li);
        await sleep(100);
      }
    }
    await sleep(100);
    const save = doc().querySelector('a[data-shp-area-id="shoptypesave"]');
    if (!save) return mall.label + ': 저장 버튼이 없음';
    const before = win().location.href;
    const totalBefore = readTotal();
    press(save);
    if (!(await waitFor(() => win().location.href !== before, 5000))) return mall.label + ': 저장했지만 주소 변화 없음';
    // 쿠팡 수를 바로 읽으므로 "전체" 숫자가 바뀔 때까지 기다린다.
    await waitFor(() => readTotal() !== totalBefore, 5000);
    return mall.label + (on ? '만 선택함' : ' 선택 끔');
  };
  const selectOnlyMall = (mall) => setMall(mall, true);

  // 판매처 탭 "전체" 옆 숫자. 쿠팡만 선택하기 전에는 전체 수, 뒤에는 쿠팡 수다.
  const readTotal = () => {
    const tabs = Array.from(doc().querySelectorAll('li[data-shp-area-id="tab"][data-shp-contents-dtl]'));
    const total = tabs.find((li) => filterValue(li) === 'total');
    const num = total && total.querySelector('[class*="subFilter_num"]');
    return num ? num.textContent.trim() : null;
  };

  // 패널 모양은 <style> 하나에 모은다. 칸반에 붙일 한 줄을 시트 행처럼 보여주고, 복사한 칸에는 시트처럼 점선을 두른다.
  // 초록은 적용된 필터, 파랑은 복사다. 선택자를 패널 id 아래로 묶어 네이버 스타일과 섞이지 않게 한다.
  const make = (tag, text, cls) => {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (cls) node.className = cls;
    return node;
  };
  const CSS = [
    '{position:fixed;top:12px;right:12px;z-index:2147483647;width:272px;background:#fff;color:#2b2f33;border:1px solid #c9ced4;border-radius:4px;'
      + 'box-shadow:0 6px 20px rgba(43,47,51,.18);font:12px/1.4 Pretendard,"Malgun Gothic","Apple SD Gothic Neo",sans-serif;text-align:left}',
    ' *{box-sizing:border-box;margin:0;font:inherit;color:inherit;letter-spacing:0}',
    ' button{padding:0;border:0;background:none;cursor:pointer}',
    ' button:disabled{cursor:default;opacity:.4}',
    ' button:focus-visible{outline:2px solid #1f6feb;outline-offset:-2px}',
    ' .hd{display:flex;align-items:center;gap:2px;padding:8px 6px 8px 10px}',
    ' .chips{display:flex;flex:1;flex-wrap:wrap;gap:4px}',
    ' .chip{padding:2px 8px;border:1px solid #c9ced4;border-radius:10px;font-size:11px;color:#5f6368}',
    ' .chip[data-s=done]{border-color:#03c75a;background:#03c75a;color:#fff;font-weight:600}',
    ' .chip[data-s=none]{border-style:dashed;text-decoration:line-through}',
    ' .x{padding:0 3px;font-size:16px;line-height:1;color:#9aa0a6}',
    ' .bd{padding:0 10px 8px;border-top:1px solid #e3e6e9}',
    ' .grid{display:grid;grid-template-columns:1.3fr 1fr .9fr .9fr;margin-top:10px;border-top:1px solid #d7dbe0;border-left:1px solid #d7dbe0}',
    ' .grid>*{overflow:hidden;padding:3px 6px;border-right:1px solid #d7dbe0;border-bottom:1px solid #d7dbe0;white-space:nowrap;text-overflow:ellipsis}',
    ' .grid>div{background:#f1f3f5;color:#5f6368;font-size:10px;text-align:center}',
    ' .grid>button{text-align:left;border-radius:0}',
    ' .grid>.n{text-align:right;font-size:14px;font-weight:700;font-variant-numeric:tabular-nums}',
    ' .grid>.cp{outline:2px dashed #1f6feb;outline-offset:-2px;background:#eef4ff}',
    ' .act{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}',
    ' .btn{padding:7px 0;border:1px solid #c9ced4;border-radius:4px;font-weight:600}',
    ' .btn:hover:enabled{background:#f1f3f5}',
    ' .main{grid-column:1/-1;border-color:#1f6feb;background:#1f6feb;color:#fff}',
    ' .main:hover:enabled{background:#1a5fd0}',
    ' .st{margin-top:6px;font-size:11px;color:#5f6368;white-space:pre-line}',
    ' .ft{display:flex;justify-content:flex-end;gap:8px;margin-top:4px}',
    ' .ft button{font-size:11px;color:#9aa0a6}',
  ].map((rule) => '#' + PANEL_ID + rule).join('');

  const panel = make('div');
  panel.id = PANEL_ID;
  panel.appendChild(make('style', CSS));

  // 머리에는 상태 칩만 둔다. 접어도 칩은 보인다.
  const header = make('div', '', 'hd');
  const chips = make('div', '', 'chips');
  header.appendChild(chips);
  const body = make('div', '', 'bd');
  const fold = make('button', '−', 'x');
  fold.title = '접기';
  fold.onclick = () => {
    const open = body.style.display !== 'none';
    body.style.display = open ? 'none' : '';
    fold.textContent = open ? '+' : '−';
    fold.title = open ? '펼치기' : '접기';
  };
  header.appendChild(fold);
  // iframe을 걷어내고 보던 주소를 일반 페이지로 다시 연다.
  const close = make('button', '×', 'x');
  close.title = '닫기';
  header.appendChild(close);
  panel.appendChild(header);
  panel.appendChild(body);

  const status = make('div', '', 'st');

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
  // 그래서 복사할 검색어는 검색창에서 읽고, 검색창이 없을 때만 주소를 본다.
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

  // 복사한 칸에는 시트처럼 점선을 두르고 잠시 뒤 지운다.
  const cells = [];
  let unmark = null;
  const copyText = async (text, what, marked) => {
    if (!text) {
      status.textContent = what + ': 아직 값이 없음';
      return false;
    }
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      status.textContent = what + ' 자동 복사가 막혔어. 다시 눌러.';
      return false;
    }
    status.textContent = what + ' 복사함';
    for (const cell of cells) cell.classList.toggle('cp', marked.includes(cell));
    clearTimeout(unmark);
    unmark = setTimeout(() => cells.forEach((cell) => cell.classList.remove('cp')), 1500);
    return true;
  };
  // 쿠팡을 고르기 직전 상태. after는 쿠팡을 고른 뒤 주소이고, 주소가 이것과 달라지면(재검색 등) 지운다.
  let saved = null;
  const queryNow = () => (saved ? saved.query : searchQuery());
  const urlNow = () => (saved ? saved.url : win().location.href);
  const totalNow = () => (saved ? saved.total : readTotal());
  const coupangNow = () => (saved ? readTotal() : null);
  const sheetRow = () => [queryNow(), urlNow(), toNumber(totalNow()), toNumber(coupangNow())].join('\t');
  const copyRow = () => copyText(sheetRow(), '시트 한 줄', cells);

  // 상태 칩: 적용됨은 초록, 아직이면 회색 테두리, 이 검색어에 없으면 점선에 줄을 긋는다.
  const paramOn = (name) => win().location.search.replace(/^\?/, '').split('&').includes(name + '=true');
  const excludeState = (target) => {
    if (paramOn(target.value)) return 'done';
    return findOption(target.value) ? 'ready' : 'none';
  };

  // 쿠팡만 선택하고, 끝나면 작업이 끝난 것이므로 스프레드시트용 한 줄을 바로 복사한다.
  const pickCoupang = async () => {
    const before = { query: searchQuery(), url: win().location.href, total: readTotal() };
    const result = await selectOnlyMall(COUPANG);
    if (!result.endsWith('만 선택함')) return [result];
    saved = Object.assign(before, { after: win().location.href });
    render();
    await copyRow();
    return [result, status.textContent];
  };
  const coupangOn = () => !!saved || win().location.search.replace(/^\?/, '').split('&').includes('mall=' + COUPANG.value);

  // 칩을 누르면 그 필터를 켜거나 끈다. 이 검색어에 없는 항목은 누를 수 없다.
  const chipList = [];
  const addChip = (label, getState, turnOn, turnOff) => {
    const chip = make('button', label, 'chip');
    chip.onclick = () => run(getState() === 'done' ? turnOff : turnOn);
    chips.appendChild(chip);
    chipList.push({ chip, getState });
  };
  const apply = async (done, changes) => [(await openWith(changes)) ? done : done + ': 새 페이지에서 전체 수를 못 읽음'];
  addChip('fo', () => (paramOn('fo') ? 'done' : 'ready'),
    () => apply('fo 켬', { fo: 'true' }),
    () => apply('fo 끔', { fo: null }));
  for (const target of EXCLUDES) {
    const toggleOption = async () => [await clickOption(target)];
    addChip(target.label.slice(0, 2), () => excludeState(target), toggleOption, toggleOption);
  }
  addChip('쿠팡', () => (coupangOn() ? 'done' : 'ready'), pickCoupang, async () => {
    saved = null;
    return [await setMall(COUPANG, false)];
  });

  // 칸반에 붙는 순서대로 칸을 둔다. 칸을 누르면 그 값만 복사한다.
  // 전체 수는 쿠팡 선택 전, 쿠팡 수는 선택 후 숫자다.
  const grid = make('div', '', 'grid');
  body.appendChild(grid);
  for (const label of ['검색어', 'URL', '전체', '쿠팡']) grid.appendChild(make('div', label));
  const addCell = (cls, what, getValue) => {
    const cell = make('button', '', cls);
    cell.title = what + ' 복사';
    cell.onclick = () => copyText(getValue() || '', what, [cell]);
    grid.appendChild(cell);
    cells.push(cell);
    return cell;
  };
  const queryCell = addCell('', '검색어', queryNow);
  const urlCell = addCell('', 'URL', urlNow);
  const totalCell = addCell('n', '전체 수', () => toNumber(totalNow()));
  const coupangCell = addCell('n', '쿠팡 수', () => toNumber(coupangNow()));
  // URL 칸에는 앞부분이 늘 같아서 ? 뒤 검색 조건만 읽을 수 있게 풀어 보인다.
  const readable = (url) => {
    try {
      return decodeURIComponent(url.replace(/^[^?]*\?/, ''));
    } catch (err) {
      return url;
    }
  };

  const actions = make('div', '', 'act');
  body.appendChild(actions);
  const excludeBtn = make('button', '모두 제외', 'btn');
  excludeBtn.title = 'fo=true를 붙이고 해외직구, 중고, 렌탈을 제외';
  excludeBtn.onclick = () => run(foAndExclude);
  const coupangBtn = make('button', '쿠팡 선택', 'btn');
  coupangBtn.title = '쿠팡만 선택하고 시트 한 줄을 복사';
  coupangBtn.onclick = () => run(pickCoupang);
  const sheetBtn = make('button', '시트 한 줄 복사', 'btn main');
  sheetBtn.onclick = copyRow;
  for (const btn of [excludeBtn, coupangBtn, sheetBtn]) actions.appendChild(btn);
  body.appendChild(status);

  // 개발용 버튼은 맨 아래 작게 둔다.
  const footer = make('div', '', 'ft');

  // 결과가 이상하면 이 버튼으로 상태를 복사해 개발자에게 보낸다.
  const diag = make('button', '진단');
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
  const dump = make('button', '덤프');
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
  body.appendChild(footer);

  // 상태와 버튼을 지금 페이지에 맞춘다. iframe 안에서 페이지가 바뀌므로 주기적으로 부른다.
  function render() {
    let loaded = true;
    try {
      loaded = win().location.href !== 'about:blank';
    } catch (err) {
      loaded = false;
    }
    if (!loaded) return;

    // 같은 검색어로 다시 검색해도 네이버는 쿠팡 선택을 풀고 주소를 바꾼다.
    if (saved && win().location.href !== saved.after) saved = null;

    for (const { chip, getState } of chipList) {
      const state = getState();
      chip.dataset.s = state;
      chip.disabled = state === 'none' || busy;
    }
    excludeBtn.disabled = busy || (paramOn('fo') && !EXCLUDES.some((target) => excludeState(target) === 'ready'));
    coupangBtn.disabled = busy || coupangOn() || !readTotal();

    queryCell.textContent = queryNow() || '-';
    urlCell.textContent = readable(urlNow());
    totalCell.textContent = totalNow() || '-';
    coupangCell.textContent = coupangNow() || '-';
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
