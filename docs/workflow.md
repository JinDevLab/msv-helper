# 작업 규칙

합치기 절차를 정한다. 복붙해서 쓰는 단순 JS이고 배포하지 않으므로 버전과 릴리스 절차는 두지 않는다.

## `main`에 합치기

원격은 `origin`(`JinDevLab/msv-helper`)이다. 복붙용 단순 JS라서 변경마다 푸시하거나 합치지 않는다.

평소에는 로컬 작업 브랜치에 커밋만 하고, 작업 브랜치를 원격에 올리지 않는다. 소유자가 됐다고 하면 아래 순서로 합친다.

1. `git fetch origin` 후 `git rebase origin/main`으로 최신 `main` 위에 올린다. 충돌이 나면 양쪽 변경을 합치고, 판단이 어려우면 멈추고 묻는다.
2. `node --check bookmarklet.js`가 통과하는지 확인한다.
3. `git push origin HEAD:main`으로 합친다. fast-forward만 받아들여지며, 거부되면 1번부터 다시 한다.
4. `git switch main`과 `git pull --ff-only`로 로컬 `main`을 갱신하고, 로컬 작업 브랜치를 지운다.

아직 `main`에 들어가지 않은 자기 작업 브랜치에만 rebase를 쓴다.
