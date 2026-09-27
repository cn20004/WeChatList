import { HttpClient } from "./http-client.js";
import { parseWechatArticleHtml } from "./article-parser.js";
import { WechatBackendAdapter } from "../adapters/wechat-backend-adapter.js";

export class WechatCollector {
  constructor({
    cookie = "",
    timeoutMs = 30000,
    userAgent = "Mozilla/5.0",
    httpClient,
    backendAdapter
  } = {}) {
    this.http = httpClient ?? new HttpClient({ cookie, timeoutMs, userAgent });
    this.backend = backendAdapter ?? new WechatBackendAdapter();
  }

  async parseArticle(url) {
    if (!/^https:\/\/mp\.weixin\.qq\.com\//i.test(url)) {
      throw new Error("Only mp.weixin.qq.com article URLs are accepted");
    }

    const html = await this.http.getText(url);
    return parseWechatArticleHtml(html, url);
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
