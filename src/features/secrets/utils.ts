import { Secret } from "./model";

export const getSafeSecret = (secret: Secret) => {
  return {
    id: secret.id,
    projectId: secret.projectId,
    type: secret.type,
    version: secret.version,
    dataEncrypted: secret.dataEncrypted,
    meta: secret.meta,
    createdAt: secret.createdAt,
    tokens: secret.tokens,
  };
};
