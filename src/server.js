import express from "express";
import { createWechatRouter } from "./api/router.js";
import { WechatCollector } from "./core/collector.js";

const port = Number(process.env.PORT || 3000);

const collector = new WechatCollector({
  cookie: process.env.WECHAT_COOKIE || "",
  timeoutMs: Number(process.env.WECHAT_REQUEST_TIMEOUT_MS || 30000),
  userAgent: process.env.WECHAT_USER_AGENT || "Mozilla/5.0"
});

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use("/api/wechat", createWechatRouter({ collector }));

app.get("/", (_req, res) => {
  res.json({
    name: "WeChatList Node.js",
    version: "0.1.0",
    health: "/api/wechat/health"
  });
});

app.listen(port, () => {
  console.log(`WeChatList Node.js listening on http://localhost:${port}`);
});
