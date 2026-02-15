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
echo Frontend: http://localhost:8501 (or http://127.0.0.1:8501)
echo Ensure backend is running at http://127.0.0.1:8000
echo.
streamlit run app.py
