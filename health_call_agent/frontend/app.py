"""
Streamlit frontend for Health Call Agent.
Upload or paste call log JSON, then view purpose and failure reason analysis.
"""

import json
import os
import requests
import time
from pathlib import Path

# Load .env from frontend directory first (so BACKEND_URL is set)
_env_path = Path(__file__).resolve().parent / ".env"
if _env_path.exists():
    try:
        from dotenv import load_dotenv
        load_dotenv(_env_path)
    except Exception:
        pass

import streamlit as st

# Single source: backend API base URL (no trailing slash). 127.0.0.1 works reliably on Windows.
_DEFAULT_BACKEND = "http://127.0.0.1:8000"
BACKEND_URL = (os.getenv("BACKEND_URL") or _DEFAULT_BACKEND).strip().rstrip("/")
if not BACKEND_URL.startswith("http"):
    BACKEND_URL = _DEFAULT_BACKEND
REQUEST_TIMEOUT_SECONDS = int(os.getenv("BACKEND_TIMEOUT_SECONDS", "180"))


def load_sample_data():
    """Load sample_calls.json from project data folder."""
    base = Path(__file__).resolve().parent.parent
    sample_path = base / "data" / "sample_calls.json"
    if sample_path.exists():
        with open(sample_path, encoding="utf-8") as f:
            return json.load(f)
    return []


def validate_conversation(data) -> tuple[bool, str]:
    """Validate that data has a conversation list with role/content."""
    if isinstance(data, list):
        if not data:
            return False, "Empty list."
        data = data[0]
    if not isinstance(data, dict):
        return False, "Expected a single call object or list of call objects."
    conv = data.get("conversation")
    if not conv or not isinstance(conv, list):
        return False, "Missing or invalid 'conversation' array."
    for i, msg in enumerate(conv):
        if not isinstance(msg, dict) or "role" not in msg or "content" not in msg:
            return False, f"Message {i} must have 'role' and 'content'."
    return True, ""


