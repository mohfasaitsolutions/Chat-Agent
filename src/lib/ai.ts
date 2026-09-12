import Anthropic from "@anthropic-ai/sdk";
import { optionalEnv, requireEnv } from "./env";
import type { Message } from "./types";

const DEFAULT_SYSTEM_PROMPT =
  "You are a helpful WhatsApp assistant for a business. Keep replies short, " +
  "friendly and conversational — WhatsApp messages should rarely exceed 3 " +
  "sentences. Plain text only: no markdown headings, tables or code fences. " +
  "If you do not know something, say so and offer to connect the customer " +
  "with a person.";

/** Sent to the customer when the model declines to answer. */
const REFUSAL_REPLY =
  "Sorry, I can't help with that one. Let me pass you to a colleague who can.";

function client() {
  return new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY") });
}

/**
 * Generates the assistant's reply from the conversation so far.
 * `history` must be chronological and already include the incoming user
 * message as its last entry.
 */
export async function generateReply(
  history: Pick<Message, "role" | "content">[],
  contactName?: string | null
): Promise<string> {
  const system = optionalEnv("AI_SYSTEM_PROMPT", DEFAULT_SYSTEM_PROMPT);
  const limit = Number(optionalEnv("AI_HISTORY_LIMIT", "20"));
  const recent = history.slice(-Math.max(1, limit));

  // The API requires the first message to come from the user. An operator can
  // send into a chat before the customer replies, so drop any leading
  // assistant turns rather than letting the request 400.
  const firstUser = recent.findIndex((m) => m.role === "user");
  if (firstUser === -1) {
    throw new Error("No user message in history to reply to");
  }

  const messages: Anthropic.Beta.BetaMessageParam[] = recent
    .slice(firstUser)
    .map((m) => ({ role: m.role, content: m.content }));

  const response = await client().beta.messages.create({
    model: optionalEnv("ANTHROPIC_MODEL", "claude-opus-5"),
    // WhatsApp caps a text body at 4096 characters, so replies are
    // deliberately short — this ceiling is well above a normal answer.
    max_tokens: 1024,
    // A customer-service chat is latency-sensitive and not a reasoning task;
    // low effort keeps replies fast and cheap without hurting quality here.
    output_config: { effort: "low" },
    // If a safety classifier declines the request, the API retries it on a
    // fallback model in the same call instead of leaving the customer hanging.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: contactName
      ? `${system}\n\nYou are talking to ${contactName}.`
      : system,
    messages,
  });

  // A refusal is an HTTP 200 with no usable text — check before reading content.
  if (response.stop_reason === "refusal") {
    console.warn(
      "[ai] model declined:",
      response.stop_details?.category ?? "unknown"
    );
    return REFUSAL_REPLY;
  }

  const text = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  if (!text) throw new Error("AI returned an empty response");
  return text;
}
