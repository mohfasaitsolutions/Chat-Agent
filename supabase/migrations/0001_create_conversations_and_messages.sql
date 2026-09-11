-- WhatsApp AI Agent :: initial schema
-- Apply via Supabase SQL editor, `supabase db push`, or the Supabase MCP
-- `apply_migration` tool (name: create_conversations_and_messages).

create table if not exists conversations (
  id uuid default gen_random_uuid() primary key,
  phone text unique not null,
  name text,
  mode text not null default 'agent' check (mode in ('agent', 'human')),
  updated_at timestamp with time zone default now(),
  created_at timestamp with time zone default now()
);

create table if not exists messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references conversations(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  -- Which side produced an outbound message. `role` alone cannot answer this:
  -- once a chat is flipped to human mode, every past assistant bubble would
  -- otherwise be relabelled. Null for inbound user messages.
  source text check (source in ('ai', 'human')),
  whatsapp_msg_id text unique,
  created_at timestamp with time zone default now()
);

create index if not exists idx_messages_conversation on messages(conversation_id);
create index if not exists idx_conversations_updated on conversations(updated_at desc);

-- Realtime: the dashboard subscribes to INSERT/UPDATE on both tables.
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table conversations;

-- Row Level Security.
--   * Every WRITE goes through this app's API routes, which use the
--     service-role key and therefore bypass RLS entirely.
--   * The browser holds only the anon key. Supabase Realtime enforces RLS on
--     broadcast, so anon needs SELECT for live updates to arrive.
--
-- NOTE: this dashboard ships without user auth, so these policies make the
-- conversation history readable by anyone holding the anon key. Before putting
-- this on a public URL, add Supabase Auth and replace `to anon` with
-- `to authenticated` (see README > Security).
alter table conversations enable row level security;
alter table messages enable row level security;

drop policy if exists "dashboard can read conversations" on conversations;
create policy "dashboard can read conversations"
  on conversations for select
  to anon, authenticated
  using (true);

drop policy if exists "dashboard can read messages" on messages;
create policy "dashboard can read messages"
  on messages for select
  to anon, authenticated
  using (true);
