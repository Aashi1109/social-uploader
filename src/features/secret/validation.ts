import type { ValidateFunction } from "ajv";
import ajv from "@/shared/ajv";
import { getSchema } from "@/shared/secrets/schemas";

import { NextFunction, Request, Response } from "express";
import { PLATFORM_TYPES } from "@/shared/constants";
import { BadRequestError } from "@/exceptions";

/**
 * Generates a validation schema for a specific platform type.
 * The schema validates that type matches and data conforms to the platform's schema.
 */
function generateSchemaForType(platformType: string) {
  const platformSchema = getSchema(platformType);
  if (!platformSchema)
    throw new BadRequestError("No schema found for platform type");

  return {
    $id: `secrets/validate-${platformType}`,
    type: "object",
    required: ["type", "data", "meta"],
    properties: {
      type: {
        type: "string",
        enum: Object.values(PLATFORM_TYPES),
      },
      data: platformSchema,
      projectId: {
        type: ["string", "null"],
      },
      meta: {
        type: "object",
      },
    },
  };
}

/**
 * Cache of compiled validators per platform type.
 */
const validatorCache = new Map<string, ValidateFunction>();

/**
 * Gets or creates a validator for the given platform type.
 */
function getValidator(platformType: string): ValidateFunction | null {
  if (validatorCache.has(platformType)) {
    return validatorCache.get(platformType)!;
  }

  const schema = generateSchemaForType(platformType);
  if (!schema) {
    return null;
  }

  const validator = ajv.compile(schema);
  validatorCache.set(platformType, validator);
  return validator;
}

/**
 * Validates secret data based on its type.
 * Generates the appropriate schema for the type, then validates.
 */
export function validateSecretCreateBody(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const typedData = req.body as { type?: string };
  if (!typedData?.type) {
    return {
      valid: false,
      errors: [{ path: "/type", message: "type is required" }],
    };
  }

  const validator = getValidator(typedData.type);
  if (!validator) {
    return {
      valid: false,
      errors: [
        { path: "/type", message: `Unknown platform type: ${typedData.type}` },
      ],
    };
  }

  const valid = validator(req.body);
  if (!valid) {
    return {
      valid: false,
      errors: (validator.errors || []).map((e) => ({
        path: e.instancePath || e.schemaPath || "",
        message: e.message || "invalid",
      })),
    };
  }

  next();
}
