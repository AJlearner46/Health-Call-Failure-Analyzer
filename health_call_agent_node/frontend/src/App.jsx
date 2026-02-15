import { useEffect, useMemo, useState } from "react";

const INPUT_MODES = ["Paste JSON", "Upload JSON file", "Use sample data"];

const DEFAULT_BACKEND = "http://127.0.0.1:8000";
const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || DEFAULT_BACKEND).trim().replace(/\/+$/, "") || DEFAULT_BACKEND;
const REQUEST_TIMEOUT_MS = Number.parseInt(import.meta.env.VITE_BACKEND_TIMEOUT_SECONDS || "180", 10) * 1000;

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateConversation(callData) {
  if (!isObject(callData)) {
    return "Expected a single call object or list of call objects.";
  }

  const conv = callData.conversation;
  if (!Array.isArray(conv) || conv.length === 0) {
    return "Missing or invalid 'conversation' array.";
  }

  for (let i = 0; i < conv.length; i += 1) {
    const msg = conv[i];
    if (!isObject(msg) || typeof msg.role !== "string" || typeof msg.content !== "string") {
      return `Message ${i} must have string fields 'role' and 'content'.`;
    }
  }

  return "";
}

function normalizeCalls(data) {
  if (!data) {
    return [];
  }
  if (Array.isArray(data)) {
    return data;
  }
  if (isObject(data)) {
    return [data];
  }
  return [];
}

