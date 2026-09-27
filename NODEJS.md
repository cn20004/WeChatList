# WeChatList Node.js Rewrite

这是 WeChatList 的 Node.js 可复用版本。它既可以独立运行成 Web 应用，也可以作为模块嵌入其它 Node.js / Express / Next.js 项目。

> 原仓库没有桌面 EXE 的源码，所以这是 clean-room 重写，不是对 EXE 的逐行翻译。

## 当前功能

| 功能 | 状态 |
|---|---|
| 公众号搜索 | 已实现，需要本人微信公众号后台会话 |
| 获取 fakeid | 已实现 |
| 全部历史文章分页 | 已实现，0 表示不限数量 |
| 关键词筛选 | 已实现 |
| 日期范围筛选 | 已实现 |
| 单篇/批量文章抓取 | 已实现 |
| 标题/作者/时间/正文解析 | 已实现 |
| 封面下载 | 已实现 |
| 正文图片下载 | 已实现 |
| 公众号音频下载 | 已实现，支持 voice_encode_fileid 转下载 URL |
| 音乐/背景音乐 URL 资源 | 已解析；存在直接 URL 时可下载 |
| JSON 导出 | 已实现 |
| Markdown 导出 | 已实现 |
| HTML 导出 | 已实现 |
| Word / DOCX 导出 | 已实现 |
| Excel / XLSX 汇总 | 已实现 |
| PDF 导出 | 已实现，需要本机 Chrome/Edge |
| JPG 长图导出 | 已实现，需要本机 Chrome/Edge |
| ZIP 打包 | 已实现 |
| 自定义保存目录 | 已实现 |
| 自定义单篇文件名 | API 已实现 |
| 本机扫码登录获取 Cookie/token | 已实现：`npm run auth` |
| 可嵌入其它 Node.js 项目 | 已实现 |
| HTTP API | 已实现 |
| Web 管理页 | 已实现 |
| CI 自动测试 | 已配置 |

## 安装

```bash
git checkout nodejs-rewrite
npm install
npm test
npm start
```

需要 Node.js 20+。

## 本机扫码登录

先配置浏览器路径：

Windows Chrome 示例：

```text
CHROME_EXECUTABLE_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
```

Edge 也可以。

然后运行：

```bash
npm run auth
```

程序会打开真实的微信公众号后台登录页。你正常扫码登录后，会把当前会话保存到：

```text
data/session.json
```

这个文件已位于 Git 忽略目录，不应该提交到仓库。

启动服务时优先级是：

```text
WECHAT_COOKIE / WECHAT_TOKEN 环境变量
        ↓
data/session.json
```

## Web 页面

启动：

```bash
npm start
```

打开：

```text
http://localhost:3000
```

页面提供两种模式：

1. 按公众号名称搜索，分页获取历史文章。
2. 直接粘贴一批 `mp.weixin.qq.com/s/...` 链接。

公众号模式支持：

- 0 = 获取全部历史文章
- 关键词筛选
- 起止日期筛选
- JSON / Markdown / HTML / Word / Excel / PDF / JPG
- 图片、封面、音频、音乐资源下载
- 每篇文章 ZIP 打包

## 主要 API

### 健康状态

```
GET /api/wechat/health
```

### 搜公众号

```
POST /api/wechat/accounts/search
```

```json
{
  "keyword": "机器之心"
}
```

### 获取历史文章

```
POST /api/wechat/accounts/articles
```

```json
{
  "account": {
    "fakeid": "..."
  },
  "limit": 0,
  "count": 20,
  "maxPages": 0
}
```

`limit: 0` 与 `maxPages: 0` 都表示不限。

### 一步完成公众号采集

```
POST /api/wechat/accounts/collect
```

```json
{
  "keyword": "机器之心",
  "list": {
    "limit": 0,
    "maxPages": 0,
    "count": 20
  },
  "filter": {
    "keyword": "人工智能",
    "from": "2025-01-01",
    "to": "2026-12-31T23:59:59"
  },
  "collect": {
    "save": true,
    "formats": ["json", "markdown", "html", "docx", "xlsx", "pdf", "jpg"],
    "directory": "accounts",
    "assets": true,
    "zip": true
  }
}
```

### 批量 URL

```
POST /api/wechat/articles/collect
```

### 资源下载

```
POST /api/wechat/articles/assets
```

### 单篇完整包

```
POST /api/wechat/articles/package
```

### 直接导出

```
POST /api/wechat/articles/export
```

支持：

- json
- markdown
- html
- docx
- pdf
- jpg

### Excel 汇总

```
POST /api/wechat/articles/excel
```

## 嵌入其它 Node.js 项目

```js
import express from "express";
import {
  WechatCollector,
  createWechatRouter
} from "wechat-list-node";

const app = express();
app.use(express.json());

const collector = new WechatCollector();
app.use("/api/wechat", createWechatRouter({ collector }));
```

也可以只使用核心模块：

```js
import { WechatCollector } from "wechat-list-node";

const collector = new WechatCollector();

const article = await collector.parseArticle(
  "https://mp.weixin.qq.com/s/..."
);

await collector.packageArticle(article, {
  formats: ["json", "markdown", "html", "docx", "pdf", "jpg"],
  assets: true,
  zip: true
});
```

## 文件结构

```
src/
├── adapters/
│   └── wechat-backend-adapter.js
├── api/
│   └── router.js
├── core/
│   ├── article-parser.js
│   ├── asset-downloader.js
│   ├── binary-exporter.js
│   ├── bundle.js
│   ├── collector.js
│   ├── exporter.js
│   ├── filter.js
│   ├── http-client.js
│   ├── session-store.js
│   └── storage.js
├── scripts/
│   └── capture-session.js
├── web/
│   └── index.html
├── index.js
└── server.js
```

## 需要注意

微信公众号后台使用的是非公开后台接口，登录态可能过期，也可能触发频控。程序已经实现：

- 请求间隔
- 串行历史分页
- 频控识别
- 冷却后重试
- 登录失效错误类型

但是无法保证微信未来不会修改后台接口。

PDF/JPG 依赖本机 Chrome 或 Edge，是为了尽量保持 HTML 排版，而不是简单把纯文本硬画成图片。
