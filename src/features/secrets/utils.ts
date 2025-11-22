import { maskString } from "@/shared/utils";
import { Secret } from "./model";
import { JsonSchema } from "@/shared/types/json";

export const getSafeMaskedSecret = (secret: Secret) => {
  const maskedData: JsonSchema = {};
  const secretData = secret.data as JsonSchema;
  for (const key in secretData) {
    const value = secretData[key];
    maskedData[key] = typeof value === "string" ? maskString(value) : value;
  }

  const maskedSecret = {
    ...secret.toJSON(),
    data: maskedData,
  };
  delete (maskedSecret as any).tokens;

  return maskedSecret;
};
