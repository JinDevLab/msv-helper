@echo off
rem 더블클릭으로 파이썬 로더를 띄운다. 처음 한 번은 pip install -r requirements.txt가 필요하다.
chcp 65001 > nul
python "%~dp0msv_helper.py" %*
pause
