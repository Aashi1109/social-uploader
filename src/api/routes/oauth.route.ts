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
    const { requestId, isRefresh, secretId } = stateParam;
    if (!requestId) throw new BadRequestError("Request ID is required");
    const isRefreshSecret = isRefresh && secretId;
    let decodedData: any;
    if (isRefreshSecret) {
      const secret = await secretsService.getById(secretId);
      decodedData = { data: secret.data };
    } else {
      const secretData = await getPendingSecretCache(requestId);
      if (!secretData) throw new BadRequestError("Secret Data not found");
      decodedData = secretsService.decrypt(secretData as string);
    }
    const { clientId, clientSecret } = decodedData.data as YouTubeSecret;
    const googleOAuthService = new GoogleOAuthService(clientId, clientSecret);
    const tokens = await googleOAuthService.exchangeAuthCodeForTokens(
      code,
      config.platforms.youtube.redirectUri || ""
    );

    let data: any;
    if (isRefreshSecret) {
      const secret = await secretsService.update(secretId, {
        tokens,
      });
      data = {
        version: secret.version,
        id: secret.id,
        message: "Secret updated successfully",
      };
    } else {
      const secret = await secretsService.create({
        ...decodedData,
        tokens,
      });
      await deletePendingSecretCache(requestId);
      data = {
        version: secret.version,
        id: secret.id,
        message: "Secret created successfully",
      };
    }

    return res.status(201).json(data);
  })
);

export default router;
