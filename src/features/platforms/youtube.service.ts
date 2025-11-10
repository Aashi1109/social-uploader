import type { JsonObject } from "@/shared/types/json";
import type { YouTubeSecret } from "@/shared/secrets/schemas";
import { BasePlatformService } from "@/shared/interfaces";

export type VendorVerifyResult = {
  ok: boolean;
  details?: JsonObject;
};

class YouTubeService implements BasePlatformService {
  async verify(data: YouTubeSecret & JsonObject): Promise<VendorVerifyResult> {
    try {
      const clientId = String(data.clientId || "");
      const clientSecret = String(data.clientSecret || "");
      const refreshToken = String(data.refreshToken || "");
      const channelId = data.channelId ? String(data.channelId) : undefined;

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }),
      });
      if (!tokenRes.ok) {
        return {
          ok: false,
          details: { stage: "token_http", status: tokenRes.status },
        };
      }
      const tokenBody: any = await tokenRes.json();
      const accessToken: string | undefined = tokenBody?.access_token;
      if (!accessToken) {
        return { ok: false, details: { stage: "token_body" } };
      }

      if (channelId) {
        const chUrl = new URL("https://www.googleapis.com/youtube/v3/channels");
        chUrl.searchParams.set("part", "id");
        chUrl.searchParams.set("id", channelId);
        const chRes = await fetch(chUrl, {
          method: "GET",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!chRes.ok) {
          return {
            ok: false,
            details: { stage: "channels_http", status: chRes.status },
          };
        }
        const chBody: any = await chRes.json();
        if (!Array.isArray(chBody?.items) || chBody.items.length === 0) {
          return { ok: false, details: { stage: "channels_body" } };
        }
      }

      return {
        ok: true,
        details: { token: "ok", channelChecked: !!channelId },
      };
    } catch {
      return { ok: false, details: { stage: "exception" } };
    }
  }
}

export default new YouTubeService();
