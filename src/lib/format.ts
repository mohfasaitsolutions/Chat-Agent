/** "14:32" — the timestamp shown under each bubble. */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Sidebar stamp: time today, "Yesterday", weekday this week, else a date. */
export function formatListTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();
  const days = Math.floor((startOfToday - date.getTime()) / 86_400_000);

  if (date.getTime() >= startOfToday) return formatTime(iso);
  if (days < 1) return "Yesterday";
  if (days < 6) return date.toLocaleDateString([], { weekday: "short" });
  return date.toLocaleDateString([], { day: "2-digit", month: "2-digit" });
}

/** "+91 98765 43210" from a bare wa_id. */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return `+${digits}`;
  const local = digits.slice(-10);
  const country = digits.slice(0, -10);
  return `+${country} ${local.slice(0, 5)} ${local.slice(5)}`.trim();
}

/** Two-letter avatar initials from a contact name, falling back to digits. */
export function initials(name: string | null, phone: string): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
  }
  return phone.slice(-2);
}
