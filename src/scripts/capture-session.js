import { chromium } from "playwright-core";
import { SessionStore } from "../core/session-store.js";

const executablePath = process.env.CHROME_EXECUTABLE_PATH || "";
if (!executablePath) {
  console.error("Set CHROME_EXECUTABLE_PATH to Chrome or Edge executable first.");
  process.exit(1);
}

const browser = await chromium.launch({
  executablePath,
  headless: false
});

try {
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("Opening mp.weixin.qq.com. Complete the normal QR-code login in the browser window.");
  await page.goto("https://mp.weixin.qq.com/", { waitUntil: "domcontentloaded" });

  const deadline = Date.now() + 5 * 60 * 1000;
  let token = "";

  while (Date.now() < deadline) {
    const url = new URL(page.url());
    token = url.searchParams.get("token") || "";

    if (token && /mp\.weixin\.qq\.com$/i.test(url.hostname)) {
      break;
    }

    await page.waitForTimeout(1000);
  }

  if (!token) {
    throw new Error("Login token was not detected within 5 minutes.");
  }

  const cookies = await context.cookies("https://mp.weixin.qq.com/");
  const cookie = cookies
    .map(item => `${item.name}=${item.value}`)
    .join("; ");

  if (!cookie) {
    throw new Error("No authenticated WeChat cookies were captured.");
  }

  const store = new SessionStore();
  const saved = await store.save({ cookie, token });

  console.log(`Session saved locally at ${store.filePath}`);
  console.log(`Saved at: ${saved.savedAt}`);
  console.log("Restart npm start to use the captured session.");
} finally {
  await browser.close();
}
