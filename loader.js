// 북마크에 넣는 로더. 누를 때마다 원격 main의 bookmarklet.js를 받아 실행한다.
// 그래서 bookmarklet.js를 고쳐 main에 올리면 북마크를 다시 붙이지 않아도 된다.
// raw.githubusercontent.com은 5분 캐시가 있고 쿼리를 붙여도 캐시를 타서, 푸시 뒤 반영까지 최대 5분쯤 걸린다.
// 고친 뒤에는 node scripts/build-oneline.js로 bookmarklet-oneline.js를 다시 만든다.
(() => {
  const SRC = 'https://raw.githubusercontent.com/JinDevLab/msv-helper/main/bookmarklet.js';
  fetch(SRC, { cache: 'no-store' })
    .then((res) => {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    })
    .then((code) => new Function(code)())
    .catch((err) => alert('msv-helper를 불러오지 못했어: ' + err.message));
})();
