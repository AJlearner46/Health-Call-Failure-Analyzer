@echo off
cd /d "%~dp0"
if not exist ".venv\Scripts\activate.bat" (
    echo Creating venv...
    python -m venv .venv
    call .venv\Scripts\activate.bat
    pip install -r requirements.txt
) else (
    call .venv\Scripts\activate.bat
)
echo.
echo Backend starting at http://127.0.0.1:8000
echo API docs: http://127.0.0.1:8000/docs
echo.
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
