import express from "express";
import { WechatCollector } from "../core/collector.js";

export function createWechatRouter({ collector = new WechatCollector() } = {}) {
  const router = express.Router();

  router.get("/health", (_req, res) => {
    res.json({ ok: true, module: "wechat-list-node" });
  });

  router.post("/articles/parse", async (req, res) => {
    try {
      const { url } = req.body ?? {};
      if (!url) return res.status(400).json({ error: "url is required" });

      const article = await collector.parseArticle(url);
      return res.json(article);
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  router.post("/accounts/search", async (req, res) => {
    try {
      const { keyword } = req.body ?? {};
      const account = await collector.searchAccount(keyword);
      return res.json(account);
    } catch (error) {
      return res.status(501).json({
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  return router;
}
