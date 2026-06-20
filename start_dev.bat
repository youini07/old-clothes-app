@echo off
echo =========================================
echo       Starting App Development Servers
echo =========================================

echo Starting Backend Server (Node.js)...
start "Backend Server" cmd /k "cd backend && npx ts-node src/index.ts"

echo Starting Frontend Server (Vite)...
start "Frontend Server" cmd /k "cd frontend && npm run dev"

echo.
echo Both servers have been started in new windows!
echo Opening browser to http://localhost:5173 in 3 seconds...
timeout /t 3 /nobreak > nul
start http://localhost:5173

echo.
echo (To stop the servers, just close the new command windows)
echo =========================================
pause
