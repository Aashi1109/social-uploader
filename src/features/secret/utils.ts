import { Secret } from "@/prisma/generated";

const getSafeSecret = (secret: Secret) => {
  return {
    id: secret.id,
    projectId: secret.projectId,
    type: secret.type,
    version: secret.version,
    data_encrypted: secret.data_encrypted,
    meta: secret.meta,
    createdAt: secret.createdAt,
    tokens: secret.tokens,
  };
};
