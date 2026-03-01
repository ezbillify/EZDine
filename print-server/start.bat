@echo off
echo Installing dependencies...
npm install

echo.
echo Starting EZDine Print Server...
echo.
echo Server will run at: http://localhost:8080
echo.
echo Configure EZDine web app to use this URL in Settings > Printing Setup
echo.
echo Press Ctrl+C to stop the server
echo.

npm start