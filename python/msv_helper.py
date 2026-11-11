"""msv-helper 파이썬 로더.

자동화 전용 Chrome 프로필을 디버그 포트로 띄우고(이미 떠 있으면 그대로 붙는다),
네이버 가격비교 검색 페이지가 새로 열릴 때마다 저장소의 py-bookmarklet.js를 넣는다.
확장 프로그램의 content script처럼 동작해서 북마크를 누르지 않아도 패널이 뜨고, iframe 없이 페이지를 바로 다룬다.
기본 프로필은 Chrome 136부터 디버그 연결을 막아서 따로 프로필을 쓴다. 네이버는 이 프로필에서 한 번 로그인한다.

사용:
  python python/msv_helper.py
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

# 넣을 코드. 페이지가 새로 열릴 때마다 다시 읽으므로, 파일을 고치면 새로고침만으로 반영된다.
CODE = Path(__file__).resolve().parent.parent / 'py-bookmarklet.js'
PORT = 9333
PROFILE = Path(os.environ['LOCALAPPDATA']) / 'msv-helper' / 'chrome-profile'
START = 'https://search.shopping.naver.com/'
# 코드를 넣을 페이지. 검색 페이지에는 패널을 띄우고, NPCS(/catalog)에서는 묶어보기만 끈다.
# 필터를 누르면 네이버는 페이지를 새로 열지 않고 화면만 바꾸므로, 그때는 넣은 패널이 그대로 남는다.
TARGET = re.compile(r'^https://search\.shopping\.naver\.com/(search/|catalog)')
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


async def main():
    parser = argparse.ArgumentParser(description='네이버 가격비교 검색 페이지에 msv-helper 패널을 자동으로 띄운다.')
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
                code = CODE.read_text(encoding='utf-8')
                # 북마클릿 로더처럼 new Function으로 실행한다. 넣은 코드가 evaluate 쪽 변수와 섞이지 않는다.
                await page.evaluate('(code) => new Function(code)()', code)
                print('코드 넣음:', page.url[:80])
            except Exception as err:
                print('코드를 넣지 못함:', err)

        def watch(page):
            # 페이지가 새로 열릴 때마다 HTML을 다 읽은 시점에 넣는다. load는 이미지와 광고까지 다 받아야 와서 늦다.
            # 패널 코드는 필요한 요소가 그려질 때까지 스스로 기다린다. iframe 안의 이동에는 오지 않는다.
            page.on('domcontentloaded', lambda: asyncio.ensure_future(inject(page)))

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
