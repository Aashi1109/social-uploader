import { JsonSchema } from "@/shared/types/json";
import { camelCase, formatObjectKeys } from "@/shared/utils";
import { google } from "googleapis";

export default class GoogleOAuthService {
  #clientId: string;
  #clientSecret: string;

  constructor(clientId: string, clientSecret: string) {
    if (!clientId) {
      throw new Error("Client ID is required");
    }
    this.#clientId = clientId;
    this.#clientSecret = clientSecret;
  }

  async exchangeAuthCodeForTokens(code: string, redirectUri: string) {
    const oauth2Client = new google.auth.OAuth2(
      this.#clientId,
      this.#clientSecret,
      redirectUri
    );
    const response = await oauth2Client.getToken(code);
    return formatObjectKeys(response.tokens, camelCase);
  }

  buildAuthorizationUri(args: {
    state: string | JsonSchema;
    redirectUri: string;
    scopes: string[];
    prompt?: "consent" | "select_account" | "none";
  }) {
    const oauth2Client = new google.auth.OAuth2(
      this.#clientId,
      this.#clientSecret,
      args.redirectUri
    );
    return oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: args.prompt, // Force consent to ensure refresh token is returned
      scope: args.scopes,
      include_granted_scopes: true,
      state: JSON.stringify(args.state),
    });
  }

  async refreshAccessToken(refreshToken: string, redirectUri: string) {
    const oauth2Client = new google.auth.OAuth2(
      this.#clientId,
      this.#clientSecret,
      redirectUri
    );
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const response = await oauth2Client.getAccessToken();
    return response;
  }

  getOAuthClient() {
    return new google.auth.OAuth2(this.#clientId, this.#clientSecret);
  }
}
