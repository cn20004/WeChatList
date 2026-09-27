import express from "express";
import { WechatCollector } from "../core/collector.js";
import { exportArticleBinary, exportArticlesXlsx } from "../core/binary-exporter.js";

function errorPayload(error) {
  return {
    error: error instanceof Error ? error.message : "Unknown error",
    code: error?.code ?? null
  };
}

export function createWechatRouter({
  collector = new WechatCollector(),
  jobManager = null
} = {}) {
  const router = express.Router();

  router.get("/jobs", async (req, res) => {
    if (!jobManager) return res.status(501).json({ error: "Job manager is not configured" });
    return res.json(await jobManager.list({ limit: Number(req.query.limit || 100) }));
  });

  router.get("/jobs/:id", async (req, res) => {
    if (!jobManager) return res.status(501).json({ error: "Job manager is not configured" });
    const job = await jobManager.get(req.params.id);
    if (!job) return res.status(404).json({ error: "Job not found" });
    return res.json(job);
  });

  router.post("/jobs/account-collect", async (req, res) => {
    try {
      if (!jobManager) return res.status(501).json({ error: "Job manager is not configured" });
      const job = await jobManager.create("account-collect", req.body ?? {});
      return res.status(202).json(job);
    } catch (error) {
      return res.status(400).json(errorPayload(error));
    }
  });

  router.post("/jobs/urls-collect", async (req, res) => {
    try {
      if (!jobManager) return res.status(501).json({ error: "Job manager is not configured" });
      const job = await jobManager.create("urls-collect", req.body ?? {});
      return res.status(202).json(job);
    } catch (error) {
      return res.status(400).json(errorPayload(error));
    }
  });

  router.post("/jobs/:id/cancel", async (req, res) => {
    if (!jobManager) return res.status(501).json({ error: "Job manager is not configured" });
    const job = await jobManager.cancel(req.params.id);
    if (!job) return res.status(404).json({ error: "Job not found" });
    return res.json(job);
  });

  router.post("/jobs/:id/retry", async (req, res) => {
    if (!jobManager) return res.status(501).json({ error: "Job manager is not configured" });
    const job = await jobManager.retry(req.params.id);
    if (!job) return res.status(404).json({ error: "Job not found" });
    return res.json(job);
  });

  router.get("/health", (_req, res) => {
    res.json({
      ok: true,
      module: "wechat-list-node",
      capabilities: {
        publicArticleParse: true,
        accountSearch: collector.backend?.isConfigured?.() ?? false,
        historyPagination: collector.backend?.isConfigured?.() ?? false,
        filters: ["keyword", "date-range"],
        assetDownload: ["cover", "images", "audio", "music-url"],
        export: ["json", "markdown", "html", "docx", "xlsx", "pdf", "jpg", "zip"]
      }
    });
  });

  router.post("/articles/parse", async (req, res) => {
    try {
      const { url } = req.body ?? {};
      if (!url) return res.status(400).json({ error: "url is required" });
      return res.json(await collector.parseArticle(url));
    } catch (error) {
      return res.status(500).json(errorPayload(error));
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
      return res.status(400).json(errorPayload(error));
    }
  });

  router.post("/articles/filter", (req, res) => {
    try {
      const { articles = [], ...options } = req.body ?? {};
      const filtered = collector.filterArticles(articles, options);
      return res.json({
        total: articles.length,
        matched: filtered.length,
        articles: filtered
      });
    } catch (error) {
      return res.status(400).json(errorPayload(error));
    }
  });

  router.post("/articles/collect", async (req, res) => {
    try {
      const {
        urls,
        concurrency = 3,
        save = true,
        format = "json",
        formats = null,
        directory = "articles",
        assets = false,
        zip = false
      } = req.body ?? {};

      const results = await collector.collectUrls(urls, {
        concurrency,
        save,
        format,
        formats,
        directory,
        assets,
        zip
      });

      return res.json({
        total: results.length,
        success: results.filter(item => item.ok).length,
        failed: results.filter(item => !item.ok).length,
        saved: results.filter(item => item.saved || item.package).length,
        results
      });
    } catch (error) {
      return res.status(400).json(errorPayload(error));
    }
  });

  router.post("/articles/export", async (req, res) => {
    try {
      const { article, format = "markdown" } = req.body ?? {};
      if (!article) return res.status(400).json({ error: "article is required" });

      const normalized = String(format).toLowerCase();

      if (["docx", "word", "pdf", "jpg", "jpeg"].includes(normalized)) {
        const exported = await exportArticleBinary(article, normalized, {
          executablePath: collector.storage?.browserExecutablePath
        });
        res.type(exported.contentType);
        return res.send(exported.content);
      }

      const exported = collector.exportArticle(article, normalized);
      res.type(exported.contentType);
      return res.send(exported.content);
    } catch (error) {
      return res.status(400).json(errorPayload(error));
    }
  });

  router.post("/articles/excel", async (req, res) => {
    try {
      const { articles = [] } = req.body ?? {};
      const exported = await exportArticlesXlsx(articles);
      res.type(exported.contentType);
      return res.send(exported.content);
    } catch (error) {
      return res.status(400).json(errorPayload(error));
    }
  });

  router.post("/articles/save", async (req, res) => {
    try {
      const {
        article,
        format = "json",
        directory = "articles",
        filename = ""
      } = req.body ?? {};

      if (!article) return res.status(400).json({ error: "article is required" });

      return res.json(await collector.saveArticle(article, {
        format,
        directory,
        filename
      }));
    } catch (error) {
      return res.status(400).json(errorPayload(error));
    }
  });

  router.post("/articles/assets", async (req, res) => {
    try {
      const { article, ...options } = req.body ?? {};
      if (!article) return res.status(400).json({ error: "article is required" });
      return res.json(await collector.downloadArticleAssets(article, options));
    } catch (error) {
      return res.status(400).json(errorPayload(error));
    }
  });

  router.post("/articles/package", async (req, res) => {
    try {
      const { article, ...options } = req.body ?? {};
      if (!article) return res.status(400).json({ error: "article is required" });
      return res.json(await collector.packageArticle(article, options));
    } catch (error) {
      return res.status(400).json(errorPayload(error));
    }
  });

  router.post("/accounts/search", async (req, res) => {
    try {
      const { keyword } = req.body ?? {};
      return res.json(await collector.searchAccount(keyword));
    } catch (error) {
      return res.status(400).json(errorPayload(error));
    }
  });

  router.post("/accounts/articles", async (req, res) => {
    try {
      const {
        account,
        begin = 0,
        count = 20,
        limit = 0,
        query = "",
        maxPages = 0
      } = req.body ?? {};

      return res.json(await collector.listArticles(account, {
        begin,
        count,
        limit,
        query,
        maxPages
      }));
    } catch (error) {
      return res.status(400).json(errorPayload(error));
    }
  });

  router.post("/accounts/collect", async (req, res) => {
    try {
      const {
        keyword,
        list = {},
        filter = {},
        collect = {}
      } = req.body ?? {};

      const result = await collector.collectAccount(keyword, {
        list,
        filter,
        collect
      });

      if (result?.ambiguous) return res.status(409).json(result);
      return res.json(result);
    } catch (error) {
      return res.status(400).json(errorPayload(error));
    }
  });

  return router;
}
