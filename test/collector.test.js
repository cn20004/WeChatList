import test from "node:test";
import assert from "node:assert/strict";
import { WechatCollector } from "../src/core/collector.js";

class FakeHttpClient {
  async getText(url) {
    if (url.includes("fail")) throw new Error("synthetic failure");
    return `
      <html><body>
        <h1 id="activity-name">Title for ${url}</h1>
        <div id="js_content"><p>Hello</p></div>
      </body></html>
    `;
  }
}

test("batch parsing keeps order and isolates failures", async () => {
  const collector = new WechatCollector({ httpClient: new FakeHttpClient() });

  const urls = [
    "https://mp.weixin.qq.com/s/one",
    "https://mp.weixin.qq.com/s/fail",
    "https://mp.weixin.qq.com/s/two"
  ];

  const results = await collector.parseArticles(urls, { concurrency: 2 });

  assert.equal(results.length, 3);
  assert.equal(results[0].ok, true);
  assert.equal(results[1].ok, false);
  assert.equal(results[2].ok, true);
  assert.equal(results[2].url, urls[2]);
});
