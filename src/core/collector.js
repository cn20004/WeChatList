import path from "node:path";
import { HttpClient } from "./http-client.js";
import { parseWechatArticleHtml } from "./article-parser.js";
import { exportArticle } from "./exporter.js";
import { FileStorage } from "./storage.js";
import { AssetDownloader } from "./asset-downloader.js";
import { filterArticles } from "./filter.js";
import { createZipFromDirectory } from "./bundle.js";
import { WechatBackendAdapter } from "../adapters/wechat-backend-adapter.js";

function sanitize(value = "untitled") {
  return value.replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, " ").trim() || "untitled";
}

export class WechatCollector {
  constructor({
    cookie = "",
    timeoutMs = 30000,
    userAgent = "Mozilla/5.0",
    httpClient,
    backendAdapter,
    storage,
    assetDownloader
  } = {}) {
    this.http = httpClient ?? new HttpClient({ cookie, timeoutMs, userAgent });
    this.backend = backendAdapter ?? new WechatBackendAdapter();
    this.storage = storage ?? new FileStorage();
    this.assets = assetDownloader ?? new AssetDownloader({
      httpClient: this.http,
      baseDir: this.storage.baseDir
    });
  }

  async parseArticle(url) {
    if (!/^https:\/\/mp\.weixin\.qq\.com\//i.test(url)) {
      throw new Error("Only mp.weixin.qq.com article URLs are accepted");
    }

    const html = await this.http.getText(url);
    return parseWechatArticleHtml(html, url);
  }

  async parseArticles(urls, { concurrency = 3, onProgress = null, isCancelled = null } = {}) {
    if (!Array.isArray(urls) || urls.length === 0) {
      throw new Error("urls must be a non-empty array");
    }

    const safeConcurrency = Math.max(1, Math.min(Number(concurrency) || 1, 10));
    const results = new Array(urls.length);
    let cursor = 0;
    let completed = 0;

    const worker = async () => {
      while (true) {
        if (isCancelled?.()) return;
        const index = cursor++;
        if (index >= urls.length) return;

        const url = urls[index];
        try {
          const article = await this.parseArticle(url);
          results[index] = { ok: true, url, article };
        } catch (error) {
          results[index] = {
            ok: false,
            url,
            error: error instanceof Error ? error.message : "Unknown error"
          };
        }

        completed += 1;
        await onProgress?.({
          stage: "parsing",
          current: completed,
          total: urls.length,
          message: `Parsed ${completed}/${urls.length}`
        });
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(safeConcurrency, urls.length) }, () => worker())
    );

    return results;
  }

  exportArticle(article, format = "markdown") {
    return exportArticle(article, format);
  }

  async saveArticle(article, options = {}) {
    return this.storage.saveArticle(article, options);
  }

  async saveArticlesExcel(articles, options = {}) {
    return this.storage.saveArticlesExcel(articles, options);
  }

  filterArticles(articles, options = {}) {
    return filterArticles(articles, options);
  }

  async downloadArticleAssets(article, options = {}) {
    return this.assets.downloadArticleAssets(article, options);
  }

  async packageArticle(article, {
    directory = "articles",
    formats = ["json", "markdown", "html", "docx", "pdf", "jpg"],
    assets = true,
    includeImages = true,
    includeAudio = true,
    includeCover = true,
    zip = true
  } = {}) {
    const title = sanitize(article.title || "untitled");
    const articleDirectory = path.join(directory, title);
    const saved = [];
    const errors = [];

    for (const format of formats) {
      try {
        saved.push(await this.saveArticle(article, {
          format,
          directory: articleDirectory,
          filename: title
        }));
      } catch (error) {
        errors.push({
          format,
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }

    let assetResult = null;
    if (assets) {
      assetResult = await this.downloadArticleAssets(article, {
        directory,
        includeImages,
        includeAudio,
        includeCover
      });
    }

    let archive = null;
    if (zip) {
      const sourceDir = path.join(this.storage.baseDir, articleDirectory);
      const outputFile = path.join(this.storage.baseDir, directory, `${title}.zip`);

      try {
        archive = await createZipFromDirectory(sourceDir, outputFile);
      } catch (error) {
        errors.push({
          format: "zip",
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }

    return {
      article: {
        title: article.title,
        sourceUrl: article.sourceUrl
      },
      saved,
      assets: assetResult,
      archive,
      errors
    };
  }

  async collectUrls(urls, {
    concurrency = 3,
    save = false,
    format = "json",
    formats = null,
    directory = "articles",
    assets = false,
    zip = false,
    onProgress = null,
    isCancelled = null
  } = {}) {
    const results = await this.parseArticles(urls, { concurrency, onProgress, isCancelled });

    if (!save && !assets && !zip) return results;

    let packaged = 0;
    for (const item of results) {
      if (isCancelled?.()) break;
      if (!item?.ok) continue;

      try {
        if (formats?.length || assets || zip) {
          item.package = await this.packageArticle(item.article, {
            directory,
            formats: formats?.length ? formats : [format],
            assets,
            zip
          });
        } else if (save) {
          item.saved = await this.saveArticle(item.article, { format, directory });
        }
      } catch (error) {
        item.saveError = error instanceof Error ? error.message : "Unknown error";
      }

      packaged += 1;
      await onProgress?.({
        stage: "packaging",
        current: packaged,
        total: results.filter(result => result?.ok).length,
        message: `Packaged ${packaged}`
      });
    }

    return results;
  }

  async searchAccount(keyword) {
    if (!keyword?.trim()) throw new Error("keyword is required");
    return this.backend.searchAccount(keyword.trim());
  }

  async listArticles(account, options = {}) {
    return this.backend.listArticles(account, options);
  }

  async collectAccount(keyword, {
    list = {},
    filter = {},
    collect = {}
  } = {}) {
    const account = await this.searchAccount(keyword);
    if (account?.ambiguous) return { account, ambiguous: true };

    const listed = await this.listArticles(account, list);
    const filtered = this.filterArticles(listed.articles, filter);
    const urls = filtered.map(item => item.link);

    const requestedFormats = Array.isArray(collect.formats)
      ? collect.formats.map(value => String(value).toLowerCase())
      : null;

    const wantsExcel = requestedFormats?.some(value => ["xlsx", "excel"].includes(value)) ?? false;
    const articleFormats = requestedFormats
      ? requestedFormats.filter(value => !["xlsx", "excel"].includes(value))
      : requestedFormats;

    const results = urls.length
      ? await this.collectUrls(urls, {
          ...collect,
          formats: articleFormats
        })
      : [];

    let excel = null;
    if (wantsExcel) {
      const parsedArticles = results
        .filter(item => item.ok && item.article)
        .map(item => ({
          ...item.article,
          accountName: account.nickname ?? "",
          digest: filtered.find(meta => meta.link === item.url)?.digest ?? ""
        }));

      excel = await this.saveArticlesExcel(parsedArticles, {
        directory: collect.directory || "accounts",
        filename: `${sanitize(account.nickname || keyword)}-articles`
      });
    }

    return {
      account,
      totalCount: listed.totalCount,
      listed: listed.fetched,
      matched: filtered.length,
      excel,
      results
    };
  }
}
