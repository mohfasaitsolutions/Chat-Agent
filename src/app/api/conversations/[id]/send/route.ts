import { NextResponse } from "next/server";
import { insertMessage } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import type { Conversation } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/conversations/:id/send — a human operator replies from the
 * dashboard. Available in both modes so an operator can interject mid-agent.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const text = typeof body?.text === "string" ? body.text.trim() : "";

    if (!text) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    const { data: conversation, error } = await supabaseAdmin()
      .from("conversations")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!conversation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { phone } = conversation as Conversation;

    // Send first: if Meta rejects it, nothing is written and the operator sees
    // the real error instead of a message that only exists in our database.
    const { messageIds } = await sendWhatsAppMessage(phone, text);

    const message = await insertMessage({
      conversationId: id,
      role: "assistant",
      content: text,
      source: "human",
      whatsappMsgId: messageIds[0] ?? null,
    });

    return NextResponse.json({ message });
  } catch (err) {
    console.error("[api/conversations/:id/send] POST failed", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
