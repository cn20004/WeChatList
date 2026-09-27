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

function uniquePush(list, value) {
  if (value && !list.includes(value)) list.push(value);
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
    const raw = node.attr("data-src") || node.attr("src") || "";
    uniquePush(images, absoluteWechatUrl(raw.trim()));
  });

  const audio = [];
  const audioFileIds = [];

  $("[data-voice_encode_fileid], [data-audiourl], audio, source").each((_, element) => {
    const node = $(element);

    const urls = [
      node.attr("src"),
      node.attr("data-src"),
      node.attr("data-audiourl"),
      node.attr("data-audio-url")
    ].filter(Boolean);

    for (const value of urls) {
      const normalized = absoluteWechatUrl(String(value).trim());
      if (/^https?:\/\//i.test(normalized)) uniquePush(audio, normalized);
    }

    const fileId = node.attr("data-voice_encode_fileid");
    if (fileId) uniquePush(audioFileIds, String(fileId).trim());
  });

  const music = [];
  $("[data-musicid], [data-mid], mp-common-mpaudio, .js_editor_audio").each((_, element) => {
    const node = $(element);
    const url =
      node.attr("data-audiourl") ||
      node.attr("data-audio-url") ||
      node.attr("data-src") ||
      node.attr("src") ||
      "";

    const id =
      node.attr("data-musicid") ||
      node.attr("data-mid") ||
      node.attr("data-voice_encode_fileid") ||
      "";

    const name =
      node.attr("data-music_name") ||
      node.attr("data-name") ||
      "";

    if (url || id || name) {
      music.push({
        id: String(id || "").trim(),
        name: String(name || "").trim(),
        url: absoluteWechatUrl(String(url || "").trim())
      });
    }
  });

  const cover =
    absoluteWechatUrl(attrOrEmpty($, 'meta[property="og:image"]', "content")) ||
    absoluteWechatUrl(attrOrEmpty($, 'meta[name="twitter:image"]', "content"));

  const canonicalUrl =
    attrOrEmpty($, 'link[rel="canonical"]', "href") ||
    attrOrEmpty($, 'meta[property="og:url"]', "content") ||
    sourceUrl;

  const description =
    attrOrEmpty($, 'meta[name="description"]', "content") ||
    attrOrEmpty($, 'meta[property="og:description"]', "content");

  return {
    title,
    author,
    publishTime,
    description,
    sourceUrl: canonicalUrl || sourceUrl,
    cover,
    images,
    audio,
    audioFileIds,
    music,
    html: htmlContent,
    text: content.text().replace(/\s+/g, " ").trim()
  };
}
