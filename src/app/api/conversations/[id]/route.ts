import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import type { Conversation } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH /api/conversations/:id — flip a chat between agent and human mode. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const mode = body?.mode;

    if (mode !== "agent" && mode !== "human") {
      return NextResponse.json(
        { error: "mode must be 'agent' or 'human'" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin()
      .from("conversations")
      .update({ mode })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ conversation: data as Conversation });
  } catch (err) {
    console.error("[api/conversations/:id] PATCH failed", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
