@echo off
REM Setup EZDine Print Bridge to auto-start on Windows login

title EZDine Print Bridge - Auto-Start Setup

cls
echo ========================================
echo    EZDINE PRINT BRIDGE
echo    Auto-Start Setup
echo ========================================
echo.

REM Get the current directory
set "SCRIPT_DIR=%~dp0"

REM Create VBS script to run Python silently
set "VBS_FILE=%SCRIPT_DIR%start-silent.vbs"

echo Creating startup script...
(
echo Set WshShell = CreateObject^("WScript.Shell"^)
echo WshShell.Run "python ""%SCRIPT_DIR%server.py""", 0, False
) > "%VBS_FILE%"

REM Create shortcut in Startup folder
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT=%STARTUP_FOLDER%\EZDine Print Bridge.lnk"

echo Creating startup shortcut...
powershell -Command "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%SHORTCUT%'); $Shortcut.TargetPath = 'wscript.exe'; $Shortcut.Arguments = '\"%VBS_FILE%\"'; $Shortcut.WorkingDirectory = '%SCRIPT_DIR%'; $Shortcut.Description = 'EZDine Print Bridge'; $Shortcut.Save()"

echo.
echo ========================================
echo    Setup Complete!
echo ========================================
echo.
echo The print bridge will now:
echo   - Start automatically when Windows starts
echo   - Run in the background (no window)
echo   - Restart automatically if it crashes
echo.
echo To disable auto-start:
echo   Delete: %SHORTCUT%
echo.
pause