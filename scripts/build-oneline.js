// bookmarklet.js를 북마크 URL에 붙일 한 줄짜리 bookmarklet-oneline.js로 만든다.
// 줄은 공백으로 잇는다. 그래서 원본에 줄 끝 // 주석이나 세미콜론 없이 끝나는 문장이 있으면 멈춘다.
// 줄 앞뒤 공백과 주석만 있는 줄은 지우므로, 여러 줄 템플릿 문자열 안에서는 내용이 바뀔 수 있다.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'bookmarklet.js'), 'utf8');

const lines = src
  .replace(/\r/g, '')
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line !== '' && !line.startsWith('//'));

// 공백으로 이으면 줄 끝 주석은 뒤 코드를 주석으로 만들고, 자동 세미콜론은 사라진다.
// 아래는 그런 줄을 찾는 단순 검사다. 문자열 안의 'https://'처럼 앞에 공백이 없는 //는 통과시킨다.
const problems = [];
lines.forEach((line, i) => {
  if (/\s\/\//.test(line)) problems.push('줄 끝 주석: ' + line);
  const next = lines[i + 1];
  const open = /[A-Za-z0-9_$)\]'"`]$/.test(line) && !/^(if|for|while)\b.*\)$/.test(line);
  if (next && open && !/^[.)\]}+?:,]/.test(next)) problems.push('세미콜론 없음: ' + line);
});
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}

// 브라우저는 javascript: URL을 실행하기 전에 퍼센트 인코딩을 푼다.
// 그래서 %와 URL 조각으로 잘릴 수 있는 #만 인코딩한다.
const encoded = lines
  .join(' ')
  .replace(/%/g, '%25')
  .replace(/#/g, '%23');
const oneline = 'javascript:' + encoded;

// 브라우저가 푸는 것과 같은 방식으로 풀어서 문법이 맞는지 확인한다.
new Function(decodeURIComponent(encoded));

fs.writeFileSync(path.join(root, 'bookmarklet-oneline.js'), oneline + '\n');
console.log('bookmarklet-oneline.js: ' + oneline.length + '자');
