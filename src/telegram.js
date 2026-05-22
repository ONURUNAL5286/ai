import { fetchWithRetry } from "./network.js";

export class TelegramBot {
  constructor({ token }) {
    this.token = token;
    this.baseUrl = `https://api.telegram.org/bot${token}`;
    this.offset = 0;
  }

  async getUpdates() {
    const url = new URL(`${this.baseUrl}/getUpdates`);
    url.searchParams.set("timeout", "20");
    url.searchParams.set("offset", String(this.offset));

    const response = await fetchWithRetry(url, {}, 3).catch((error) => {
      throw new Error(
        `Telegram getUpdates network request failed: ${error.message}. ` +
          "Internet, DNS, proxy, VPN veya firewall ayarlarini kontrol et.",
      );
    });
    const payload = await response.json();

    if (!payload.ok) {
      throw new Error(payload.description ?? "Telegram getUpdates failed");
    }

    for (const update of payload.result) {
      this.offset = Math.max(this.offset, update.update_id + 1);
    }

    return payload.result;
  }

  async sendMessage(chatId, text) {
    const response = await fetchWithRetry(`${this.baseUrl}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
    }, 3).catch((error) => {
      throw new Error(
        `Telegram sendMessage network request failed: ${error.message}. ` +
          "Internet, DNS, proxy, VPN veya firewall ayarlarini kontrol et.",
      );
    });

    const payload = await response.json();

    if (!payload.ok) {
      throw new Error(payload.description ?? "Telegram sendMessage failed");
    }

    return payload.result;
  }
}
