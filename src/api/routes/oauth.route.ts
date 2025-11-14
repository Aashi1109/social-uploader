import { Router } from "express";
import { asyncHandler, bearerAuth } from "@/api/middleware";
import prisma from "@/prisma";
import config from "@/config";
import { BadRequestError, NotFoundError } from "@/exceptions";
import { secrets } from "@/core/secrets";

import {
  validateYouTubeOAuthInit,
  YouTubeOAuthInitInput,
} from "@/features/platforms/youtube/validation";
import {
  base64urlEncode,
  base64urlDecode,
  generateNonce,
} from "@/shared/utils/oauth";
import { validateOrThrow } from "@/shared/utils/validation";
import {
  SECRET_PROVISION_STATUS,
  OAUTH_PROVIDERS,
  OAUTH_STATE_KIND,
} from "@/shared/constants";
import crypto from "node:crypto";
import YouTubeService from "@/features/platforms/youtube/service";
import { jnparse } from "@/shared/utils";
import { getPendingSecretCache } from "@/features/secret/helpers";
import { secretsService } from "../services";
import { JsonObject } from "@/shared/types/json";
import { GoogleOAuthService } from "@/features/oauth";
import { YouTubeSecret } from "@/shared/secrets/schemas";

const router = Router();

// router.post("/oauth/youtube/init", bearerAuth, async (req, res) => {
//   const payload: unknown = req.body || {};
//   const body = validateOrThrow<YouTubeOAuthInitInput>(
//     validateYouTubeOAuthInit as any,
//     payload,
//     "youtube_oauth_init"
//   );

//   const {
//     scope: scopeStr,
//     clientId,
//     clientSecret,
//     channelId: rawChannelId,
//   } = body;
//   const channelId: string | undefined = rawChannelId
//     ? String(rawChannelId)
//     : undefined;

//   const requestId =
//     (req.headers?.["x-request-id"] as string) || crypto.randomUUID();
//   const redirectUri =
//     config.platforms.youtube.redirectUri ||
//     "https://your-api.example.com/v1/oauth/youtube/callback";

//   const configuredScopes =
//     config.platforms.youtube.requiredScopes ||
//     "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly";
//   const normalizedScopes = configuredScopes
//     .split(/[,\s]+/)
//     .filter(Boolean)
//     .join(" ");

//   // Create pending secret with encrypted partial data
//   const nonce = generateNonce(16);
//   const partialData = { clientId, clientSecret, channelId };
//   const data_encrypted = secrets.encrypt(partialData);
//   const meta: any = {
//     provider: OAUTH_PROVIDERS.youtube,
//     status: SECRET_PROVISION_STATUS.pending,
//     state: {
//       kind: OAUTH_STATE_KIND.secretProvision,
//       nonce,
//     },
//     redirectUri,
//     scopes: normalizedScopes,
//     requestId,
//     createdAt: new Date().toISOString(),
//     scope: scopeStr,
//   };

//   const created = await prisma.secret.create({
//     data: {
//       scope: scopeStr,
//       type: "youtube",
//       data_encrypted,
//       meta,
//     } as any,
//     select: { id: true },
//   });

//   const state = base64urlEncode({
//     kind: OAUTH_STATE_KIND.secretProvision,
//     sid: created.id,
//     nonce,
//     requestId,
//   });
//   const authorization_uri = buildYouTubeAuthorizationUri({
//     clientId,
//     redirectUri,
//     scope: normalizedScopes,
//     state,
//   });

//   return res.status(201).json({
//     authorization_uri,
//     secretId: created.id,
//     requestId,
//     infoMessage:
//       "Open authorization_uri to grant access. On success, your secret will be marked as completed.",
//   });
// });

router.get(
  "/youtube/callback",
  asyncHandler(async (req, res) => {
    const code = String((req.query?.code as string) || "");
    const stateParam = jnparse((req.query?.state as string) || "");
    if (!code || !stateParam) {
      throw new BadRequestError("invalid_callback_params");
    }
    const requestId = stateParam.requestId;
    if (!requestId) throw new BadRequestError("Request ID is required");

    const secretData = await getPendingSecretCache(requestId);
    if (!secretData) throw new BadRequestError("Secret Data not found");
    const decodedData: any = secrets.decrypt(secretData as string);
    const { clientId, clientSecret } = decodedData.data as YouTubeSecret;
    const googleOAuthService = new GoogleOAuthService(clientId, clientSecret);
    const tokens = await googleOAuthService.exchangeAuthCodeForTokens(
      code,
      config.platforms.youtube.redirectUri || ""
    );

    const secret = await secretsService.createSecret({
      ...decodedData,
      tokens,
    } as any);
    return res.status(201).json(secret);
  })
);

export default router;
