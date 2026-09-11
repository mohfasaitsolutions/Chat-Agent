export type Mode = "agent" | "human";
export type Role = "user" | "assistant";
/** Who produced an outbound message; null for inbound user messages. */
export type Source = "ai" | "human";

export interface Conversation {
  id: string;
  phone: string;
  name: string | null;
  mode: Mode;
  updated_at: string;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: Role;
  content: string;
  source: Source | null;
  whatsapp_msg_id: string | null;
  created_at: string;
}

/** A conversation row decorated with its most recent message, for the sidebar. */
export interface ConversationWithLast extends Conversation {
  last_message: Pick<Message, "content" | "role" | "created_at"> | null;
}
