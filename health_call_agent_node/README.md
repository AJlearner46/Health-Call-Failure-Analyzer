# Health Call Agent (Node.js Replica)

This is a separate replica of `health_call_agent` with the same functional flow, built with:

- Backend: Node.js + Express + LangGraph.js + Gemini (free models)
- Frontend: React + Vite

The original Python project remains unchanged.

## Folder structure

```
health_call_agent_node/
- backend/
  - src/
    - main.js
    - config.js
    - constants.js
    - api/
      - routes.js
    - agents/
      - prompts.js
      - nodes.js
      - graph.js
    - schemas/
      - models.js
  - package.json
  - .env.example
  - run_backend.bat
- frontend/
  - src/
    - main.jsx
    - App.jsx
    - styles.css
  - public/
    - sample_calls.json
  - package.json
  - vite.config.js
  - .env.example
  - run_frontend.bat
- data/
  - sample_calls.json
- README.md
```

## Prerequisites

- Node.js 22+ (latest recommended)
- npm 10+
- Gemini API key from https://aistudio.google.com/apikey

## Backend setup

```bash
cd health_call_agent_node/backend
copy .env.example .env
# Edit .env and set GOOGLE_API_KEY
npm install
npm run dev
```

Or run `backend\\run_backend.bat`.

Backend URLs:

- Root: `http://127.0.0.1:8000/`
- Health: `http://127.0.0.1:8000/api/health`
- Analyze: `POST /api/analyze`
- Analyze call: `POST /api/analyze-call`

## Frontend setup

```bash
cd health_call_agent_node/frontend
copy .env.example .env
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

Or run `frontend\\run_frontend.bat`.

Frontend URL:

- `http://127.0.0.1:5173`

## API compatibility

The backend mirrors original response structure:

- `purpose` with `purpose`, `confidence`, `summary`
- `failure_reason` with `reason_category`, `explanation`, `evidence`, `recommendation`
- `action_plan` with `goal`, `steps`, `owner`, `success_criteria`
- optional `call_id`

## Gemini model defaults

Defaults are aligned with the original project:

```env
GEMINI_MODELS=gemini-2.0-flash-lite,gemini-2.0-flash,gemini-2.5-flash-lite,gemini-flash-lite-latest
GEMINI_TIMEOUT_SECONDS=25
GEMINI_MAX_RETRIES=1
```

You can also set a single model:

```env
GEMINI_MODEL=gemini-2.0-flash-lite
```
