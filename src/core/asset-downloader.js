import fs from "node:fs/promises";
import path from "node:path";

const MIME_EXT = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/gif", ".gif"],
  ["image/webp", ".webp"],
  ["image/svg+xml", ".svg"],
  ["audio/mpeg", ".mp3"],
  ["audio/mp4", ".m4a"],
  ["audio/aac", ".aac"],
  ["audio/wav", ".wav"],
  ["audio/x-wav", ".wav"],
  ["video/mp4", ".mp4"]
]);

function sanitize(value = "file") {
  return value.replace(/[\\/:*?"<>|]+/g, "_").trim() || "file";
}

function extensionFromUrl(url) {
  try {
    const ext = path.extname(new URL(url).pathname);
    if (/^\.[a-z0-9]{1,5}$/i.test(ext)) return ext;
  } catch {}
  return "";
}

function ensureHttpUrl(value) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export class AssetDownloader {
  constructor({ httpClient, baseDir = "data" } = {}) {
    this.http = httpClient;
    this.baseDir = path.resolve(baseDir);
  }

  async download(url, targetDir, basename) {
    const normalized = ensureHttpUrl(url);
    if (!normalized) {
      return { ok: false, url, skipped: true, reason: "not-an-http-url" };
    }

    const response = await this.http.get(normalized, {
      headers: { referer: "https://mp.weixin.qq.com/" }
    });

    const contentType = String(response.headers.get("content-type") || "")
      .split(";")[0]
      .trim()
      .toLowerCase();

    const ext = MIME_EXT.get(contentType) || extensionFromUrl(normalized) || ".bin";
    const filename = `${sanitize(basename)}${ext}`;
    const folder = path.resolve(this.baseDir, targetDir);
    await fs.mkdir(folder, { recursive: true });

    const filePath = path.join(folder, filename);
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(filePath, buffer);

    return {
      ok: true,
      url: normalized,
      filePath,
      filename,
      contentType,
      bytes: buffer.length
    };
  }

  async downloadArticleAssets(article, {
    directory = "articles",
    includeImages = true,
    includeAudio = true,
    includeCover = true
  } = {}) {
    const title = sanitize(article.title || "untitled");
    const root = path.join(directory, title);
    const results = {
      cover: null,
      images: [],
      audio: [],
      music: []
    };

    if (includeCover && article.cover) {
      try {
        results.cover = await this.download(article.cover, path.join(root, "cover"), "cover");
      } catch (error) {
        results.cover = { ok: false, url: article.cover, error: error.message };
      }
    }

    if (includeImages) {
      let i = 1;
      for (const url of article.images || []) {
        try {
          results.images.push(await this.download(
            url,
            path.join(root, "images"),
            String(i++).padStart(3, "0")
          ));
        } catch (error) {
          results.images.push({ ok: false, url, error: error.message });
        }
      }
    }

    if (includeAudio) {
      let i = 1;
      for (const item of article.audio || []) {
        const url = typeof item === "string" ? item : item?.url;
        if (!url) continue;

        try {
          results.audio.push(await this.download(
            url,
            path.join(root, "audio"),
            String(i++).padStart(3, "0")
          ));
        } catch (error) {
          results.audio.push({ ok: false, url, error: error.message });
        }
      }

      let m = 1;
      for (const item of article.music || []) {
        const url = item?.url;
        if (!url) continue;

        try {
          results.music.push(await this.download(
            url,
            path.join(root, "music"),
            String(m++).padStart(3, "0")
          ));
        } catch (error) {
          results.music.push({ ok: false, url, error: error.message });
        }
      }
    }

    return results;
  }
}
