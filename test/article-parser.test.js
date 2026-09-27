import test from "node:test";
import assert from "node:assert/strict";
import { parseWechatArticleHtml } from "../src/core/article-parser.js";

test("parses basic WeChat article fields", () => {
  const html = `
    <html>
      <head>
        <meta property="og:image" content="https://example.com/cover.jpg">
      </head>
      <body>
        <h1 id="activity-name">Example title</h1>
        <span id="js_name">Example author</span>
        <em id="publish_time">2026-09-27</em>
        <div id="js_content">
          <p>Hello WeChat</p>
          <img data-src="//example.com/a.jpg">
        </div>
      </body>
    </html>
  `;

  const result = parseWechatArticleHtml(html, "https://mp.weixin.qq.com/s/example");

  assert.equal(result.title, "Example title");
  assert.equal(result.author, "Example author");
  assert.equal(result.publishTime, "2026-09-27");
  assert.equal(result.text, "Hello WeChat");
  assert.deepEqual(result.images, ["https://example.com/a.jpg"]);
  assert.equal(result.cover, "https://example.com/cover.jpg");
});
