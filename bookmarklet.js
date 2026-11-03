// msv-helper: 네이버 가격비교 n total 작업 보조.
// 고친 뒤에는 node scripts/build-oneline.js로 한 줄 버전을 다시 만든다.
(() => {
  const PANEL_ID = 'msv-helper-panel';

  // 상품타입 제외 항목. 드롭다운 항목을 누르면 param=true가 붙고 opposite(보기)가 빠진다.
  const EXCLUDES = [
    { label: '해외직구', param: 'exagency', opposite: 'agency' },
    { label: '중고', param: 'exused', opposite: 'used' },
    { label: '렌탈', param: 'exrental', opposite: 'rental' },
  ];

  // 검색어 인코딩을 그대로 두려고 URLSearchParams 대신 문자열로 다룬다.
  const splitParams = (search) => search.replace(/^\?/, '').split('&').filter(Boolean);
  const nameOf = (pair) => pair.split('=')[0];
  const getParam = (search, name) => {
    const pair = splitParams(search).find((p) => nameOf(p) === name);
    return pair === undefined ? null : pair.slice(name.length + 1);
  };
  const withParams = (search, set, remove) => {
    const drop = Object.keys(set).concat(remove);
    const pairs = splitParams(search).filter((p) => !drop.includes(nameOf(p)));
    Object.keys(set).forEach((name) => pairs.push(name + '=' + set[name]));
    return '?' + pairs.join('&');
  };

  // fo=true가 없으면 붙여서 다시 열고 끝낸다. 다시 열린 페이지에서 북마클릿을 한 번 더 누른다.
  if (getParam(location.search, 'fo') !== 'true') {
    location.href = location.pathname + withParams(location.search, { fo: 'true' }, []) + location.hash;
    return;
  }

  const old = document.getElementById(PANEL_ID);
  if (old) old.remove();

  // 상품타입 드롭다운 항목에서 이 검색어에 있는 필터 값을 읽는다. 닫혀 있어도 DOM에 있다.
  const availableValues = () => {
    const values = new Set();
    const links = document.querySelectorAll('a[data-shp-area-id="pdtype"][data-shp-contents-dtl]');
    for (const link of links) {
      try {
        for (const item of JSON.parse(link.getAttribute('data-shp-contents-dtl'))) {
          if (item.key === 'filter_value_id') values.add(item.value);
        }
      } catch (err) {
        // 형식이 바뀐 항목은 건너뛴다.
      }
    }
    return values;
  };

  const isOn = (param) => getParam(location.search, param) === 'true';

  // 네이버가 쓰는 Next.js 라우터로 이동해 패널을 유지한다. 없으면 페이지를 새로 연다.
  const go = (search) => {
    const url = location.pathname + search + location.hash;
    const router = window.next && window.next.router;
    if (router && typeof router.push === 'function') {
      Promise.resolve(router.push(url)).then(() => setTimeout(render, 300), () => { location.href = url; });
    } else {
      location.href = url;
    }
  };

  const applyExcludes = (targets, on) => {
    const set = {};
    const remove = [];
    for (const t of targets) {
      if (on) {
        set[t.param] = 'true';
        remove.push(t.opposite);
      } else {
        remove.push(t.param);
      }
    }
    go(withParams(location.search, set, remove));
  };

  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.style.cssText = [
    'position:fixed', 'top:12px', 'right:12px', 'z-index:2147483647',
    'width:220px', 'padding:10px', 'background:#fff', 'color:#222',
    'border:1px solid #03c75a', 'border-radius:8px',
    'box-shadow:0 4px 12px rgba(0,0,0,.2)', 'font:13px/1.4 sans-serif',
  ].join(';');

  const body = document.createElement('div');

  const button = (text, onClick, primary) => {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = 'display:block;box-sizing:border-box;width:100%;margin-top:4px;padding:6px;'
      + 'border:1px solid ' + (primary ? '#03c75a' : '#ccc') + ';border-radius:4px;cursor:pointer;font:inherit;'
      + 'background:' + (primary ? '#03c75a;color:#fff' : '#f7f7f7;color:#222');
    btn.onclick = onClick;
    return btn;
  };

  const line = (text, color) => {
    const div = document.createElement('div');
    div.textContent = text;
    div.style.cssText = 'margin-top:2px;font-size:12px;color:' + (color || '#666');
    return div;
  };

  // 현재 URL과 DOM 상태로 패널 내용을 다시 그린다.
  function render() {
    if (!document.getElementById(PANEL_ID)) return;
    body.textContent = '';
    const values = availableValues();
    const shown = EXCLUDES.filter((t) => values.has(t.param) || isOn(t.param));

    if (shown.length === 0) {
      body.appendChild(line('이 검색어에는 해외직구·중고·렌탈 필터가 없어.'));
      return;
    }

    const pending = shown.filter((t) => !isOn(t.param));
    if (pending.length > 1) {
      body.appendChild(button(pending.map((t) => t.label).join('·') + ' 모두 제외', () => applyExcludes(pending, true), true));
    }
    for (const t of shown) {
      if (isOn(t.param)) {
        body.appendChild(line('✓ ' + t.label + ' 제외됨', '#03a04a'));
      }
    }
    for (const t of shown) {
      const text = isOn(t.param) ? t.label + ' 제외 해제' : t.label + '만 제외';
      body.appendChild(button(text, () => applyExcludes([t], !isOn(t.param))));
    }
  }

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;font-weight:bold';
  header.textContent = 'MSV helper';
  const close = document.createElement('button');
  close.textContent = '×';
  close.title = '닫기';
  close.style.cssText = 'border:0;background:none;font-size:16px;cursor:pointer;color:#666';
  close.onclick = () => panel.remove();
  header.appendChild(close);

  // 결과가 이상하면 이 버튼으로 상태를 복사해 개발자에게 보낸다.
  const diag = document.createElement('button');
  diag.textContent = '진단 복사';
  diag.style.cssText = 'margin-top:8px;padding:2px 6px;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;font-size:11px;color:#666';
  diag.onclick = () => {
    const toggle = document.querySelector('a[data-shp-area-id="pdtype"]:not([data-shp-contents-dtl])');
    const text = JSON.stringify({
      url: location.href,
      available: Array.from(availableValues()),
      toggle: toggle ? toggle.textContent : null,
      nextRouter: !!(window.next && window.next.router),
    }, null, 1);
    navigator.clipboard.writeText(text).then(() => { diag.textContent = '복사함'; }, () => { prompt('복사해서 보내줘', text); });
  };

  panel.appendChild(header);
  panel.appendChild(body);
  panel.appendChild(diag);
  document.body.appendChild(panel);
  render();

  // 검색어를 바꾸는 등 페이지 안에서 이동하면 패널을 다시 그린다.
  try {
    window.next.router.events.on('routeChangeComplete', () => setTimeout(render, 300));
  } catch (err) {
    // 라우터가 없으면 버튼을 누를 때만 다시 그린다.
  }
})();
