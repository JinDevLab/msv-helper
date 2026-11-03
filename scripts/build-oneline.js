// bookmarklet.js를 북마크 URL에 붙일 한 줄짜리 bookmarklet-oneline.js로 만든다.
// 줄바꿈은 %0A로 남겨서 // 주석과 자동 세미콜론이 원본과 똑같이 동작하게 한다.
// 줄 앞뒤 공백과 주석만 있는 줄은 지우므로, 여러 줄 템플릿 문자열 안에서는 내용이 바뀔 수 있다.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'bookmarklet.js'), 'utf8');

// 브라우저는 javascript: URL을 실행하기 전에 퍼센트 인코딩을 푼다.
// 그래서 %와 줄바꿈, URL 조각으로 잘릴 수 있는 #만 인코딩한다.
const code = src
  .replace(/\r/g, '')
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line !== '' && !line.startsWith('//'))
  .join('\n');
const encoded = code
  .replace(/%/g, '%25')
  .replace(/#/g, '%23')
  .replace(/\n/g, '%0A');
const oneline = 'javascript:' + encoded;

// 브라우저가 푸는 것과 같은 방식으로 풀어서 문법이 맞는지 확인한다.
new Function(decodeURIComponent(encoded));

fs.writeFileSync(path.join(root, 'bookmarklet-oneline.js'), oneline + '\n');
console.log('bookmarklet-oneline.js: ' + oneline.length + '자');
