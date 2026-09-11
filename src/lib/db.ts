import { supabaseAdmin } from "./supabase";
import type { Conversation, Message, Role, Source } from "./types";

/** Postgres unique-violation — used to detect a duplicate webhook delivery. */
const UNIQUE_VIOLATION = "23505";

/**
 * Looks up the conversation for a phone number, creating it on first contact.
 * Refreshes the contact's display name when Meta sends a newer one.
 */
export async function findOrCreateConversation(
  phone: string,
  name?: string | null
): Promise<Conversation> {
  const db = supabaseAdmin();

  const { data: existing, error: selectError } = await db
    .from("conversations")
    .select("*")
    .eq("phone", phone)
    .maybeSingle();

  if (selectError) throw selectError;

  if (existing) {
    const conversation = existing as Conversation;
    if (name && name !== conversation.name) {
      const { data: updated } = await db
        .from("conversations")
        .update({ name })
        .eq("id", conversation.id)
        .select()
        .single();
      return (updated as Conversation) ?? conversation;
    }
    return conversation;
  }

  const { data: created, error: insertError } = await db
    .from("conversations")
    .insert({ phone, name: name ?? null })
    .select()
    .single();

  // Two webhook deliveries can race on first contact; the unique index on
  // `phone` decides the winner and the loser re-reads the row.
  if (insertError) {
    if (insertError.code === UNIQUE_VIOLATION) {
      const { data: raced } = await db
        .from("conversations")
        .select("*")
        .eq("phone", phone)
        .single();
      return raced as Conversation;
    }
    throw insertError;
  }

  return created as Conversation;
}

/**
 * Stores a message. Returns null when `whatsappMsgId` has already been stored,
 * which is how repeat deliveries from Meta are ignored.
 */
export async function insertMessage(params: {
  conversationId: string;
  role: Role;
  content: string;
  source?: Source | null;
  whatsappMsgId?: string | null;
}): Promise<Message | null> {
  const db = supabaseAdmin();

  const { data, error } = await db
    .from("messages")
    .insert({
      conversation_id: params.conversationId,
      role: params.role,
      content: params.content,
      source: params.source ?? null,
      whatsapp_msg_id: params.whatsappMsgId ?? null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) return null;
    throw error;
  }

  await touchConversation(params.conversationId);
  return data as Message;
}

/** Bumps updated_at so the sidebar re-sorts to put this chat on top. */
export async function touchConversation(conversationId: string): Promise<void> {
  await supabaseAdmin()
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);
}

/** Most recent `limit` messages, returned oldest-first for the model. */
export async function getHistory(
  conversationId: string,
  limit = 20
): Promise<Pick<Message, "role" | "content">[]> {
  const { data, error } = await supabaseAdmin()
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return ((data ?? []) as Pick<Message, "role" | "content">[]).reverse();
}
