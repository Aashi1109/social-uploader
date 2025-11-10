import type { JsonSchema } from "@/shared/types/json";
import ajv from "@/shared/ajv";

// Video source: exactly one of url | filePath | data
const VIDEO_SOURCE_ONEOF = {
  oneOf: [
    {
      required: ["url"],
      properties: { url: { type: "string", format: "uri" } },
      not: { anyOf: [{ required: ["filePath"] }, { required: ["data"] }] },
    },
    {
      required: ["filePath"],
      properties: { filePath: { type: "string", minLength: 1 } },
      not: { anyOf: [{ required: ["url"] }, { required: ["data"] }] },
    },
    {
      required: ["data"],
      properties: { data: {} }, // Buffer/Uint8Array are objects at runtime
      not: { anyOf: [{ required: ["url"] }, { required: ["filePath"] }] },
    },
  ],
};

const BASE_COMMON_PROPS: JsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    caption: { type: "string" },
    locationId: { type: "string" },
    userTags: { type: "array", items: { type: "string" } },
    mediaType: { enum: ["CAROUSEL", "REELS"] },
  },
};

const VIDEO_INPUT: JsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    coverUrl: { type: "string", format: "uri" },
    audioName: { type: "string", minLength: 1 },
    thumbOffset: { type: "number" },
    collaborators: { type: "array", items: { type: "string" } },
    resumable: { type: "boolean" },
    url: { type: "string", format: "uri" },
    filePath: { type: "string", minLength: 1 },
    data: {},
  },
  allOf: [VIDEO_SOURCE_ONEOF],
};

const CAROUSEL_CHILD_IMAGE: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["type", "mediaUrl"],
  properties: {
    type: { const: "IMAGE" },
    mediaUrl: { type: "string", format: "uri" },
    altText: { type: "string" },
  },
};

const CAROUSEL_CHILD_VIDEO: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["type", "audioName"], // audioName is required by current types
  properties: {
    type: { const: "VIDEO" },
    ...VIDEO_INPUT.properties,
  },
  allOf: [VIDEO_SOURCE_ONEOF],
};

const CAROUSEL_PARENT_ARGS: JsonSchema = {
  allOf: [
    BASE_COMMON_PROPS,
    {
      type: "object",
      additionalProperties: false,
      required: ["children"],
      properties: {
        children: {
          type: "array",
          minItems: 2,
          maxItems: 10,
          items: { anyOf: [CAROUSEL_CHILD_IMAGE, CAROUSEL_CHILD_VIDEO] },
        },
      },
    },
  ],
};

const REELS_ARGS: JsonSchema = {
  allOf: [BASE_COMMON_PROPS, VIDEO_INPUT],
};

export const INSTAGRAM_PUBLISH_SCHEMA: JsonSchema = {
  $id: "platforms/instagram/publish",
  oneOf: [
    {
      type: "object",
      required: ["mediaType"],
      properties: { mediaType: { const: "CAROUSEL" } },
      allOf: [CAROUSEL_PARENT_ARGS],
    },
    {
      type: "object",
      required: ["mediaType", "audioName"],
      properties: { mediaType: { const: "REELS" } },
      allOf: [REELS_ARGS],
    },
  ],
};

export const validateInstagramPublishArgs = ajv.compile(
  INSTAGRAM_PUBLISH_SCHEMA
);
