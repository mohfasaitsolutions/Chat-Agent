import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import type { Conversation, Message } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/conversations/:id/messages — full history, oldest first. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = supabaseAdmin();

    const { data: conversation, error: conversationError } = await db
      .from("conversations")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (conversationError) throw conversationError;
    if (!conversation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { data: messages, error: messagesError } = await db
      .from("messages")
      .select("*")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });

    if (messagesError) throw messagesError;

    return NextResponse.json({
      conversation: conversation as Conversation,
      messages: (messages ?? []) as Message[],
    });
  } catch (err) {
    console.error("[api/conversations/:id/messages] GET failed", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
