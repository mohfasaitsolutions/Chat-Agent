"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ChatPanel from "./ChatPanel";
import ConversationList from "./ConversationList";
import { supabaseBrowser } from "@/lib/supabase-browser";
import type {
  Conversation,
  ConversationWithLast,
  Message,
  Mode,
} from "@/lib/types";

export default function Dashboard() {
  const [conversations, setConversations] = useState<ConversationWithLast[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [loadingList, setLoadingList] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [savingMode, setSavingMode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Realtime callbacks are registered once but need the current selection, so
  // read it from a ref instead of resubscribing on every change.
  const activeIdRef = useRef<string | null>(null);
  activeIdRef.current = activeId;

  const active = conversations.find((c) => c.id === activeId) ?? null;

  /* ----------------------------- data loading ---------------------------- */

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Failed to load chats");
      setConversations(body.conversations as ConversationWithLast[]);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingList(false);
    }
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    setLoadingChat(true);
    try {
      const res = await fetch(
        `/api/conversations/${conversationId}/messages`,
        { cache: "no-store" }
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Failed to load messages");
      setMessages(body.messages as Message[]);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingChat(false);
    }
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    void loadMessages(activeId);
    setUnread((prev) => ({ ...prev, [activeId]: 0 }));
  }, [activeId, loadMessages]);

  /* ------------------------------- realtime ------------------------------ */

  useEffect(() => {
    const supabase = supabaseBrowser();

    const channel = supabase
      .channel("dashboard")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const message = payload.new as unknown as Message;

          if (message.conversation_id === activeIdRef.current) {
            // The sender already appended its own message optimistically.
            setMessages((prev) =>
              prev.some((m) => m.id === message.id) ? prev : [...prev, message]
            );
          } else if (message.role === "user") {
            setUnread((prev) => ({
              ...prev,
              [message.conversation_id]:
                (prev[message.conversation_id] ?? 0) + 1,
            }));
          }

          // Refresh previews and re-sort the sidebar.
          void loadConversations();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => {
          void loadConversations();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadConversations]);

  /* -------------------------------- actions ------------------------------ */

  async function handleModeChange(mode: Mode) {
    if (!active) return;
    const previous = active.mode;
    const id = active.id;

    // Optimistic — the toggle should feel instant.
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, mode } : c))
    );
    setSavingMode(true);

    try {
      const res = await fetch(`/api/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Failed to change mode");
      setError(null);
    } catch (err) {
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, mode: previous } : c))
      );
      setError((err as Error).message);
    } finally {
      setSavingMode(false);
    }
  }

  async function handleSend(text: string) {
    if (!active) return;

    const res = await fetch(`/api/conversations/${active.id}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error ?? "Failed to send");

    if (body.message) {
      const sent = body.message as Message;
      setMessages((prev) =>
        prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]
      );
    }
    void loadConversations();
  }

  /* --------------------------------- view -------------------------------- */

  return (
    <main className="flex h-screen w-full overflow-hidden">
      <div
        className={[
          "h-full w-full md:block md:w-auto",
          activeId ? "hidden" : "block",
        ].join(" ")}
      >
        <ConversationList
          conversations={conversations}
          activeId={activeId}
          unread={unread}
          loading={loadingList}
          onSelect={setActiveId}
        />
      </div>

      <div
        className={[
          "h-full flex-1 md:flex",
          activeId ? "flex" : "hidden",
        ].join(" ")}
      >
        <ChatPanel
          conversation={active as Conversation | null}
          messages={messages}
          loading={loadingChat}
          savingMode={savingMode}
          onModeChange={handleModeChange}
          onSend={handleSend}
          onBack={() => setActiveId(null)}
        />
      </div>

      {error && (
        <p
          role="alert"
          className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-red-500/90 px-4 py-2 text-sm text-white shadow-lg"
        >
          {error}
        </p>
      )}
    </main>
  );
}
