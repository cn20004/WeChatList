import test from "node:test";
import assert from "node:assert/strict";
import { parseWechatArticleHtml } from "../src/core/article-parser.js";
import { filterArticles } from "../src/core/filter.js";
import { articleToDocx, articlesToXlsx } from "../src/core/binary-exporter.js";

test("resolves WeChat voice file IDs to downloadable URLs", () => {
  const html = `
    <html><body>
      <h1 id="activity-name">Audio article</h1>
      <div id="js_content">
        <mpvoice voice_encode_fileid="abc123" name="音频一"></mpvoice>
      </div>
    </body></html>
  `;

  const article = parseWechatArticleHtml(html, "https://mp.weixin.qq.com/s/audio");
  assert.deepEqual(article.audioFileIds, ["abc123"]);
  assert.ok(article.audio.includes("https://res.wx.qq.com/voice/getvoice?mediaid=abc123"));
});

test("filters articles by keyword and date range", () => {
  const input = [
    { title: "AI 新闻", digest: "大模型", createTime: 1760000000 },
    { title: "旅游", digest: "杭州", createTime: 1600000000 }
  ];

  const result = filterArticles(input, {
    keyword: "AI",
    from: "2025-01-01"
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].title, "AI 新闻");
});

test("generates DOCX buffer", async () => {
  const buffer = await articleToDocx({
    title: "测试文章",
    text: "正文内容",
    sourceUrl: "https://mp.weixin.qq.com/s/test"
  });

  assert.ok(Buffer.isBuffer(buffer));
  assert.ok(buffer.length > 100);
});

test("generates XLSX buffer", async () => {
  const buffer = await articlesToXlsx([
    {
      title: "测试文章",
      accountName: "测试号",
      author: "作者",
      sourceUrl: "https://mp.weixin.qq.com/s/test",
      text: "正文"
    }
  ]);

  assert.ok(Buffer.isBuffer(buffer));
  assert.ok(buffer.length > 100);
});
