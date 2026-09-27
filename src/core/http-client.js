export class HttpClient {
  constructor({ timeoutMs = 30000, userAgent = "Mozilla/5.0", cookie = "" } = {}) {
    this.timeoutMs = timeoutMs;
    this.userAgent = userAgent;
    this.cookie = cookie;
  }

  async get(url, { headers = {} } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "user-agent": this.userAgent,
          ...(this.cookie ? { cookie: this.cookie } : {}),
          ...headers
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} while requesting ${url}`);
      }

      return response;
    } finally {
      clearTimeout(timer);
    }
  }

  async getText(url, options) {
    return (await this.get(url, options)).text();
  }
}
