@echo off
title AI Video Creator

echo ================================================================
echo  Starting AI Video Creator (Backend & Frontend)
echo ================================================================
echo.
echo  The servers are starting in this window.
echo  Vite will open the application in your browser automatically.
echo  If not, the URL will be shown below (usually http://localhost:5173).
REM Press CTRL+C in this window to stop both servers.
echo.
echo ================================================================
echo.

REM This single command runs "concurrently" which starts both servers.
npm start

REM Pause to show any errors if the script fails
pause