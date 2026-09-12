import OpenAI from "openai";
import { optionalEnv, requireEnv } from "./env";
import type { Message } from "./types";

const DEFAULT_SYSTEM_PROMPT =
  "You are a helpful WhatsApp assistant for a business. Keep replies short, " +
  "friendly and conversational — WhatsApp messages should rarely exceed 3 " +
  "sentences. Plain text only: no markdown headings, tables or code fences. " +
  "If you do not know something, say so and offer to connect the customer " +
  "with a person.";

/** OpenRouter speaks the OpenAI wire format, so the OpenAI SDK works as-is. */
function client() {
  return new OpenAI({
    apiKey: requireEnv("OPENROUTER_API_KEY"),
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": optionalEnv("OPENROUTER_SITE_URL", "http://localhost:3000"),
      "X-Title": optionalEnv("OPENROUTER_SITE_NAME", "WhatsApp AI Agent"),
    },
  });
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

  const completion = await client().chat.completions.create({
    model: optionalEnv("OPENROUTER_MODEL", "anthropic/claude-sonnet-5"),
    max_tokens: 1024,
    messages: [
      {
        role: "system",
        content: contactName
          ? `${system}\n\nYou are talking to ${contactName}.`
          : system,
      },
      ...recent.map((m) => ({ role: m.role, content: m.content })),
    ],
  });

  // OpenRouter surfaces upstream provider failures in the body, not as an
  // HTTP error — a free model that is rate-limited comes back with no choices.
  const failure = (completion as { error?: { message?: string } }).error;
  if (failure) {
    throw new Error(`OpenRouter: ${failure.message ?? "upstream error"}`);
  }

  const reply = completion.choices?.[0]?.message?.content?.trim();
  if (!reply) throw new Error("AI returned an empty response");
  return reply;
}
