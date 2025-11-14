import crypto from "node:crypto";

export function generateRequestId(): string {
  const randomPart = Math.random().toString(36).slice(2, 10);
  const timePart = Date.now().toString(36);
  return `req_${timePart}${randomPart}`;
}
export const getUUID = () => crypto.randomUUID();
