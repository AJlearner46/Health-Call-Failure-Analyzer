@echo off
cd /d "%~dp0"
if not exist "node_modules" (
    echo Installing backend dependencies...
    npm install
)
echo.
echo Backend starting at http://127.0.0.1:8000
echo API docs-style root info: http://127.0.0.1:8000/
echo Health: http://127.0.0.1:8000/api/health
echo.
npm run dev
