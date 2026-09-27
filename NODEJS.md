# WeChatList Node.js Rewrite

This branch is the beginning of a clean-room Node.js rewrite.

## Important

The original repository currently contains documentation/web pages, but not the
source code of the downloadable desktop application. Therefore this rewrite does
not claim to be a line-by-line conversion of the EXE.

The project is intentionally split into reusable layers so it can later be
embedded in another Node.js/Next.js/Express application.

## Architecture

```
src/
├── adapters/
│   └── wechat-backend-adapter.js
├── api/
│   └── router.js
├── core/
│   ├── article-parser.js
│   ├── collector.js
│   └── http-client.js
├── index.js
└── server.js
```

## Install

```bash
npm install
npm test
npm start
```

Node.js 20+ is required.

## Standalone API

Health check:

```
GET /api/wechat/health
```

Parse a public WeChat article:

```
POST /api/wechat/articles/parse
Content-Type: application/json

{
  "url": "https://mp.weixin.qq.com/s/..."
}
```

## Embed in another Express project

```js
import express from "express";
import { createWechatRouter, WechatCollector } from "wechat-list-node";

const app = express();
app.use(express.json());

const collector = new WechatCollector();
app.use("/api/wechat", createWechatRouter({ collector }));
```

## Use only as a Node.js library

```js
import { WechatCollector } from "wechat-list-node";

const collector = new WechatCollector();
const article = await collector.parseArticle(
  "https://mp.weixin.qq.com/s/..."
);

console.log(article.title);
```

## Next implementation stage

The authenticated backend adapter still needs verified implementation for:

1. WeChat backend sign-in/session handling.
2. Official-account search and account identifier lookup.
3. Paginated historical article listing.
4. Rate limiting, session expiry handling and retry policy.
5. Asset download and local/object-storage persistence.
6. Markdown/HTML/PDF/DOCX/Excel exporters.

Those endpoints should be implemented only after verifying the actual network
requests used by the desktop application or by an authenticated WeChat backend
session. Real cookies/tokens must never be committed to this repository.


## Batch parse URLs

```
POST /api/wechat/articles/batch
Content-Type: application/json

{
  "urls": [
    "https://mp.weixin.qq.com/s/...",
    "https://mp.weixin.qq.com/s/..."
  ],
  "concurrency": 3
}
```

The batch endpoint preserves input order and returns per-URL success/failure
results, so one failed article does not abort the whole batch.

## Export an article

Supported in the current stage:

- Markdown
- HTML
- JSON

```
POST /api/wechat/articles/export
Content-Type: application/json

{
  "format": "markdown",
  "article": {
    "title": "Example",
    "text": "Article body",
    "images": []
  }
}
```

## Save to disk

```
POST /api/wechat/articles/save
Content-Type: application/json

{
  "format": "json",
  "directory": "articles",
  "article": {
    "title": "Example",
    "text": "Article body"
  }
}
```

Files are written beneath the configured storage base directory. The default is
`./data`, which is ignored by Git.

## Current status

Working now without the original EXE source:

- Fetch a public `mp.weixin.qq.com` article URL.
- Parse title, author, publish time, text, article HTML, cover and image links.
- Batch-process article URLs with bounded concurrency.
- Export article data as Markdown, HTML or JSON.
- Save exported files to local storage.
- Mount the module inside another Express application.

Still pending verified authenticated WeChat backend access:

- Search arbitrary Official Accounts.
- Resolve account identifiers such as `fakeid`.
- Enumerate all historical articles by account.
