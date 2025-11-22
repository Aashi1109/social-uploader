import { validateOrThrow } from "@/shared/utils/validation";
import { JSONSchemaType } from "ajv";
import { NextFunction, Request, Response } from "express";
import { IPublishRequest } from "./type";

export const createPublishSchema = {
  type: "object",
  required: ["type"],
  properties: {
    mediaUrl: { type: "string", nullable: true },
    title: { type: "string", nullable: true },
    description: { type: "string", nullable: true },
    fileData: { type: "string", nullable: true },
    type: { type: "string", enum: ["video", "image"] },
  },
  anyOf: [{ required: ["mediaUrl"] }, { required: ["fileData"] }],
  additionalProperties: false,
} as JSONSchemaType<IPublishRequest>;

export function validatePublishCreate(
  req: Request,
  res: Response,
  next: NextFunction
) {
  validateOrThrow(createPublishSchema, req.body);
  next();
}
