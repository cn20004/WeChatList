import { escape } from "node:querystring";

function safeTitle(value = "article") {
  return value.replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, " ").trim() || "article";
}

export function articleToMarkdown(article) {
  const lines = [
    `# ${article.title || "Untitled"}`,
    "",
    article.author ? `- 作者：${article.author}` : "",
    article.publishTime ? `- 发布时间：${article.publishTime}` : "",
    article.sourceUrl ? `- 原文：${article.sourceUrl}` : "",
    "",
    article.text || ""
  ].filter(Boolean);

  if (article.images?.length) {
    lines.push("", "## 图片", "");
    for (const url of article.images) {
      lines.push(`![](${url})`, "");
    }
  }

  return lines.join("\n").trim() + "\n";
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
