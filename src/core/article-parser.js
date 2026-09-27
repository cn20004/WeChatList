import * as cheerio from "cheerio";

function textOrEmpty($, selector) {
  return $(selector).first().text().trim();
}

function attrOrEmpty($, selector, attr) {
  return $(selector).first().attr(attr)?.trim() ?? "";
}

function absoluteWechatUrl(value) {
  if (!value) return "";
  if (value.startsWith("//")) return `https:${value}`;
  return value;
}

export function parseWechatArticleHtml(html, sourceUrl = "") {
  const $ = cheerio.load(html);

  const title =
    textOrEmpty($, "#activity-name") ||
    textOrEmpty($, "h1.rich_media_title") ||
    $("title").first().text().trim();

  const author =
    textOrEmpty($, "#js_name") ||
    textOrEmpty($, ".rich_media_meta_text");

  const publishTime =
    textOrEmpty($, "#publish_time") ||
    textOrEmpty($, ".rich_media_meta_text");

  const content = $("#js_content").first();
  const htmlContent = content.length ? content.html() ?? "" : "";

  const images = [];
  content.find("img").each((_, element) => {
    const node = $(element);
    const raw =
      node.attr("data-src") ||
      node.attr("src") ||
      "";
    const url = absoluteWechatUrl(raw.trim());
    if (url && !images.includes(url)) images.push(url);
  });

  const audio = [];
  $("[data-voice_encode_fileid], audio, source").each((_, element) => {
    const node = $(element);
    const candidates = [
      node.attr("src"),
      node.attr("data-src"),
      node.attr("data-voice_encode_fileid")
    ].filter(Boolean);

    for (const candidate of candidates) {
      const value = String(candidate).trim();
      if (value && !audio.includes(value)) audio.push(value);
    }
  });

  const cover =
    absoluteWechatUrl(attrOrEmpty($, 'meta[property="og:image"]', "content")) ||
    absoluteWechatUrl(attrOrEmpty($, 'meta[name="twitter:image"]', "content"));

  const canonicalUrl =
    attrOrEmpty($, 'link[rel="canonical"]', "href") ||
    attrOrEmpty($, 'meta[property="og:url"]', "content") ||
    sourceUrl;

  return {
    title,
    author,
    publishTime,
    sourceUrl: canonicalUrl || sourceUrl,
    cover,
    images,
    audio,
    html: htmlContent,
    text: content.text().replace(/\s+/g, " ").trim()
  };
}
