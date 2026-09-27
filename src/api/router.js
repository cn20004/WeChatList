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

  router.post("/articles/batch", async (req, res) => {
    try {
      const { urls, concurrency = 3 } = req.body ?? {};
      const results = await collector.parseArticles(urls, { concurrency });

      return res.json({
        total: results.length,
        success: results.filter(item => item.ok).length,
        failed: results.filter(item => !item.ok).length,
        results
      });
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  router.post("/articles/collect", async (req, res) => {
    try {
      const {
        urls,
        concurrency = 3,
        save = true,
        format = "json",
        directory = "articles"
      } = req.body ?? {};

      const results = await collector.collectUrls(urls, {
        concurrency,
        save,
        format,
        directory
      });

      return res.json({
        total: results.length,
        success: results.filter(item => item.ok).length,
        failed: results.filter(item => !item.ok).length,
        saved: results.filter(item => item.saved).length,
        results
      });
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  router.post("/articles/export", async (req, res) => {
    try {
      const { article, format = "markdown" } = req.body ?? {};
      if (!article) return res.status(400).json({ error: "article is required" });

      const exported = collector.exportArticle(article, format);
      res.type(exported.contentType);
      return res.send(exported.content);
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  router.post("/articles/save", async (req, res) => {
    try {
      const { article, format = "json", directory = "articles" } = req.body ?? {};
      if (!article) return res.status(400).json({ error: "article is required" });

      const result = await collector.saveArticle(article, { format, directory });
      return res.json(result);
    } catch (error) {
      return res.status(400).json({
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
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Unknown error",
        code: error?.code ?? null
      });
    }
  });

  router.post("/accounts/articles", async (req, res) => {
    try {
      const {
        account,
        begin = 0,
        count = 20,
        limit = 100,
        query = "",
        maxPages = 20
      } = req.body ?? {};

      const result = await collector.listArticles(account, {
        begin,
        count,
        limit,
        query,
        maxPages
      });

      return res.json(result);
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Unknown error",
        code: error?.code ?? null
      });
    }
  });

  router.post("/accounts/collect", async (req, res) => {
    try {
      const {
        keyword,
        list = {},
        collect = {}
      } = req.body ?? {};

      const account = await collector.searchAccount(keyword);

      if (account?.ambiguous) {
        return res.status(409).json(account);
      }

      const listed = await collector.listArticles(account, list);
      const urls = listed.articles.map(item => item.link);
      const results = await collector.collectUrls(urls, collect);

      return res.json({
        account,
        listed: {
          totalCount: listed.totalCount,
          fetched: listed.fetched
        },
        collected: {
          total: results.length,
          success: results.filter(item => item.ok).length,
          failed: results.filter(item => !item.ok).length,
          saved: results.filter(item => item.saved).length
        },
        results
      });
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Unknown error",
        code: error?.code ?? null
      });
    }
  });

  return router;
}