function isQuotaError(detailText) {
  const text = String(detailText || "").toLowerCase();
  return (
    text.includes("quota") ||
    text.includes("rate limit") ||
    text.includes("resource_exhausted") ||
    text.includes("429")
  );
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function analyzeSingle(conversation, callId) {
  const payload = { conversation };
  if (callId) {
    payload.call_id = callId;
  }

  const response = await fetchWithTimeout(`${BACKEND_URL}/api/analyze-call`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const detail = data && typeof data.detail === "string" ? data.detail : "Request failed.";
    return {
      ok: false,
      quotaExceeded: isQuotaError(detail),
      error: detail,
    };
  }

  return {
    ok: true,
    quotaExceeded: false,
    result: data,
  };
}

function formatJson(value) {
  return JSON.stringify(value, null, 2);
}

export default function App() {
  const [health, setHealth] = useState({ loading: true, ok: false, message: "Checking backend...", geminiConfigured: false });

  const [inputMode, setInputMode] = useState(INPUT_MODES[0]);
  const [jsonText, setJsonText] = useState("");
  const [uploadedData, setUploadedData] = useState(null);
  const [sampleData, setSampleData] = useState([]);

  const [readyCount, setReadyCount] = useState(0);
  const [validationErrors, setValidationErrors] = useState([]);
  const [statusMessage, setStatusMessage] = useState("");

  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState([]);

  const parsedPastedJson = useMemo(() => {
    if (!jsonText.trim()) {
      return { value: null, error: "" };
    }
    try {
      return { value: JSON.parse(jsonText), error: "" };
    } catch (error) {
      return { value: null, error: `Invalid JSON: ${String(error?.message || error)}` };
    }
  }, [jsonText]);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        const [healthRes, sampleRes] = await Promise.all([
          fetchWithTimeout(`${BACKEND_URL}/api/health`),
          fetch("/sample_calls.json"),
        ]);

        if (!active) {
          return;
        }

        if (!healthRes.ok) {
          setHealth({
            loading: false,
            ok: false,
            message: `Backend responded with ${healthRes.status}.`,
            geminiConfigured: false,
          });
        } else {
          const info = await healthRes.json();
          setHealth({
            loading: false,
            ok: true,
            message: info.gemini_configured
              ? `Connected to backend (${BACKEND_URL}).`
              : "Backend is up, but GOOGLE_API_KEY is not set.",
            geminiConfigured: Boolean(info.gemini_configured),
          });
        }

        if (sampleRes.ok) {
          const sample = await sampleRes.json();
          setSampleData(Array.isArray(sample) ? sample : []);
        }
      } catch (error) {
        if (!active) {
          return;
        }
        setHealth({
          loading: false,
          ok: false,
          message: `Cannot reach backend at ${BACKEND_URL}. Start backend first.`,
          geminiConfigured: false,
        });
      }
    }

    bootstrap();
    return () => {
      active = false;
    };
  }, []);

  function getActiveData() {
    if (inputMode === "Paste JSON") {
      return parsedPastedJson.value;
    }
    if (inputMode === "Upload JSON file") {
      return uploadedData;
    }
    return sampleData;
  }

  function validateAndPrepareCalls(rawData) {
    const calls = normalizeCalls(rawData);
    if (calls.length === 0) {
      return {
        valid: [],
        errors: ["No call data to analyze."],
      };
    }

    const valid = [];
    const errors = [];

    calls.forEach((call, idx) => {
      const err = validateConversation(call);
      if (err) {
        errors.push(`Call ${idx + 1}: ${err}`);
      } else {
        valid.push({ idx, call });
      }
    });

    return { valid, errors };
  }

  useEffect(() => {
    const activeData = getActiveData();

    if (inputMode === "Paste JSON" && parsedPastedJson.error) {
      setReadyCount(0);
      setValidationErrors([parsedPastedJson.error]);
      return;
    }

    const { valid, errors } = validateAndPrepareCalls(activeData);
    setReadyCount(valid.length);
    setValidationErrors(errors);
  }, [inputMode, parsedPastedJson.error, parsedPastedJson.value, uploadedData, sampleData]);

  async function handleAnalyzeAll() {
    setResults([]);
    setStatusMessage("");
    setProgress(0);

    if (inputMode === "Paste JSON" && parsedPastedJson.error) {
      setValidationErrors([parsedPastedJson.error]);
      return;
    }

    const activeData = getActiveData();
    const { valid, errors } = validateAndPrepareCalls(activeData);
    setValidationErrors(errors);

    if (valid.length === 0) {
      setStatusMessage("No valid calls to analyze.");
      return;
    }

    setAnalyzing(true);

    const collected = [];
    let stoppedByQuota = false;

    for (let i = 0; i < valid.length; i += 1) {
      const item = valid[i];
      const callId = item.call.call_id || `call_${item.idx + 1}`;

      setProgress((i + 1) / valid.length);
      setStatusMessage(`Analyzing call ${i + 1} of ${valid.length}...`);

      try {
        const response = await analyzeSingle(item.call.conversation, callId);
        if (!response.ok) {
          collected.push({
            callId,
            call: item.call,
            result: null,
            error: response.error,
          });

          if (response.quotaExceeded) {
            stoppedByQuota = true;
            break;
          }
        } else {
          collected.push({
            callId,
            call: item.call,
            result: response.result,
            error: "",
          });
        }
      } catch (error) {
        collected.push({
          callId,
          call: item.call,
          result: null,
          error: String(error?.message || error),
        });
      }

      await delay(1200);
    }

    setResults(collected);
    if (stoppedByQuota) {
      setStatusMessage("Stopped remaining calls due to Gemini quota/rate-limit response.");
    } else {
      setStatusMessage(`Completed analysis for ${collected.length} call(s).`);
    }
    setAnalyzing(false);
  }

  async function handleUpload(file) {
    if (!file) {
      setUploadedData(null);
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      setUploadedData(parsed);
    } catch (error) {
      setUploadedData(null);
      setValidationErrors([`Invalid JSON file: ${String(error?.message || error)}`]);
    }
  }

  return (
    <main className="page-shell">
      <section className="hero">
        <div>
          <h1>Health Call Agent</h1>
          <p className="muted">Analyze failed health call conversations: detect purpose, why it failed, and exact recovery plan.</p>
        </div>
      </section>

      <section className="panel">
        <p>
          <span className={`health-dot ${health.ok && health.geminiConfigured ? "health-ok" : "health-warn"}`} />
          {health.loading ? "Checking backend..." : health.message}
        </p>
        {!health.ok && (
          <div className="notice error">
            Start backend at <code>{BACKEND_URL}</code>, then refresh.
          </div>
        )}
      </section>

      <section className="panel" style={{ marginTop: 12 }}>
        <div className="mode-tabs">
          {INPUT_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              className={`mode-btn ${inputMode === mode ? "active" : ""}`}
              onClick={() => {
                setInputMode(mode);
                setStatusMessage("");
                setResults([]);
              }}
            >
              {mode}
            </button>
          ))}
        </div>

        {inputMode === "Paste JSON" && (
          <textarea
            value={jsonText}
            onChange={(event) => setJsonText(event.target.value)}
            placeholder='{"call_id": "...", "conversation": [{"role": "agent", "content": "..."}]}'
          />
        )}

        {inputMode === "Upload JSON file" && (
          <input
            type="file"
            accept=".json,application/json"
            onChange={(event) => handleUpload(event.target.files?.[0])}
          />
        )}

        {inputMode === "Use sample data" && (
          <div className="notice ok">Loaded {sampleData.length} sample call(s) from sample_calls.json.</div>
        )}

        {validationErrors.length > 0 && (
          <div className="notice error">
            {validationErrors.map((err) => (
              <div key={err}>{err}</div>
            ))}
          </div>
        )}

        {readyCount > 0 && validationErrors.length === 0 && (
          <div className="notice ok">Ready to analyze {readyCount} call(s).</div>
        )}

        <div className="row">
          <button
            type="button"
            className="primary-btn"
            onClick={handleAnalyzeAll}
            disabled={analyzing || !health.ok || readyCount === 0 || validationErrors.length > 0}
          >
            {analyzing ? "Analyzing..." : "Analyze all"}
          </button>

          {(analyzing || progress > 0) && (
            <div className="progress-wrap" aria-label="progress">
              <div className="progress-bar" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          )}
        </div>

        {statusMessage && (
          <div className={`notice ${statusMessage.includes("Stopped") ? "warn" : "ok"}`}>{statusMessage}</div>
        )}
      </section>

      {results.length > 0 && (
        <section className="results">
          {results.map((item) => {
            const purpose = item.result?.purpose || {};
            const failure = item.result?.failure_reason || {};
            const plan = item.result?.action_plan || {};

            return (
              <article key={item.callId} className="result-card">
                <div className="result-head">Call: {item.callId}</div>
                {item.result ? (
                  <div className="result-grid">
                    <div className="block">
                      <h3>Purpose</h3>
                      <p>
                        <strong>{purpose.purpose || "-"}</strong> (confidence: {purpose.confidence || "-"})
                      </p>
                      <p>{purpose.summary || ""}</p>
                    </div>

                    <div className="block">
                      <h3>Why purpose was not achieved</h3>
                      <p>
                        <strong>Category:</strong> {failure.reason_category || "-"}
                      </p>
                      <p>
                        <strong>Explanation:</strong> {failure.explanation || ""}
                      </p>
                      {Array.isArray(failure.evidence) && failure.evidence.length > 0 && (
                        <>
                          <p>
                            <strong>Evidence:</strong>
                          </p>
                          <ul>
                            {failure.evidence.map((entry) => (
                              <li key={entry}>{entry}</li>
                            ))}
                          </ul>
                        </>
                      )}
                      <p>
                        <strong>Recommendation:</strong> {failure.recommendation || ""}
                      </p>
                    </div>

                    <div className="block">
                      <h3>Actionable plan</h3>
                      <p>
                        <strong>Goal:</strong> {plan.goal || ""}
                      </p>
                      <p>
                        <strong>Owner:</strong> {plan.owner || ""}
                      </p>
                      {Array.isArray(plan.steps) && plan.steps.length > 0 && (
                        <>
                          <p>
                            <strong>Steps:</strong>
                          </p>
                          <ol>
                            {plan.steps.map((step) => (
                              <li key={step}>{step}</li>
                            ))}
                          </ol>
                        </>
                      )}
                      <p>
                        <strong>Success Criteria:</strong> {plan.success_criteria || ""}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="notice warn">Analysis failed for this call: {item.error || "Unknown error"}</div>
                )}

                <details>
                  <summary>View conversation JSON</summary>
                  <pre>{formatJson(item.call)}</pre>
                </details>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
