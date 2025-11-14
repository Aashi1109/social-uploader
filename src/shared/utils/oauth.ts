import crypto from "node:crypto";

export function generateNonce(bytes: number = 16): string {
  return crypto.randomBytes(bytes).toString("hex");
}

export function base64urlEncode(obj: unknown): string {
  const json = JSON.stringify(obj);
  return Buffer.from(json)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function base64urlDecode<T = any>(val: string): T {
  const pad = (s: string) => s + "===".slice((s.length + 3) % 4);
  const b64 = pad(val).replace(/-/g, "+").replace(/_/g, "/");
  const json = Buffer.from(b64, "base64").toString("utf8");
  return JSON.parse(json) as T;
}
