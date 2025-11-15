import type { ErrorObject, JSONSchemaType } from "ajv";
import type { ValidateFunction } from "ajv";
import ajv from "@/shared/ajv";
import { BadRequestError } from "@/exceptions";

export function ajvErrorsToIssues(errors: ErrorObject[] | null | undefined) {
  if (!errors) return [];
  return errors.map((e) => ({
    path: e.instancePath || e.schemaPath || "",
    message: e.message || "invalid",
  }));
}

/**
 * Validate data against an AJV validator or raw schema.
 * Throws BadRequestError("invalid_schema") with formatted issues on failure.
 */
export function validateOrThrow<T>(
  validatorOrSchema: ValidateFunction | JSONSchemaType<any> | any,
  data: any,
  _name?: string,
): T {
  let validate: ValidateFunction;
  if (typeof validatorOrSchema === "function") {
    validate = validatorOrSchema as ValidateFunction;
  } else {
    validate = ajv.compile(validatorOrSchema);
  }
  const valid = validate(data);
  if (!valid) {
    throw new BadRequestError("Validation Error", {
      errors: ajvErrorsToIssues((validate as any).errors),
    });
  }
  return data as T;
}
