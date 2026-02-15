import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, "..", ".env");
dotenv.config({ path: envPath });

const defaultModels = [
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash",
  "gemini-2.5-flash-lite",
  "gemini-flash-lite-latest",
];

function stripKey(value) {
  if (!value) {
    return "";
  }
  const trimmed = String(value).trim();
  if (trimmed.length >= 2 && trimmed[0] === trimmed[trimmed.length - 1] && (trimmed[0] === "'" || trimmed[0] === '"')) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

let cached = null;

export function getSettings() {
  if (cached) {
    return cached;
  }

  const apiKey = stripKey(process.env.GOOGLE_API_KEY || "");
  const singleModel = stripKey(process.env.GEMINI_MODEL || "");
  const rawModels = singleModel
    ? singleModel
    : stripKey(process.env.GEMINI_MODELS || defaultModels.join(","));

  const geminiModels = rawModels
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);

  cached = {
    googleApiKey: apiKey,
    geminiModels: geminiModels.length > 0 ? geminiModels : defaultModels,
    geminiModel: geminiModels[0] || defaultModels[0],
    geminiTimeoutSeconds: Number.parseInt(process.env.GEMINI_TIMEOUT_SECONDS || "25", 10),
    geminiMaxRetries: Number.parseInt(process.env.GEMINI_MAX_RETRIES || "1", 10),
    host: process.env.HOST || "127.0.0.1",
    port: Number.parseInt(process.env.PORT || "8000", 10),
    get isConfigured() {
      return Boolean(this.googleApiKey);
    },
  };

  return cached;
}
