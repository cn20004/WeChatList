import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

function safeTitle(value = "article") {
  return value.replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, " ").trim() || "article";
}

function markdownService() {
  const service = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "*",
    strongDelimiter: "**"
  });

  service.use(gfm);
  service.addRule("wechatLineBreak", {
    filter: "br",
    replacement: () => "  \n"
  });

  return service;
}

export function articleToMarkdown(article) {
  const frontmatter = [
    `# ${article.title || "Untitled"}`,
    "",
    article.author ? `- 作者：${article.author}` : "",
    article.publishTime ? `- 发布时间：${article.publishTime}` : "",
    article.sourceUrl ? `- 原文：${article.sourceUrl}` : "",
    ""
  ].filter(Boolean);

  const body = article.html
    ? markdownService().turndown(article.html)
    : String(article.text || "").trim();

  return [...frontmatter, body].join("\n").trim() + "\n";
}

export function articleToHtml(article) {
  const title = article.title || "Untitled";
  const meta = [
    article.author ? `<div>作者：${article.author}</div>` : "",
    article.publishTime ? `<div>发布时间：${article.publishTime}</div>` : "",
    article.sourceUrl ? `<div><a href="${article.sourceUrl}">原文链接</a></div>` : ""
  ].join("");

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <style>
    body{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;max-width:860px;margin:40px auto;padding:0 20px;line-height:1.75}
    img{max-width:100%;height:auto}
    table{border-collapse:collapse;width:100%;overflow:auto}
    th,td{border:1px solid #ddd;padding:8px;vertical-align:top}
    blockquote{border-left:4px solid #ddd;margin-left:0;padding-left:16px;color:#555}
    pre{white-space:pre-wrap;overflow-wrap:anywhere}
    .meta{color:#666;font-size:14px;margin-bottom:24px}
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="meta">${meta}</div>
  <article>${article.html || ""}</article>
</body>
</html>`;
}

export function articleToJson(article) {
  return JSON.stringify(article, null, 2) + "\n";
}

export function getSuggestedFilename(article, format) {
  return `${safeTitle(article.title)}.${format}`;
}

export function exportArticle(article, format = "markdown") {
  const normalized = String(format).toLowerCase();

  if (["md", "markdown"].includes(normalized)) {
    return {
      content: articleToMarkdown(article),
      contentType: "text/markdown; charset=utf-8",
      extension: "md"
    };
  }

  if (["html", "htm"].includes(normalized)) {
    return {
      content: articleToHtml(article),
      contentType: "text/html; charset=utf-8",
      extension: "html"
    };
  }

  if (normalized === "json") {
    return {
      content: articleToJson(article),
      contentType: "application/json; charset=utf-8",
      extension: "json"
    };
  }

  throw new Error(`Unsupported export format: ${format}`);
}
