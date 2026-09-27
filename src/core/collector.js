import { HttpClient } from "./http-client.js";
import { parseWechatArticleHtml } from "./article-parser.js";
import { exportArticle } from "./exporter.js";
import { FileStorage } from "./storage.js";
import { WechatBackendAdapter } from "../adapters/wechat-backend-adapter.js";

export class WechatCollector {
  constructor({
    cookie = "",
    timeoutMs = 30000,
    userAgent = "Mozilla/5.0",
    httpClient,
    backendAdapter,
    storage
  } = {}) {
    this.http = httpClient ?? new HttpClient({ cookie, timeoutMs, userAgent });
    this.backend = backendAdapter ?? new WechatBackendAdapter();
    this.storage = storage ?? new FileStorage();
  }

  async parseArticle(url) {
    if (!/^https:\/\/mp\.weixin\.qq\.com\//i.test(url)) {
      throw new Error("Only mp.weixin.qq.com article URLs are accepted");
    }

    const html = await this.http.getText(url);
    return parseWechatArticleHtml(html, url);
  }

  async parseArticles(urls, { concurrency = 3 } = {}) {
    if (!Array.isArray(urls) || urls.length === 0) {
      throw new Error("urls must be a non-empty array");
    }

    const safeConcurrency = Math.max(1, Math.min(Number(concurrency) || 1, 10));
    const results = new Array(urls.length);
    let cursor = 0;

    const worker = async () => {
      while (true) {
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

  async collectUrls(urls, {
    concurrency = 3,
    save = false,
    format = "json",
    directory = "articles"
  } = {}) {
    const results = await this.parseArticles(urls, { concurrency });

    if (!save) return results;

    for (const item of results) {
      if (!item.ok) continue;

      try {
        item.saved = await this.saveArticle(item.article, { format, directory });
      } catch (error) {
        item.saveError = error instanceof Error ? error.message : "Unknown error";
      }
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

  async collectAccount(keyword, options = {}) {
    const account = await this.searchAccount(keyword);
    const articles = await this.listArticles(account, options);
    return { account, articles };
  }
}
