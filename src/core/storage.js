import fs from "node:fs/promises";
import path from "node:path";
import { exportArticle, getSuggestedFilename } from "./exporter.js";
import { exportArticleBinary, exportArticlesXlsx } from "./binary-exporter.js";

function sanitizeSegment(value = "untitled") {
  return value.replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, " ").trim() || "untitled";
}

export class FileStorage {
  constructor({
    baseDir = "data",
    browserExecutablePath = process.env.CHROME_EXECUTABLE_PATH || ""
  } = {}) {
    this.baseDir = path.resolve(baseDir);
    this.browserExecutablePath = browserExecutablePath;
  }

  async saveArticle(article, {
    format = "json",
    directory = "articles",
    filename = ""
  } = {}) {
    const normalized = String(format).toLowerCase();
    const folder = path.join(this.baseDir, sanitizeSegment(directory));
    await fs.mkdir(folder, { recursive: true });

    let exported;

    if (["docx", "word", "pdf", "jpg", "jpeg"].includes(normalized)) {
      exported = await exportArticleBinary(article, normalized, {
        executablePath: this.browserExecutablePath
      });
    } else {
      exported = exportArticle(article, normalized);
    }

    const finalName = filename
      ? `${sanitizeSegment(filename)}.${exported.extension}`
      : getSuggestedFilename(article, exported.extension);

    const filePath = path.join(folder, finalName);
    await fs.writeFile(filePath, exported.content);

    return {
      filePath,
      filename: finalName,
      format: exported.extension,
      contentType: exported.contentType
    };
  }

  async saveArticlesExcel(articles, {
    directory = "articles",
    filename = "articles"
  } = {}) {
    const folder = path.join(this.baseDir, sanitizeSegment(directory));
    await fs.mkdir(folder, { recursive: true });

    const exported = await exportArticlesXlsx(articles);
    const finalName = `${sanitizeSegment(filename)}.${exported.extension}`;
    const filePath = path.join(folder, finalName);
    await fs.writeFile(filePath, exported.content);

    return {
      filePath,
      filename: finalName,
      format: exported.extension,
      contentType: exported.contentType
    };
  }
}
