import crypto from "node:crypto";
import { optionalEnv, requireEnv } from "./env";

/** Meta rejects text bodies longer than this. */
const MAX_BODY = 4096;

export interface SendResult {
  /** Meta's wamid for each chunk that was sent, in order. */
  messageIds: string[];
}

/**
 * WhatsApp has its own lightweight markup and does NOT understand markdown.
 * LLMs emit markdown by habit, so translate what maps cleanly and strip the
 * rest — otherwise users see literal `**asterisks**` and `### hashes`.
 */
export function toWhatsAppText(input: string): string {
  return input
    .replace(/```[a-zA-Z]*\n?/g, "")           // fenced code delimiters
    .replace(/\*\*\*(.+?)\*\*\*/gs, "*_$1_*")  // bold+italic
    .replace(/\*\*(.+?)\*\*/gs, "*$1*")        // bold  -> *bold*
    .replace(/(^|[\s(])_(?!_)(.+?)_(?=[\s.,!?)]|$)/gs, "$1_$2_") // italic is already _x_
    .replace(/^\s{0,3}#{1,6}\s+(.*)$/gm, "*$1*") // headings -> bold line
    .replace(/^\s{0,3}[-*+]\s+/gm, "• ")        // bullets
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1: $2") // links
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Splits on paragraph/word boundaries so long answers arrive readable. */
export function chunkText(text: string, limit = MAX_BODY): string[] {
  if (text.length <= limit) return [text];
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > limit) {
    const window = rest.slice(0, limit);
    // Prefer breaking at a blank line, then a newline, then a space.
    const cut = Math.max(
      window.lastIndexOf("\n\n"),
      window.lastIndexOf("\n"),
      window.lastIndexOf(" ")
    );
    const at = cut > limit * 0.5 ? cut : limit;
    chunks.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

/**
 * Sends a text message through the Meta Graph API, splitting bodies that
 * exceed Meta's 4096-character limit into consecutive messages.
 */
export async function sendWhatsAppMessage(
  to: string,
  body: string
): Promise<SendResult> {
  const version = optionalEnv("WHATSAPP_API_VERSION", "v22.0");
  const phoneNumberId = requireEnv("WHATSAPP_PHONE_NUMBER_ID");
  const token = requireEnv("WHATSAPP_ACCESS_TOKEN");
  const url = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;

  const messageIds: string[] = [];

  for (const chunk of chunkText(body)) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: false, body: chunk },
      }),
    });

    const payload = await res.json().catch(() => ({}));

    if (!res.ok) {
      const detail =
        payload?.error?.message ?? `${res.status} ${res.statusText}`;
      throw new Error(`WhatsApp send failed: ${detail}`);
    }

    const id = payload?.messages?.[0]?.id;
    if (id) messageIds.push(id);
  }

  return { messageIds };
}

/**
 * Verifies Meta's X-Hub-Signature-256 header against the raw request body.
 * Returns true when META_APP_SECRET is unset so local/ngrok testing still
 * works, but production should always set it.
 */
export function verifySignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.META_APP_SECRET;
  if (!secret) return true;
  if (!header?.startsWith("sha256=")) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");
  const received = header.slice("sha256=".length);

  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(received, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
