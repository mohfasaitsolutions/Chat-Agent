"use client";

import { formatListTime, formatPhone, initials } from "@/lib/format";
import type { ConversationWithLast } from "@/lib/types";

export default function ConversationList({
  conversations,
  activeId,
  unread,
  loading,
  onSelect,
}: {
  conversations: ConversationWithLast[];
  activeId: string | null;
  unread: Record<string, number>;
  loading: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <aside className="flex h-full w-full flex-col border-r border-wa-border bg-wa-panel md:w-[340px] lg:w-[380px]">
      <header className="flex items-center justify-between border-b border-wa-border px-4 py-4">
        <div>
          <h1 className="text-base font-semibold">Inbox</h1>
          <p className="text-xs text-wa-muted">
            {conversations.length} conversation
            {conversations.length === 1 ? "" : "s"}
          </p>
        </div>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-wa-green/15 text-wa-green">
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
            <path d="M12 2a10 10 0 0 0-8.7 14.9L2 22l5.3-1.4A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-3.1.8.8-3-.2-.3A8 8 0 1 1 12 20z" />
          </svg>
        </span>
      </header>

      <div className="flex-1 overflow-y-auto">
        {loading && conversations.length === 0 && (
          <p className="px-4 py-6 text-sm text-wa-muted">Loading…</p>
        )}

        {!loading && conversations.length === 0 && (
          <div className="px-4 py-8 text-sm text-wa-muted">
            <p className="mb-1 font-medium text-wa-text">No conversations yet</p>
            <p>
              Send a WhatsApp message to your business number — it will appear
              here as soon as the webhook fires.
            </p>
          </div>
        )}

        <ul>
          {conversations.map((conversation) => {
            const active = conversation.id === activeId;
            const count = unread[conversation.id] ?? 0;
            const last = conversation.last_message;

            return (
              <li key={conversation.id}>
                <button
                  type="button"
                  onClick={() => onSelect(conversation.id)}
                  className={[
                    "flex w-full items-center gap-3 border-b border-wa-border/50 px-4 py-3 text-left transition",
                    active ? "bg-wa-panel2" : "hover:bg-wa-panel2/60",
                  ].join(" ")}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-wa-border text-sm font-semibold text-wa-text">
                    {initials(conversation.name, conversation.phone)}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium">
                        {conversation.name || formatPhone(conversation.phone)}
                      </span>
                      <span className="shrink-0 text-[11px] text-wa-muted">
                        {formatListTime(
                          last?.created_at ?? conversation.updated_at
                        )}
                      </span>
                    </span>

                    <span className="mt-0.5 flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-wa-muted">
                        {last
                          ? `${last.role === "assistant" ? "You: " : ""}${last.content}`
                          : "No messages yet"}
                      </span>

                      <span className="flex shrink-0 items-center gap-1.5">
                        {conversation.mode === "human" && (
                          <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-400">
                            human
                          </span>
                        )}
                        {count > 0 && (
                          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-wa-green px-1.5 text-[11px] font-bold text-black">
                            {count > 99 ? "99+" : count}
                          </span>
                        )}
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
