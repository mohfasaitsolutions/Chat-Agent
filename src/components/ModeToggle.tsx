"use client";

import type { Mode } from "@/lib/types";

/**
 * Per-conversation switch between the AI answering automatically and a human
 * taking over. Optimistic: the parent rolls back if the PATCH fails.
 */
export default function ModeToggle({
  mode,
  disabled,
  onChange,
}: {
  mode: Mode;
  disabled?: boolean;
  onChange: (mode: Mode) => void;
}) {
  return (
    <div
      className="flex items-center gap-1 rounded-full bg-wa-bg p-1"
      role="group"
      aria-label="Reply mode"
    >
      {(["agent", "human"] as const).map((value) => {
        const active = mode === value;
        const activeClasses =
          value === "agent"
            ? "bg-wa-green text-black"
            : "bg-amber-500 text-black";

        return (
          <button
            key={value}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => !active && onChange(value)}
            className={[
              "rounded-full px-3 py-1 text-xs font-semibold capitalize transition",
              "disabled:cursor-not-allowed disabled:opacity-60",
              active
                ? activeClasses
                : "text-wa-muted hover:text-wa-text",
            ].join(" ")}
          >
            {value}
          </button>
        );
      })}
    </div>
  );
}
