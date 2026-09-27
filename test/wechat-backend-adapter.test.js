import test from "node:test";
import assert from "node:assert/strict";
import {
  WechatBackendAdapter,
  WechatRateLimitError
} from "../src/adapters/wechat-backend-adapter.js";

class FakeHttpClient {
  constructor(handler) {
    this.handler = handler;
    this.urls = [];
  }

  async getJson(url) {
    this.urls.push(url);
    return this.handler(url);
  }
}

test("searchAccounts maps verified searchbiz fields", async () => {
  const http = new FakeHttpClient(() => ({
    base_resp: { ret: 0 },
    list: [{
      fakeid: "fake-1",
      nickname: "测试公众号",
      alias: "test-account",
      round_head_img: "https://example.com/a.jpg",
      signature: "sig",
      verify_status: 1
    }]
  }));

  const adapter = new WechatBackendAdapter({
    httpClient: http,
    token: "token-123",
    requestDelayMs: 0
  });

  const list = await adapter.searchAccounts("测试");
  assert.equal(list.length, 1);
  assert.equal(list[0].fakeid, "fake-1");
  assert.equal(list[0].nickname, "测试公众号");
  assert.match(http.urls[0], /cgi-bin\/searchbiz/);
  assert.match(http.urls[0], /action=search_biz/);
});

test("parsePublishPage handles nested JSON strings", () => {
  const adapter = new WechatBackendAdapter({
    httpClient: new FakeHttpClient(() => ({})),
    token: "token-123"
  });

  const payload = {
    base_resp: { ret: 0 },
    publish_page: JSON.stringify({
      total_count: 2,
      publish_count: 2,
      masssend_count: 1,
      publish_list: [{
        publish_type: 1,
        publish_info: JSON.stringify({
          sent_info: { time: 1720000000 },
          appmsgex: [{
            title: "文章一",
            link: "https://mp.weixin.qq.com/s/one",
            cover: "https://example.com/cover.jpg",
            digest: "摘要",
            create_time: 1719999999,
            update_time: 1720000000,
            author_name: "作者",
            appmsgid: 1001,
            itemidx: 1
          }]
        })
      }]
    })
  };

  const page = adapter.parsePublishPage(payload, {
    fakeid: "fake-1",
    nickname: "测试号",
    alias: "test"
  });

  assert.equal(page.totalCount, 2);
  assert.equal(page.articles.length, 1);
  assert.equal(page.articles[0].title, "文章一");
  assert.equal(page.articles[0].appmsgid, 1001);
  assert.equal(page.articles[0].itemidx, 1);
});

test("rate limit response raises typed error when retries disabled", async () => {
  const http = new FakeHttpClient(() => ({
    base_resp: { ret: 200013, err_msg: "freq control" }
  }));

  const adapter = new WechatBackendAdapter({
    httpClient: http,
    token: "token-123",
    maxRateLimitRetries: 0
  });

  await assert.rejects(
    () => adapter.searchAccounts("测试"),
    error => error instanceof WechatRateLimitError && error.code === "WECHAT_RATE_LIMITED"
  );
});
