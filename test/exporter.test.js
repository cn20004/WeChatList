import test from "node:test";
import assert from "node:assert/strict";
import { articleToMarkdown, exportArticle, getSuggestedFilename } from "../src/core/exporter.js";

const article = {
  title: "测试/文章",
  author: "郑老师",
  publishTime: "2026-09-27",
  sourceUrl: "https://mp.weixin.qq.com/s/example",
  text: "正文内容",
  html: "<p>正文内容</p>",
  images: ["https://example.com/a.jpg"]
};

test("exports markdown", () => {
  const md = articleToMarkdown(article);
  assert.match(md, /# 测试\/文章/);
  assert.match(md, /正文内容/);
  assert.match(md, /https:\/\/example.com\/a.jpg/);
});

test("returns JSON export metadata", () => {
  const result = exportArticle(article, "json");
  assert.equal(result.extension, "json");
  assert.match(result.contentType, /application\/json/);
});

test("sanitizes suggested filename", () => {
  assert.equal(getSuggestedFilename(article, "md"), "测试_文章.md");
});
