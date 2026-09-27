import { Document, Packer, Paragraph, HeadingLevel, ExternalHyperlink, TextRun } from "docx";
import ExcelJS from "exceljs";
import { chromium } from "playwright-core";
import { articleToHtml } from "./exporter.js";

function asBuffer(value) {
  return Buffer.isBuffer(value) ? value : Buffer.from(value);
}

export async function articleToDocx(article) {
  const children = [
    new Paragraph({ text: article.title || "Untitled", heading: HeadingLevel.TITLE }),
    ...(article.author ? [new Paragraph({ text: `作者：${article.author}` })] : []),
    ...(article.publishTime ? [new Paragraph({ text: `发布时间：${article.publishTime}` })] : []),
    ...(article.sourceUrl ? [
      new Paragraph({
        children: [
          new ExternalHyperlink({
            link: article.sourceUrl,
            children: [new TextRun({ text: "原文链接", style: "Hyperlink" })]
          })
        ]
      })
    ] : []),
    new Paragraph(""),
    ...String(article.text || "")
      .split(/\n+/)
      .filter(Boolean)
      .map(text => new Paragraph({ text }))
  ];

  if (article.images?.length) {
    children.push(new Paragraph({ text: "图片链接", heading: HeadingLevel.HEADING_2 }));
    for (const url of article.images) {
      children.push(new Paragraph({ text: url }));
    }
  }

  const doc = new Document({ sections: [{ children }] });
  return asBuffer(await Packer.toBuffer(doc));
}

export async function articlesToXlsx(articles) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("文章");

  sheet.columns = [
    { header: "标题", key: "title", width: 40 },
    { header: "公众号", key: "accountName", width: 24 },
    { header: "作者", key: "author", width: 20 },
    { header: "发布时间", key: "publishTime", width: 22 },
    { header: "摘要", key: "digest", width: 50 },
    { header: "原文链接", key: "sourceUrl", width: 70 },
    { header: "图片数", key: "imageCount", width: 10 },
    { header: "音频数", key: "audioCount", width: 10 },
    { header: "正文", key: "text", width: 80 }
  ];

  for (const article of articles) {
    sheet.addRow({
      title: article.title ?? "",
      accountName: article.accountName ?? "",
      author: article.author ?? "",
      publishTime: article.publishTime ?? article.createTime ?? "",
      digest: article.digest ?? "",
      sourceUrl: article.sourceUrl ?? article.link ?? "",
      imageCount: article.images?.length ?? 0,
      audioCount: article.audio?.length ?? 0,
      text: article.text ?? ""
    });
  }

  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  return asBuffer(await workbook.xlsx.writeBuffer());
}

async function withBrowser({ executablePath }, callback) {
  if (!executablePath) {
    throw new Error(
      "PDF/JPG export requires Chrome/Edge. Set CHROME_EXECUTABLE_PATH to the browser executable."
    );
  }

  const browser = await chromium.launch({
    executablePath,
    headless: true
  });

  try {
    return await callback(browser);
  } finally {
    await browser.close();
  }
}

export async function articleToPdf(article, options = {}) {
  return withBrowser(options, async browser => {
    const page = await browser.newPage();
    await page.setContent(articleToHtml(article), { waitUntil: "load" });
    return page.pdf({
      format: options.pageFormat || "A4",
      printBackground: true,
      margin: { top: "15mm", right: "12mm", bottom: "15mm", left: "12mm" }
    });
  });
}

export async function articleToJpeg(article, options = {}) {
  return withBrowser(options, async browser => {
    const page = await browser.newPage({
      viewport: { width: Number(options.width || 1200), height: 900 }
    });
    await page.setContent(articleToHtml(article), { waitUntil: "load" });
    return page.screenshot({
      type: "jpeg",
      quality: Number(options.quality || 90),
      fullPage: true
    });
  });
}

export async function exportArticleBinary(article, format, options = {}) {
  const normalized = String(format).toLowerCase();

  if (["docx", "word"].includes(normalized)) {
    return {
      content: await articleToDocx(article),
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      extension: "docx"
    };
  }

  if (normalized === "pdf") {
    return {
      content: await articleToPdf(article, options),
      contentType: "application/pdf",
      extension: "pdf"
    };
  }

  if (["jpg", "jpeg"].includes(normalized)) {
    return {
      content: await articleToJpeg(article, options),
      contentType: "image/jpeg",
      extension: "jpg"
    };
  }

  throw new Error(`Unsupported binary export format: ${format}`);
}

export async function exportArticlesXlsx(articles) {
  return {
    content: await articlesToXlsx(articles),
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    extension: "xlsx"
  };
}
