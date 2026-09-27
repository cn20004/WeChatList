import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createWechatRouter } from "./api/router.js";
import { WechatCollector } from "./core/collector.js";
import { HttpClient } from "./core/http-client.js";
import { WechatBackendAdapter } from "./adapters/wechat-backend-adapter.js";

const port = Number(process.env.PORT || 3000);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const httpClient = new HttpClient({
  cookie: process.env.WECHAT_COOKIE || "",
  timeoutMs: Number(process.env.WECHAT_REQUEST_TIMEOUT_MS || 30000),
  userAgent: process.env.WECHAT_USER_AGENT || "Mozilla/5.0"
});

const backendAdapter = new WechatBackendAdapter({
  httpClient,
  token: process.env.WECHAT_TOKEN || "",
  requestDelayMs: Number(process.env.WECHAT_REQUEST_DELAY_MS || 500),
  rateLimitCooldownMs: Number(process.env.WECHAT_RATE_LIMIT_COOLDOWN_MS || 20000),
  maxRateLimitRetries: Number(process.env.WECHAT_RATE_LIMIT_RETRIES || 2)
});

const collector = new WechatCollector({ httpClient, backendAdapter });

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use("/api/wechat", createWechatRouter({ collector }));
app.use(express.static(path.join(__dirname, "web")));

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "web", "index.html"));
});

app.listen(port, () => {
  console.log(`WeChatList Node.js listening on http://localhost:${port}`);
});
