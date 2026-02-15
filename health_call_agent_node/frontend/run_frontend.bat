@echo off
cd /d "%~dp0"
if not exist "node_modules" (
    echo Installing frontend dependencies...
    npm install
)
echo.
echo Frontend: http://127.0.0.1:5173
echo Ensure backend is running at http://127.0.0.1:8000
echo.
npm run dev -- --host 127.0.0.1 --port 5173
