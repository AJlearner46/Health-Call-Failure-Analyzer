import express from "express";
import cors from "cors";

import { getSettings } from "./config.js";
import { PATH_HEALTH, PATH_ANALYZE, PATH_ANALYZE_CALL, API_PREFIX } from "./constants.js";
import { router } from "./api/routes.js";

const settings = getSettings();
const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "2mb" }));
app.use(API_PREFIX, router);

app.get("/", (_req, res) => {
  const base = `http://127.0.0.1:${settings.port}`;
  res.json({
    service: "Health Call Agent API (Node)",
    health: `${base}${PATH_HEALTH}`,
    analyze: `POST ${PATH_ANALYZE} or POST ${PATH_ANALYZE_CALL}`,
  });
});

app.listen(settings.port, settings.host, () => {
  // eslint-disable-next-line no-console
  console.log(`Health Call Agent Node API running at http://${settings.host}:${settings.port}`);
});
