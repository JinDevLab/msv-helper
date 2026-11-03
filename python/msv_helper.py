"""msv-helper 파이썬 로더.

자동화 전용 Chrome 프로필을 디버그 포트로 띄우고(이미 떠 있으면 그대로 붙는다),
네이버 가격비교 검색 페이지가 열릴 때마다 bookmarklet.js를 받아 넣는다. 북마크를 누르지 않아도 패널이 뜬다.
기본 프로필은 Chrome 136부터 디버그 연결을 막아서 따로 프로필을 쓴다. 네이버는 이 프로필에서 한 번 로그인한다.

사용:
  python python/msv_helper.py          원격 main의 bookmarklet.js를 쓴다.
  python python/msv_helper.py --local  이 저장소의 bookmarklet.js를 쓴다. 푸시 전에 확인할 때 쓴다.
"""
import argparse
import asyncio
import os
import re
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

from playwright.async_api import async_playwright

SRC = 'https://raw.githubusercontent.com/JinDevLab/msv-helper/main/bookmarklet.js'
LOCAL = Path(__file__).resolve().parent.parent / 'bookmarklet.js'
PORT = 9333
PROFILE = Path(os.environ['LOCALAPPDATA']) / 'msv-helper' / 'chrome-profile'
START = 'https://search.shopping.naver.com/'
# 패널을 넣을 페이지. 패널이 띄운 iframe 안에서 다시 검색하면 바깥 페이지는 그대로라 한 번만 넣는다.
TARGET = re.compile(r'^https://search\.shopping\.naver\.com/search/')
CHROMES = [
    Path(os.environ.get('LOCALAPPDATA', '')) / 'Google/Chrome/Application/chrome.exe',
    Path(os.environ.get('PROGRAMFILES', '')) / 'Google/Chrome/Application/chrome.exe',
    Path(os.environ.get('PROGRAMFILES(X86)', '')) / 'Google/Chrome/Application/chrome.exe',
]


def port_open():
    try:
        urllib.request.urlopen(f'http://127.0.0.1:{PORT}/json/version', timeout=1)
        return True
    except OSError:
        return False


def launch_chrome(chrome):
    """자동화 프로필로 Chrome을 띄우고 디버그 포트가 열릴 때까지 기다린다."""
    PROFILE.mkdir(parents=True, exist_ok=True)
    subprocess.Popen([
        str(chrome),
        f'--remote-debugging-port={PORT}',
        f'--user-data-dir={PROFILE}',
        '--no-first-run',
        '--no-default-browser-check',
        START,
    ])
    end = time.time() + 15
    while time.time() < end:
        if port_open():
            return
        time.sleep(0.3)
    sys.exit('Chrome 디버그 포트가 열리지 않았어. 같은 프로필로 이미 띄운 Chrome이 있으면 닫고 다시 실행해.')


def read_code(local):
    # 로더와 같이 원격 main을 받는다. raw.githubusercontent.com은 5분 캐시라 푸시 뒤 반영까지 5분쯤 걸린다.
    if local:
        return LOCAL.read_text(encoding='utf-8')
    with urllib.request.urlopen(SRC, timeout=10) as res:
        return res.read().decode('utf-8')


async def main():
    parser = argparse.ArgumentParser(description='네이버 가격비교 검색 페이지에 msv-helper 패널을 자동으로 띄운다.')
    parser.add_argument('--local', action='store_true', help='원격 대신 이 저장소의 bookmarklet.js를 쓴다')
    parser.add_argument('--chrome', type=Path, help='chrome.exe 경로')
    args = parser.parse_args()

    if not port_open():
        chrome = args.chrome or next((p for p in CHROMES if p.is_file()), None)
        if not chrome:
            sys.exit('chrome.exe를 찾지 못했어. --chrome으로 경로를 알려 줘.')
        launch_chrome(chrome)

    async with async_playwright() as pw:
        browser = await pw.chromium.connect_over_cdp(f'http://127.0.0.1:{PORT}')
        context = browser.contexts[0]

        async def inject(page):
            if not TARGET.match(page.url):
                return
            try:
                code = await asyncio.to_thread(read_code, args.local)
                # 로더처럼 new Function으로 실행한다. 받은 코드가 로더 쪽 변수와 섞이지 않는다.
                await page.evaluate('(code) => new Function(code)()', code)
                print('패널 넣음:', page.url[:80])
            except Exception as err:
                print('패널을 넣지 못함:', err)

        def watch(page):
            # load는 바깥 페이지가 새로 열릴 때만 온다. iframe 안의 이동에는 오지 않는다.
            page.on('load', lambda: asyncio.ensure_future(inject(page)))

        for page in context.pages:
            watch(page)
            await inject(page)
        context.on('page', watch)

        print('준비됨. Chrome을 닫으면 끝난다.')
        closed = asyncio.Event()
        browser.on('disconnected', lambda: closed.set())
        await closed.wait()


if __name__ == '__main__':
    asyncio.run(main())
