import { Router } from "express";
import { asyncHandler } from "@/api/middleware";
import config from "@/config";
import { BadRequestError } from "@/shared/exceptions";

import { jnparse } from "@/shared/utils";
import {
  deletePendingSecretCache,
  getPendingSecretCache,
} from "@/features/secrets/helpers";
import { GoogleOAuthService } from "@/features/oauth";
import { YouTubeSecret } from "@/shared/secrets/schemas";
import { SecretsService } from "@/features";

const router = Router();
const secretsService = new SecretsService();

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
    const decodedData: any = secretsService.decrypt(secretData as string);
    const { clientId, clientSecret } = decodedData.data as YouTubeSecret;
    const googleOAuthService = new GoogleOAuthService(clientId, clientSecret);
    const tokens = await googleOAuthService.exchangeAuthCodeForTokens(
      code,
      config.platforms.youtube.redirectUri || ""
    );

    const secret = await secretsService.create({
      ...decodedData,
      tokens,
    });

    await deletePendingSecretCache(requestId);

    return res.status(201).json({ data: secret });
  })
);

export default router;
