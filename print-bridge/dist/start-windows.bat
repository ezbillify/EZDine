@echo off
REM EZDine Print Bridge - Windows Launcher

title EZDine Print Bridge

cls
echo ========================================
echo    EZDINE PRINT BRIDGE
echo ========================================
echo.
echo    Starting print bridge...
echo.

REM Start the server
python server.py

REM Keep window open if there's an error
if errorlevel 1 (
    echo.
    echo Error starting print bridge
    pause
)