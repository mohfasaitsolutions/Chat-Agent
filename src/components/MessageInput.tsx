"use client";

import { useRef, useState } from "react";

/**
 * Composer for operator replies. Present in both modes so a human can
 * interject even while the agent is handling the chat.
 */
export default function MessageInput({
  onSend,
  placeholder,
}: {
  onSend: (text: string) => Promise<void>;
  placeholder: string;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  async function submit() {
    const body = text.trim();
    if (!body || sending) return;

    setSending(true);
    setError(null);
    try {
      await onSend(body);
      setText("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div className="border-t border-wa-border bg-wa-panel2 px-4 py-3">
      {error && (
        <p className="mb-2 text-xs text-red-400">Could not send: {error}</p>
      )}
      <div className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          rows={1}
          value={text}
          disabled={sending}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends; Shift+Enter inserts a newline.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          className="max-h-32 min-h-[42px] flex-1 resize-none rounded-lg bg-wa-panel px-4 py-2.5 text-sm text-wa-text placeholder:text-wa-muted focus:outline-none focus:ring-1 focus:ring-wa-green disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={sending || !text.trim()}
          aria-label="Send message"
          className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-wa-green text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {sending ? (
            <span className="block h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
              <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
