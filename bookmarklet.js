// msv-helper: 네이버 가격비교 n total 작업 보조. 고친 뒤에는 node scripts/build-oneline.js로 한 줄 버전을 다시 만든다.
(() => {
  const PANEL_ID = 'msv-helper-panel';

  // fo=true가 없으면 붙여서 다시 열고 끝낸다. 다시 열린 페이지에서 북마클릿을 한 번 더 누른다.
  const search = location.search;
  if (!/[?&]fo=true(&|$)/.test(search)) {
    const next = /[?&]fo=/.test(search)
      ? search.replace(/([?&])fo=[^&]*/, '$1fo=true')
      : (search ? search + '&fo=true' : '?fo=true');
    location.href = location.pathname + next + location.hash;
    return;
  }

  const old = document.getElementById(PANEL_ID);
  if (old) {
    old.remove();
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const waitFor = async (find, timeout) => {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      const found = find();
      if (found) {
        return found;
      }
      await sleep(100);
    }
    return null;
  };

  // 화면에 보이는 글자가 정확히 같은 요소 중 가장 안쪽 것을 찾는다. 패널 안은 뺀다.
  const findByText = (match) => {
    const nodes = document.querySelectorAll('a, button, li, span, div');
    let best = null;
    for (const el of nodes) {
      if (el.closest('#' + PANEL_ID)) {
        continue;
      }
      if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') {
        continue;
      }
      const text = el.textContent.replace(/\s+/g, '');
      if (match(text) && (!best || best.contains(el))) {
        best = el;
      }
    }
    return best;
  };

  const clickLike = (el) => {
    const target = el.closest('a, button, [role="option"], [role="button"], li') || el;
    target.click();
  };

  const findToggle = () => findByText((t) => t.startsWith('상품타입('));

  // 실패했을 때 고칠 수 있도록 필터 근처 HTML을 모아 둔다.
  let diagnostic = '';
  const collectDiagnostic = (reason, el) => {
    let box = el;
    for (let i = 0; box && box.parentElement && i < 4; i++) {
      box = box.parentElement;
    }
    const texts = [];
    for (const node of document.querySelectorAll('a, button, li')) {
      const t = node.textContent.trim();
      if (t.length < 20 && /(상품타입|제외|보기)/.test(t) && !node.closest('#' + PANEL_ID)) {
        texts.push(node.tagName + ' ' + (node.className || '') + ' | ' + t);
      }
    }
    diagnostic = [
      'reason: ' + reason,
      'url: ' + location.href,
      'candidates:',
      texts.slice(0, 60).join('\n'),
      'html:',
      box ? box.outerHTML.slice(0, 20000) : '(없음)'
    ].join('\n');
  };

  // 상품타입 드롭다운에서 label 항목을 누른다. 결과 문구를 돌려준다.
  const exclude = async (label) => {
    let option = findByText((t) => t === label);
    if (!option) {
      const toggle = findToggle();
      if (!toggle) {
        collectDiagnostic(label + ' 드롭다운 없음', document.querySelector('#__next') || document.body);
        return label + ': 상품타입 필터를 못 찾음';
      }
      clickLike(toggle);
      option = await waitFor(() => findByText((t) => t === label), 2000);
      if (!option) {
        collectDiagnostic(label + ' 항목 없음', toggle);
        return label + ': 항목 없음';
      }
    }
    clickLike(option);
    await sleep(1500);
    return label + ': 적용';
  };

  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.style.cssText = [
    'position:fixed', 'top:12px', 'right:12px', 'z-index:2147483647',
    'width:200px', 'padding:10px', 'background:#fff', 'color:#222',
    'border:1px solid #03c75a', 'border-radius:8px',
    'box-shadow:0 4px 12px rgba(0,0,0,.2)', 'font:13px/1.4 sans-serif'
  ].join(';');

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-weight:bold';
  header.textContent = 'MSV helper';
  const close = document.createElement('button');
  close.textContent = '×';
  close.title = '닫기';
  close.style.cssText = 'border:0;background:none;font-size:16px;cursor:pointer;color:#666';
  close.onclick = () => panel.remove();
  header.appendChild(close);
  panel.appendChild(header);

  const status = document.createElement('div');
  status.style.cssText = 'margin-top:8px;color:#666;font-size:12px;white-space:pre-line';

  const buttons = [];
  const addButton = (text, run) => {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = 'display:block;box-sizing:border-box;width:100%;margin-top:4px;padding:6px;border:1px solid #ccc;border-radius:4px;background:#f7f7f7;cursor:pointer;font:inherit';
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

  const LABELS = ['해외직구제외', '중고제외', '렌탈제외'];
  addButton('해외·중고·렌탈 모두 제외', async () => {
    const results = [];
    for (const label of LABELS) {
      results.push(await exclude(label));
    }
    return results;
  });
  LABELS.forEach((label) => {
    addButton(label, async () => [await exclude(label)]);
  });

  panel.appendChild(status);

  // 결과가 이상하면 이 버튼으로 진단 정보를 복사해 개발자에게 보낸다.
  const copyDiag = document.createElement('button');
  copyDiag.textContent = '진단 복사';
  copyDiag.style.cssText = 'margin-top:8px;padding:2px 6px;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;font-size:11px;color:#666';
  copyDiag.onclick = async () => {
    if (!diagnostic) {
      collectDiagnostic('수동 복사', findToggle() || document.querySelector('#__next') || document.body);
    }
    try {
      await navigator.clipboard.writeText(diagnostic);
    } catch (err) {
      const area = document.createElement('textarea');
      area.value = diagnostic;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    status.textContent = '진단 정보를 복사했어.';
    diagnostic = '';
  };
  panel.appendChild(copyDiag);

  document.body.appendChild(panel);
})();
