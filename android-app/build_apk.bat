@echo off
chcp 65001 > nul
echo ========================================================
echo   올클(ALL-CLEAR) 전용 문자자동접수 앱 (.apk) 자동 빌더
echo ========================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build_apk.ps1"
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [오류] APK 빌드 중 문제가 발생했습니다.
    pause
    exit /b %ERRORLEVEL%
)
echo.
echo 아무 키나 누르면 창을 닫습니다...
pause > nul
