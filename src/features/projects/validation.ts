import { PLATFORM_TYPES } from "@/shared/constants";
import type { JSONSchemaType } from "ajv";
import { NextFunction, Request, Response } from "express";
import { validateOrThrow } from "@/shared/utils/validation";

export interface CreateProjectBody {
  name: string;
  webhookUrl?: string | null;
}

export interface UpdateProjectBody {
  name?: string;
  webhookUrl?: string | null;
}

export interface ProjectIdParams {
  id: string;
}

export interface PlatformConfig {
  mediaProfile?: Record<string, unknown>;
  credsRef?: string;
  mapping?: Record<string, unknown>;
  limits?: Record<string, unknown>;
  maxDurationSeconds?: number;
  minAspectRatio?: number;
  maxAspectRatio?: number;
  maxFileSizeMB?: number;
}

export interface CreatePlatformBody {
  projectId: string;
  name: string;
  type: PLATFORM_TYPES;
  enabled?: boolean;
  secretId: string;
}

export interface UpdatePlatformBody {
  enabled?: boolean;
  config?: PlatformConfig;
}

export interface PlatformIdParams {
  id: string;
}

export interface ProjectIdQuery {
  projectId?: string;
}

export const createProjectSchema: JSONSchemaType<CreateProjectBody> = {
  type: "object",
  required: ["name"],
  properties: {
    name: { type: "string", minLength: 1 },
    webhookUrl: { type: "string", format: "uri", nullable: true },
  },
  additionalProperties: false,
};

export const updateProjectSchema: JSONSchemaType<UpdateProjectBody> = {
  type: "object",
  properties: {
    name: { type: "string", minLength: 1, nullable: true },
    webhookUrl: { type: "string", format: "uri", nullable: true },
  },
  additionalProperties: false,
};

export const projectIdParamSchema: JSONSchemaType<ProjectIdParams> = {
  type: "object",
  required: ["id"],
  properties: {
    id: { type: "string", minLength: 1 },
  },
  additionalProperties: false,
};

export const platformConfigSchema: JSONSchemaType<PlatformConfig> = {
  type: "object",
  properties: {
    mediaProfile: { type: "object", nullable: true },
    credsRef: { type: "string", nullable: true },
    mapping: { type: "object", nullable: true },
    limits: { type: "object", nullable: true },
    maxDurationSeconds: { type: "integer", minimum: 1, nullable: true },
    minAspectRatio: { type: "number", exclusiveMinimum: 0, nullable: true },
    maxAspectRatio: { type: "number", exclusiveMinimum: 0, nullable: true },
    maxFileSizeMB: { type: "integer", minimum: 1, nullable: true },
  },
  additionalProperties: true,
};

export const createPlatformSchema: JSONSchemaType<CreatePlatformBody> = {
  type: "object",
  required: ["projectId", "name", "type", "secretId"],
  properties: {
    projectId: { type: "string", minLength: 1 },
    name: {
      type: "string",
      nullable: false,
    },
    enabled: { type: "boolean", nullable: true, default: false },
    secretId: { type: "string", format: "uuid" },
    type: {
      type: "string",
      enum: Object.values(PLATFORM_TYPES),
      nullable: false,
    },
  },
  additionalProperties: false,
};

export const updatePlatformSchema: JSONSchemaType<UpdatePlatformBody> = {
  type: "object",
  properties: {
    enabled: { type: "boolean", nullable: true },
    config: { ...platformConfigSchema, nullable: true },
  },
  additionalProperties: false,
};

export const platformIdParamSchema: JSONSchemaType<PlatformIdParams> = {
  type: "object",
  required: ["id"],
  properties: {
    id: { type: "string", minLength: 1 },
  },
  additionalProperties: false,
};

export const projectIdQuerySchema: JSONSchemaType<ProjectIdQuery> = {
  type: "object",
  properties: {
    projectId: { type: "string", minLength: 1, nullable: true },
  },
  additionalProperties: false,
};

export function validateCreateProjectBody(
  req: Request,
  res: Response,
  next: NextFunction
) {
  validateOrThrow(createProjectSchema, req.body);
  next();
}

export function validateUpdateProjectBody(
  req: Request,
  res: Response,
  next: NextFunction
) {
  validateOrThrow(updateProjectSchema, req.body);
  next();
}

export function validateProjectIdParams(
  req: Request,
  res: Response,
  next: NextFunction
) {
  validateOrThrow(projectIdParamSchema, req.params);
  next();
}

export function validateCreatePlatformBody(
  req: Request,
  res: Response,
  next: NextFunction
) {
  validateOrThrow(createPlatformSchema, req.body);
  next();
}

export function validateUpdatePlatformBody(
  req: Request,
  res: Response,
  next: NextFunction
) {
  validateOrThrow(updatePlatformSchema, req.body);
  next();
}

export function validatePlatformIdParams(
  req: Request,
  res: Response,
  next: NextFunction
) {
  validateOrThrow(platformIdParamSchema, req.params);
  next();
}

export function validateProjectIdQuery(
  req: Request,
  res: Response,
  next: NextFunction
) {
  validateOrThrow(projectIdQuerySchema, req.query);
  next();
}
