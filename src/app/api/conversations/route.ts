import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import type { Conversation, ConversationWithLast, Message } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/conversations — sidebar list, newest activity first. */
export async function GET() {
  try {
    const db = supabaseAdmin();

    const { data: conversations, error } = await db
      .from("conversations")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(200);

    if (error) throw error;

    const rows = (conversations ?? []) as Conversation[];
    if (rows.length === 0) return NextResponse.json({ conversations: [] });

    // One query for the previews, then pick the newest per conversation —
    // cheaper than N round-trips for N chats.
    const { data: recent, error: messagesError } = await db
      .from("messages")
      .select("conversation_id, content, role, created_at")
      .in(
        "conversation_id",
        rows.map((c) => c.id)
      )
      .order("created_at", { ascending: false })
      .limit(1000);

    if (messagesError) throw messagesError;

    const lastByConversation = new Map<string, Message>();
    for (const message of (recent ?? []) as Message[]) {
      if (!lastByConversation.has(message.conversation_id)) {
        lastByConversation.set(message.conversation_id, message);
      }
    }

    const result: ConversationWithLast[] = rows.map((c) => {
      const last = lastByConversation.get(c.id);
      return {
        ...c,
        last_message: last
          ? { content: last.content, role: last.role, created_at: last.created_at }
          : null,
      };
    });

    return NextResponse.json({ conversations: result });
  } catch (err) {
    console.error("[api/conversations] GET failed", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
