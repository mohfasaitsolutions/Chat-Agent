import { NextResponse, after } from "next/server";
import { generateReply } from "@/lib/ai";
import {
  findOrCreateConversation,
  getHistory,
  insertMessage,
} from "@/lib/db";
import {
  sendWhatsAppMessage,
  toWhatsAppText,
  verifySignature,
} from "@/lib/whatsapp";

// crypto + the Supabase service key require the Node runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* -------------------------------------------------------------------------- */
/* GET — webhook verification handshake                                        */
/* -------------------------------------------------------------------------- */

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    // Meta requires the raw challenge as plain text, not JSON.
    return new Response(challenge ?? "", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return new Response("Forbidden", { status: 403 });
}

/* -------------------------------------------------------------------------- */
/* POST — inbound messages                                                     */
/* -------------------------------------------------------------------------- */

interface IncomingMessage {
  from: string;
  id: string;
  type: string;
  timestamp?: string;
  text?: { body?: string };
}

interface IncomingContact {
  wa_id: string;
  profile?: { name?: string };
}

export async function POST(req: Request) {
  // The signature is computed over the exact bytes Meta sent, so read the raw
  // body first and parse it ourselves.
  const raw = await req.text();

  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"))) {
    console.warn("[webhook] rejected: bad X-Hub-Signature-256");
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const value = payload?.entry?.[0]?.changes?.[0]?.value;
  const messages: IncomingMessage[] = value?.messages ?? [];
  const contacts: IncomingContact[] = value?.contacts ?? [];

  // Delivery/read receipts arrive on the same hook — acknowledge and ignore.
  if (messages.length === 0) {
    return NextResponse.json({ received: true });
  }

  // Meta retries anything it doesn't see acknowledged within ~5s, so the ack
  // goes out now and the AI round-trip runs after the response is flushed.
  after(async () => {
    for (const message of messages) {
      try {
        await handleMessage(message, contacts);
      } catch (err) {
        console.error("[webhook] failed to handle message", message.id, err);
      }
    }
  });

  return NextResponse.json({ received: true });
}

async function handleMessage(
  message: IncomingMessage,
  contacts: IncomingContact[]
): Promise<void> {
  const phone = message.from;
  const contactName =
    contacts.find((c) => c.wa_id === phone)?.profile?.name ?? null;

  const text = extractText(message);
  const conversation = await findOrCreateConversation(phone, contactName);

  // Dedup: a repeat delivery of an already-stored wamid returns null here and
  // must not trigger a second AI reply.
  const stored = await insertMessage({
    conversationId: conversation.id,
    role: "user",
    content: text,
    whatsappMsgId: message.id,
  });

  if (!stored) {
    console.log("[webhook] duplicate delivery ignored:", message.id);
    return;
  }

  // Human mode: a person answers from the dashboard, so stop after storing.
  if (conversation.mode === "human") {
    console.log("[webhook] human mode, not auto-replying:", conversation.phone);
    return;
  }

  const history = await getHistory(
    conversation.id,
    Number(process.env.AI_HISTORY_LIMIT ?? 20)
  );

  const reply = toWhatsAppText(await generateReply(history, conversation.name));
  const { messageIds } = await sendWhatsAppMessage(phone, reply);

  await insertMessage({
    conversationId: conversation.id,
    role: "assistant",
    content: reply,
    source: "ai",
    whatsappMsgId: messageIds[0] ?? null,
  });
}

/**
 * Flattens the media types the agent can't read into a short text stand-in, so
 * the conversation stays coherent instead of dropping the turn.
 */
function extractText(message: IncomingMessage): string {
  if (message.type === "text" && message.text?.body) {
    return message.text.body;
  }

  const label: Record<string, string> = {
    image: "[the user sent an image]",
    video: "[the user sent a video]",
    audio: "[the user sent a voice note]",
    document: "[the user sent a document]",
    sticker: "[the user sent a sticker]",
    location: "[the user shared a location]",
    contacts: "[the user shared a contact]",
  };

  return label[message.type] ?? `[unsupported message type: ${message.type}]`;
}
