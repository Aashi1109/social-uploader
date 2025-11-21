import crypto from "node:crypto";
import { v7 as uuidv7 } from "uuid";

export function generateRequestId(): string {
  const randomPart = Math.random().toString(36).slice(2, 10);
  const timePart = Date.now().toString(36);
  return `req_${timePart}${randomPart}`;
}
export const getUUID = () => crypto.randomUUID();

export const getUUIDv7 = () => uuidv7();
