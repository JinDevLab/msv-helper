# 작업 규칙

합치기 절차를 정한다. 개인용이고 배포하지 않으므로 버전과 릴리스 절차는 두지 않는다.

## `main`에 합치기

원격은 `origin`(`JinDevLab/msv-helper`)이다.

1. `git fetch origin` 후 `git rebase origin/main`으로 최신 `main` 위에 올린다. 충돌이 나면 양쪽 변경을 합치고, 판단이 어려우면 멈추고 묻는다.
2. `node --check bookmarklet.js`가 통과하는지 확인하고 `git push -u origin HEAD`로 브랜치를 올린다. rebase로 커밋이 바뀌었으면 `--force-with-lease`를 쓴다.
3. 소유자에게 승인을 받는다.
4. `git push origin HEAD:main`으로 합친다. fast-forward만 받아들여지며, 거부되면 1번부터 다시 한다.
5. `git switch main`과 `git pull --ff-only`로 로컬 `main`을 갱신하고, 원격과 로컬 작업 브랜치를 지운다.

아직 `main`에 들어가지 않은 자기 작업 브랜치에만 rebase와 `--force-with-lease`를 쓴다.
