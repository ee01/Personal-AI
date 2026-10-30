import { createHash } from "node:crypto";

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function contentHash(body: string, source: string, eventId: string): string {
  return sha256Hex(`${body}\0${source}\0${eventId}`);
}
