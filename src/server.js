import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createWechatRouter } from "./api/router.js";
import { WechatCollector } from "./core/collector.js";

const port = Number(process.env.PORT || 3000);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const collector = new WechatCollector({
  cookie: process.env.WECHAT_COOKIE || "",
  timeoutMs: Number(process.env.WECHAT_REQUEST_TIMEOUT_MS || 30000),
  userAgent: process.env.WECHAT_USER_AGENT || "Mozilla/5.0"
});

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
