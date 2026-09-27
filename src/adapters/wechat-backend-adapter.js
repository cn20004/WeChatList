/**
 * Adapter boundary for authenticated WeChat Official Account backend access.
 *
 * The original repository does not contain the desktop application's source code,
 * so the exact authenticated endpoints and parameters must be verified from the
 * actual application/network traffic before implementation.
 */
export class WechatBackendAdapter {
  async searchAccount(_keyword) {
    throw new Error("searchAccount adapter is not implemented yet");
  }

  async listArticles(_account, _options = {}) {
    throw new Error("listArticles adapter is not implemented yet");
  }
}