def analyze_single(conversation: list, call_id: str | None = None) -> dict | None:
    """Call backend /api/analyze-call and return result or None on error."""
    payload = {"conversation": conversation}
    if call_id:
        payload["call_id"] = call_id
    try:
        r = requests.post(
            f"{BACKEND_URL}/api/analyze-call",
            json=payload,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        if r.status_code in (429, 502):
            try:
                detail = r.json().get("detail", "")
            except Exception:
                detail = r.text
            if "quota" in detail.lower() or "rate limit" in detail.lower() or "resource_exhausted" in detail.lower():
                st.error("Gemini quota/rate limit exceeded. Wait and retry, or use another API key/project.")
                return {"_quota_exhausted": True}
        r.raise_for_status()
        return r.json()
    except requests.exceptions.RequestException as e:
        st.error(f"API error: {e}")
        if hasattr(e, "response") and e.response is not None:
            try:
                st.code(e.response.text)
            except Exception:
                pass
        return None


def main():
    st.set_page_config(
        page_title="Health Call Agent",
        page_icon="📞",
        layout="wide",
    )
    st.title("📞 Health Call Agent")
    st.caption("Analyze call logs: identify purpose and why it was not achieved.")

    # Check backend
    try:
        health = requests.get(f"{BACKEND_URL}/api/health", timeout=5)
        health.raise_for_status()
        info = health.json()
        if not info.get("gemini_configured"):
            st.warning("Backend is up but GOOGLE_API_KEY is not set. Set it in backend .env")
    except requests.exceptions.RequestException:
        docs_url = f"{BACKEND_URL}/docs"
        st.error(f"Cannot reach backend at {BACKEND_URL}")
        st.markdown(f"""
**Start the backend first:**
1. Open a **new terminal**
2. From project root run:
   ```
   cd backend
   .venv\\Scripts\\activate
   uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
   ```
   Or double‑click **`backend\\run_backend.bat`**
3. Open **[API docs]({docs_url})** in your browser to confirm the API is up  
4. Refresh this page
        """)
        st.stop()

    # Input: file upload or text area
    input_mode = st.radio(
        "Input mode",
        ["Paste JSON", "Upload JSON file", "Use sample data"],
        horizontal=True,
    )

    raw_data = None
    if input_mode == "Paste JSON":
        raw = st.text_area(
            "Paste call log JSON (single object or array of calls)",
            height=200,
            placeholder='{"call_id": "...", "conversation": [{"role": "agent", "content": "..."}, ...]}',
        )
        if raw.strip():
            try:
                raw_data = json.loads(raw)
            except json.JSONDecodeError as e:
                st.error(f"Invalid JSON: {e}")
    elif input_mode == "Upload JSON file":
        file = st.file_uploader("Upload JSON", type=["json"])
        if file:
            try:
                raw_data = json.load(file)
            except json.JSONDecodeError as e:
                st.error(f"Invalid JSON: {e}")
    else:
        sample = load_sample_data()
        if sample:
            raw_data = sample
            st.info(f"Loaded {len(sample)} sample call(s) from data/sample_calls.json.")
        else:
            st.warning("No sample_calls.json found in data folder.")

    if raw_data is None and input_mode != "Use sample data":
        st.stop()

    # Normalize to list of calls
    if isinstance(raw_data, dict):
        calls = [raw_data]
    else:
        calls = raw_data or []

    if not calls:
        st.warning("No call data to analyze.")
        st.stop()

    # Validate all
    valid_calls = []
    for idx, call in enumerate(calls):
        ok, err = validate_conversation(call)
        if not ok:
            st.error(f"Call {idx + 1}: {err}")
        else:
            valid_calls.append((idx, call))

    if not valid_calls:
        st.stop()

    st.success(f"Ready to analyze {len(valid_calls)} call(s).")
    if st.button("Analyze all", type="primary"):
        results = []
        progress = st.progress(0)
        stop_due_to_quota = False
        for i, (idx, call) in enumerate(valid_calls):
            if stop_due_to_quota:
                break
            progress.progress((i + 1) / len(valid_calls), text=f"Analyzing call {i + 1}...")
            conversation = call.get("conversation", [])
            call_id = call.get("call_id") or f"call_{idx+1}"
            result = analyze_single(conversation, call_id)
            if result and result.get("_quota_exhausted"):
                stop_due_to_quota = True
                results.append((call_id, call, None))
                st.warning("Stopped remaining calls to avoid repeated quota errors.")
                break
            results.append((call_id, call, result))
            time.sleep(1.2)
        progress.empty()

        st.divider()
        st.subheader("Results")
        for call_id, call, result in results:
            with st.expander(f"📋 {call_id}", expanded=True):
                if result:
                    col1, col2, col3 = st.columns(3)
                    with col1:
                        st.markdown("#### Purpose")
                        p = result.get("purpose", {})
                        st.write(f"**{p.get('purpose', '—')}** (confidence: {p.get('confidence', '—')})")
                        st.write(p.get("summary", ""))
                    with col2:
                        st.markdown("#### Why purpose was not achieved")
                        fr = result.get("failure_reason", {})
                        st.write(f"**Category:** {fr.get('reason_category', '—')}")
                        st.write(f"**Explanation:** {fr.get('explanation', '')}")
                        if fr.get("evidence"):
                            st.write("**Evidence:**")
                            for e in fr["evidence"]:
                                st.write(f"- {e}")
                        st.write(f"**Recommendation:** {fr.get('recommendation', '')}")
                    with col3:
                        st.markdown("#### Actionable Plan")
                        ap = result.get("action_plan", {})
                        st.write(f"**Goal:** {ap.get('goal', '')}")
                        st.write(f"**Owner:** {ap.get('owner', '')}")
                        steps = ap.get("steps", []) or []
                        if steps:
                            st.write("**Steps:**")
                            for i, step in enumerate(steps, start=1):
                                st.write(f"{i}. {step}")
                        st.write(f"**Success Criteria:** {ap.get('success_criteria', '')}")
                else:
                    st.warning("Analysis failed for this call.")
                with st.expander("View conversation"):
                    st.json(call)


if __name__ == "__main__":
    main()
