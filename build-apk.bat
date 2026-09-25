@echo off
echo ========================================================
echo        Building TeleCaller AI Android APK
echo ========================================================
echo.

cd /d "%~dp0mobile\android"

echo [1/2] Compiling and generating APK...
call gradlew.bat assembleDebug

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Build failed! Check the errors above.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/2] Build successful!
echo.
echo APK Location:
echo %~dp0mobile\android\app\build\outputs\apk\debug\app-debug.apk
echo.
echo Opening folder...
explorer /select,"%~dp0mobile\android\app\build\outputs\apk\debug\app-debug.apk"

pause
