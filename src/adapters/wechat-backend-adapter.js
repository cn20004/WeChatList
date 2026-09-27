const DEFAULT_BASE_URL = "https://mp.weixin.qq.com";

export class WechatAuthError extends Error {
  constructor(message = "WeChat backend authentication is missing or expired") {
    super(message);
    this.name = "WechatAuthError";
    this.code = "WECHAT_AUTH_REQUIRED";
  }
}

export class WechatRateLimitError extends Error {
  constructor(message = "WeChat backend rate limit triggered") {
    super(message);
    this.name = "WechatRateLimitError";
    this.code = "WECHAT_RATE_LIMITED";
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseEmbeddedJson(value, fallback) {
  if (!value) return fallback;
  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeBaseResp(payload) {
  return payload?.base_resp ?? payload?.baseResp ?? {};
}

function assertWechatResponse(payload) {
  const base = normalizeBaseResp(payload);
  const ret = Number(base.ret ?? 0);
  const message = String(base.err_msg ?? base.errMsg ?? "");

  if (ret === 0) return;

  if (ret === 200013 || /freq control/i.test(message)) {
    throw new WechatRateLimitError(message || "freq control");
  }

  if (ret === 200040 || /login|auth|token/i.test(message)) {
    throw new WechatAuthError(message || "authentication expired");
  }

  throw new Error(`WeChat backend error ret=${ret}: ${message || "unknown error"}`);
}

export class WechatBackendAdapter {
  constructor({
    httpClient,
    token = "",
    baseUrl = DEFAULT_BASE_URL,
    lang = "zh_CN",
    requestDelayMs = 500,
    rateLimitCooldownMs = 20000,
    maxRateLimitRetries = 2
  } = {}) {
    this.http = httpClient;
    this.token = String(token || "").trim();
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.lang = lang;
    this.requestDelayMs = Math.max(0, Number(requestDelayMs) || 0);
    this.rateLimitCooldownMs = Math.max(1000, Number(rateLimitCooldownMs) || 20000);
    this.maxRateLimitRetries = Math.max(0, Number(maxRateLimitRetries) || 0);
  }

  isConfigured() {
    return Boolean(this.http && this.token);
  }

  assertConfigured() {
    if (!this.http || !this.token) {
      throw new WechatAuthError(
        "Set WECHAT_COOKIE and WECHAT_TOKEN from your own authenticated mp.weixin.qq.com session"
      );
    }
  }

  buildUrl(pathname, params = {}) {
    const url = new URL(pathname, this.baseUrl);
    const merged = {
      token: this.token,
      lang: this.lang,
      f: "json",
      ajax: "1",
      ...params
    };

    for (const [key, value] of Object.entries(merged)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }

    return url.toString();
  }

  async requestJson(pathname, params) {
    this.assertConfigured();
    const payload = await this.http.getJson(this.buildUrl(pathname, params), {
      headers: { referer: `${this.baseUrl}/` }
    });
    assertWechatResponse(payload);
    return payload;
  }

  async requestWithRateLimitRetry(pathname, params) {
    let attempt = 0;

    while (true) {
      try {
        return await this.requestJson(pathname, params);
      } catch (error) {
        if (!(error instanceof WechatRateLimitError) || attempt >= this.maxRateLimitRetries) {
          throw error;
        }

        attempt += 1;
        await sleep(this.rateLimitCooldownMs * attempt);
      }
    }
  }

  async searchAccounts(keyword, { begin = 0, count = 5 } = {}) {
    this.assertConfigured();
    const query = String(keyword || "").trim();
    if (!query) throw new Error("keyword is required");

    const payload = await this.requestWithRateLimitRetry("/cgi-bin/searchbiz", {
      action: "search_biz",
      begin,
      count,
      query
    });

    const list = Array.isArray(payload?.list) ? payload.list : [];

    return list.map(item => ({
      fakeid: item.fakeid ?? "",
      nickname: item.nickname ?? "",
      alias: item.alias ?? "",
      avatar: item.round_head_img ?? "",
      signature: item.signature ?? "",
      verifyStatus: item.verify_status ?? null
    }));
  }

  async searchAccount(keyword, options = {}) {
    const list = await this.searchAccounts(keyword, options);

    if (list.length === 0) {
      throw new Error(`No Official Account found for: ${keyword}`);
    }

    if (list.length === 1) return list[0];

    const normalized = String(keyword).trim().toLowerCase();
    const exact = list.find(item =>
      item.nickname.toLowerCase() === normalized ||
      item.alias.toLowerCase() === normalized
    );

    return exact ?? {
      ambiguous: true,
      query: keyword,
      candidates: list
    };
  }

  parsePublishPage(payload, account = {}) {
    const page = parseEmbeddedJson(payload?.publish_page, {});
    const publishList = Array.isArray(page?.publish_list) ? page.publish_list : [];
    const articles = [];

    for (const entry of publishList) {
      const info = parseEmbeddedJson(entry?.publish_info, {});
      const appmsgex = Array.isArray(info?.appmsgex) ? info.appmsgex : [];

      for (const item of appmsgex) {
        if (!item?.link) continue;

        articles.push({
          fakeid: account.fakeid ?? "",
          accountName: account.nickname ?? account.accountName ?? "",
          accountAlias: account.alias ?? account.accountAlias ?? "",
          title: item.title ?? "",
          author: item.author_name ?? "",
          digest: item.digest ?? "",
          cover: item.cover ?? "",
          link: item.link,
          createTime: Number(item.create_time ?? 0) || null,
          updateTime: Number(item.update_time ?? 0) || null,
          appmsgid: item.appmsgid ?? null,
          itemidx: item.itemidx ?? null,
          publishType: entry?.publish_type ?? null,
          sentTime: Number(info?.sent_info?.time ?? 0) || null
        });
      }
    }

    return {
      totalCount: Number(page?.total_count ?? 0) || 0,
      publishCount: Number(page?.publish_count ?? 0) || 0,
      masssendCount: Number(page?.masssend_count ?? 0) || 0,
      articles
    };
  }

  async listArticlesPage(account, { begin = 0, count = 20, query = "" } = {}) {
    this.assertConfigured();
    const fakeid = typeof account === "string" ? account : account?.fakeid;
    if (!fakeid) throw new Error("account.fakeid is required");

    const payload = await this.requestWithRateLimitRetry("/cgi-bin/appmsgpublish", {
      sub: "list",
      search_field: "null",
      begin,
      count,
      query,
      fakeid,
      type: "101_1",
      free_publish_type: 1,
      sub_action: "list_ex"
    });

    return this.parsePublishPage(payload, typeof account === "string" ? { fakeid } : account);
  }

  async listArticles(account, {
    begin = 0,
    count = 20,
    limit = Infinity,
    query = "",
    maxPages = Infinity
  } = {}) {
    const safeCount = Math.max(1, Math.min(Number(count) || 20, 20));
    const safeLimit = limit === 0 || limit === null || limit === undefined
      ? Infinity
      : Math.max(1, Number(limit) || Infinity);
    const safeMaxPages = maxPages === 0 || maxPages === null || maxPages === undefined
      ? Infinity
      : Math.max(1, Number(maxPages) || Infinity);

    let offset = Math.max(0, Number(begin) || 0);
    let pageIndex = 0;
    const collected = [];
    const seen = new Set();
    let totalCount = null;

    while (collected.length < safeLimit && pageIndex < safeMaxPages) {
      const page = await this.listArticlesPage(account, {
        begin: offset,
        count: safeCount,
        query
      });

      if (totalCount === null) totalCount = page.totalCount;
      if (page.articles.length === 0) break;

      for (const article of page.articles) {
        const key = article.appmsgid != null && article.itemidx != null
          ? `${article.appmsgid}:${article.itemidx}`
          : article.link;

        if (seen.has(key)) continue;
        seen.add(key);
        collected.push(article);

        if (collected.length >= safeLimit) break;
      }

      offset += safeCount;
      pageIndex += 1;

      if (totalCount && offset >= totalCount) break;
      if (collected.length >= safeLimit) break;
      await sleep(this.requestDelayMs);
    }

    return {
      account: typeof account === "string" ? { fakeid: account } : account,
      totalCount: totalCount ?? collected.length,
      fetched: collected.length,
      articles: collected
    };
  }
}
