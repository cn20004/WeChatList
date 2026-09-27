import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createWechatRouter } from "./api/router.js";
import { WechatCollector } from "./core/collector.js";
import { HttpClient } from "./core/http-client.js";
import { WechatBackendAdapter } from "./adapters/wechat-backend-adapter.js";
import { SessionStore } from "./core/session-store.js";
import { PersistentJobManager } from "./core/job-manager.js";

const port = Number(process.env.PORT || 3000);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const sessionStore = new SessionStore();
const storedSession = await sessionStore.load();

const cookie = process.env.WECHAT_COOKIE || storedSession?.cookie || "";
const token = process.env.WECHAT_TOKEN || storedSession?.token || "";

const httpClient = new HttpClient({
  cookie,
  timeoutMs: Number(process.env.WECHAT_REQUEST_TIMEOUT_MS || 30000),
  userAgent: process.env.WECHAT_USER_AGENT || "Mozilla/5.0"
});

const backendAdapter = new WechatBackendAdapter({
  httpClient,
  token,
  requestDelayMs: Number(process.env.WECHAT_REQUEST_DELAY_MS || 500),
  rateLimitCooldownMs: Number(process.env.WECHAT_RATE_LIMIT_COOLDOWN_MS || 20000),
  maxRateLimitRetries: Number(process.env.WECHAT_RATE_LIMIT_RETRIES || 2)
});

const collector = new WechatCollector({ httpClient, backendAdapter });
const jobManager = new PersistentJobManager();

jobManager.register("account-collect", async (payload, context) => {
  const { keyword, list = {}, filter = {}, collect = {} } = payload;

  await context.updateProgress({
    stage: "searching",
    current: 0,
    total: null,
    message: `Searching account: ${keyword}`
  });

  return collector.collectAccount(keyword, {
    list: {
      ...list,
      onProgress: context.updateProgress,
      isCancelled: context.isCancelled
    },
    filter,
    collect: {
      ...collect,
      onProgress: context.updateProgress,
      isCancelled: context.isCancelled
    }
  });
});

jobManager.register("urls-collect", async (payload, context) => {
  const { urls = [], ...options } = payload;
  return collector.collectUrls(urls, {
    ...options,
    onProgress: context.updateProgress,
    isCancelled: context.isCancelled
  });
});

await jobManager.resumeInterrupted();

const app = express();
app.use(express.json({ limit: "4mb" }));
app.use("/api/wechat", createWechatRouter({ collector, jobManager }));
app.use("/downloads", express.static(collector.storage.baseDir));
app.use(express.static(path.join(__dirname, "web")));

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "web", "index.html"));
});

app.listen(port, () => {
  console.log(`WeChatList Node.js listening on http://localhost:${port}`);
  console.log(`WeChat backend session: ${backendAdapter.isConfigured() ? "configured" : "not configured"}`);
});
