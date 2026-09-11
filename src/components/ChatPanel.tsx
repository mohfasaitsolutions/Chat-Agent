"use client";

import { useEffect, useRef } from "react";
import MessageInput from "./MessageInput";
import ModeToggle from "./ModeToggle";
import { formatPhone, formatTime, initials } from "@/lib/format";
import type { Conversation, Message, Mode } from "@/lib/types";

export default function ChatPanel({
  conversation,
  messages,
  loading,
  savingMode,
  onModeChange,
  onSend,
  onBack,
}: {
  conversation: Conversation | null;
  messages: Message[];
  loading: boolean;
  savingMode: boolean;
  onModeChange: (mode: Mode) => void;
  onSend: (text: string) => Promise<void>;
  onBack: () => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Follow the conversation as it grows, and jump to the end on switch.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, conversation?.id]);

  if (!conversation) {
    return (
      <section className="hidden flex-1 flex-col items-center justify-center bg-wa-bg px-8 text-center md:flex">
        <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-wa-panel2 text-wa-green">
          <svg viewBox="0 0 24 24" className="h-10 w-10 fill-current">
            <path d="M12 2a10 10 0 0 0-8.7 14.9L2 22l5.3-1.4A10 10 0 1 0 12 2z" />
          </svg>
        </div>
        <h2 className="text-lg font-medium">Select a conversation</h2>
        <p className="mt-1 max-w-sm text-sm text-wa-muted">
          Pick a chat on the left to read the history, switch between agent and
          human mode, or reply yourself.
        </p>
      </section>
    );
  }

  const isHuman = conversation.mode === "human";

  return (
    <section className="flex h-full flex-1 flex-col bg-wa-bg">
      <header className="flex items-center gap-3 border-b border-wa-border bg-wa-panel2 px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to conversations"
          className="-ml-1 rounded p-1 text-wa-muted hover:text-wa-text md:hidden"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
            <path d="M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20z" />
          </svg>
        </button>

        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-wa-border text-sm font-semibold">
          {initials(conversation.name, conversation.phone)}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {conversation.name || formatPhone(conversation.phone)}
          </p>
          <p className="truncate text-xs text-wa-muted">
            {formatPhone(conversation.phone)}
            {" · "}
            <span className={isHuman ? "text-amber-400" : "text-wa-green"}>
              {isHuman ? "human is replying" : "AI is replying"}
            </span>
          </p>
        </div>

        <ModeToggle
          mode={conversation.mode}
          disabled={savingMode}
          onChange={onModeChange}
        />
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 md:px-8">
        {loading && messages.length === 0 && (
          <p className="text-center text-sm text-wa-muted">Loading messages…</p>
        )}

        {!loading && messages.length === 0 && (
          <p className="text-center text-sm text-wa-muted">
            No messages in this conversation yet.
          </p>
        )}

        <ul className="mx-auto flex max-w-3xl flex-col gap-2">
          {messages.map((message) => {
            const outbound = message.role === "assistant";
            return (
              <li
                key={message.id}
                className={outbound ? "self-end" : "self-start"}
              >
                <div
                  className={[
                    "max-w-[78vw] rounded-lg px-3 py-2 text-sm shadow-sm md:max-w-md lg:max-w-lg",
                    outbound
                      ? "rounded-br-sm bg-wa-bubbleOut"
                      : "rounded-bl-sm bg-wa-bubbleIn",
                  ].join(" ")}
                >
                  <p className="whitespace-pre-wrap break-words">
                    {message.content}
                  </p>
                  <p className="mt-1 text-right text-[10px] text-wa-text/50">
                    {outbound && (
                      <span className="mr-1 uppercase tracking-wide">
                        {message.source === "human" ? "you" : "ai"}
                      </span>
                    )}
                    {formatTime(message.created_at)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>

        <div ref={bottomRef} />
      </div>

      <MessageInput
        onSend={onSend}
        placeholder={
          isHuman
            ? "Type a reply…"
            : "Agent mode — type here to send a manual message"
        }
      />
    </section>
  );
}
