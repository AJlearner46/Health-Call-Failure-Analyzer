# Health Call Agent

Analyzes call logs (agent/vendor ↔ customer conversations) to identify **what the purpose of the call was** (e.g. booking, sell, consultant) and **why that purpose was not achieved**.

- **Backend:** FastAPI + LangGraph + Gemini (free tier)
- **Frontend:** Streamlit
- **Data:** JSON (conversation with `role` and `content` per message)

## Project structure

```
health_call_agent/
├── backend/                 # FastAPI + LangGraph
│   ├── app/
│   │   ├── main.py          # App entry
│   │   ├── config.py       # Env settings
│   │   ├── agents/         # LangGraph: purpose + failure reason
│   │   ├── api/            # Routes
│   │   └── schemas/        # Pydantic models
│   ├── requirements.txt
│   └── .env.example
├── frontend/                # Streamlit
│   ├── app.py
│   ├── requirements.txt
│   └── .env.example
├── data/
│   └── sample_calls.json   # Example call logs
├── .gitignore
└── README.md
```

## Setup

### 1. Gemini API key (free)

- Go to [Google AI Studio](https://aistudio.google.com/apikey) and create an API key.
- Copy `backend/.env.example` to `backend/.env` and set:

```env
GOOGLE_API_KEY=your_key_here
GEMINI_MODELS=gemini-2.0-flash-lite,gemini-2.0-flash,gemini-2.5-flash-lite,gemini-flash-lite-latest
GEMINI_TIMEOUT_SECONDS=25
GEMINI_MAX_RETRIES=1
# optional single model:
# GEMINI_MODEL=gemini-2.0-flash-lite
```

### 2. Backend

From project root:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate   # Windows
# source .venv/bin/activate  # Linux/Mac
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Or run **`backend\run_backend.bat`** (Windows).

- API root: **http://127.0.0.1:8000**
- API docs: **http://127.0.0.1:8000/docs**
- Health: **http://127.0.0.1:8000/api/health**

If analyze endpoints fail with model errors, verify `GEMINI_MODELS` in `backend/.env`.

### 3. Frontend

From project root:

```bash
cd frontend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
streamlit run app.py
```

Or run **`frontend\run_frontend.bat`** (Windows).

Set **`frontend\.env`** (copy from `frontend\.env.example`) with:
```env
BACKEND_URL=http://127.0.0.1:8000
BACKEND_TIMEOUT_SECONDS=180
```

- Frontend: **http://localhost:8501** (or http://127.0.0.1:8501)
- Backend must be running at the URL in `BACKEND_URL` for "Analyze" to work.

## API

- **POST /api/analyze** – Body: `{ "conversation": [ { "role": "agent", "content": "..." }, ... ] }`
- **POST /api/analyze-call** – Body: full call log with optional `call_id`, `date`, `conversation`, etc.
- **GET /api/health** – Health check and whether Gemini is configured

Analysis response includes:
- `purpose` (purpose, confidence, summary)
- `failure_reason` (reason_category, explanation, evidence, recommendation)
- `action_plan` (goal, steps, owner, success_criteria)

## JSON format

Single call:

```json
{
  "call_id": "call_001",
  "conversation": [
    { "role": "agent", "content": "Hello, how may I help?" },
    { "role": "customer", "content": "I want to book an appointment." }
  ]
}
```

Multiple calls: array of such objects. All conversations in the dataset are assumed to be **unsuccessful** (purpose not met); the agent infers purpose and failure reason.

