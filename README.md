# WhatsApp AI Agent

A production-ready WhatsApp AI agent on the official Meta WhatsApp Business API,
built as a single Next.js app. It owns the webhook, generates AI replies, and
ships an operator dashboard for reading every conversation and taking over from
the agent at any time.

## How it works

```
User sends a WhatsApp message
  → Meta POSTs to /api/webhook
  → signature verified, message stored, 200 returned immediately (~15ms)
  → deferred: history → Claude → reply sent via Graph API → reply stored
  → dashboard updates live over Supabase Realtime
```

The AI round-trip runs *after* the response is flushed (Next's `after()`), so
Meta always gets its acknowledgement inside the 5-second window and never
retries a message that is already being handled.

## Setup

### 1. Install

```bash
npm install
cp .env.example .env.local   # already done for you — just fill it in
```

### 2. Database

Apply [`supabase/migrations/0001_create_conversations_and_messages.sql`](supabase/migrations/0001_create_conversations_and_messages.sql)
to your Supabase project — paste it into the SQL editor, run `supabase db push`,
or feed it to the Supabase MCP `apply_migration` tool as
`create_conversations_and_messages`. Verify with `list_tables`.

### 3. Environment

Fill in `.env.local`:

| Variable | Where to find it |
| --- | --- |
| `WHATSAPP_VERIFY_TOKEN` | Any string you invent — must match Meta's webhook config |
| `WHATSAPP_ACCESS_TOKEN` | Business Settings → System users → Generate token (never expires) |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta App → WhatsApp → API Setup |
| `META_APP_SECRET` | Meta App → Settings → Basic. Optional locally, **required in production** |
| `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page. Server-only — never ships to the browser |
| `OPENROUTER_API_KEY` | openrouter.ai → Keys |
| `OPENROUTER_MODEL` | Any slug from openrouter.ai/models (add `:free` for free models) |

### 4. Run

```bash
npm run dev     # http://localhost:3000
```

### 5. Point Meta at the webhook

Expose the app (`ngrok http 3000`, or deploy to Vercel), then in
**Meta App → WhatsApp → Configuration**:

- **Callback URL**: `https://<your-host>/api/webhook`
- **Verify token**: the same value as `WHATSAPP_VERIFY_TOKEN`
- Subscribe to the **`messages`** field.

## Agent and human mode

Every conversation carries a `mode`:

- **`agent`** (default) — inbound messages go to the model and the reply is sent
  automatically.
- **`human`** — inbound messages are stored only; nobody auto-replies. The
  operator answers from the dashboard.

The composer is available in **both** modes, so an operator can interject in an
agent-run chat without flipping it over first.

## API

| Route | Purpose |
| --- | --- |
| `GET /api/webhook` | Meta's verification handshake |
| `POST /api/webhook` | Inbound messages (signature-checked, deduped, deferred processing) |
| `GET /api/conversations` | Sidebar list with last-message previews |
| `GET /api/conversations/[id]/messages` | Full history for one chat |
| `PATCH /api/conversations/[id]` | Switch mode (`{"mode":"agent"\|"human"}`) |
| `POST /api/conversations/[id]/send` | Operator reply (`{"text":"…"}`) |

## Notes on the implementation

- **Duplicate deliveries.** Meta retries. `messages.whatsapp_msg_id` is unique;
  a repeat insert is caught and the message is not answered twice.
- **Schema addition.** `messages.source` (`'ai' | 'human'`, nullable) was added
  beyond the original spec. `role` alone can't tell the two apart, so flipping a
  chat to human mode would retroactively relabel every past AI bubble.
- **Markdown.** WhatsApp uses `*bold*`/`_italic_`, not markdown. `toWhatsAppText()`
  converts what maps cleanly and strips the rest so users never see raw `**`.
- **Long replies.** Bodies over Meta's 4096-character limit are split on
  paragraph/word boundaries into consecutive messages.
- **Non-text messages.** Images, voice notes and documents are recorded as a
  short placeholder (`[the user sent an image]`) so the thread stays coherent.
  Media is not downloaded or transcribed.
- **Upstream AI errors.** OpenRouter reports provider failures (a rate-limited
  free model, for instance) inside a 200 response body rather than as an HTTP
  error, so the reply path checks for that before reading `choices`.

## Security

The dashboard ships **without user authentication** — anyone who can reach the
URL can read every conversation and send messages as your business. Before
exposing it publicly:

1. Add Supabase Auth (or any middleware) in front of `/` and `/api/conversations/*`.
2. In the migration, change the `select` policies from `to anon, authenticated`
   to `to authenticated`.
3. Set `META_APP_SECRET` so unsigned webhook calls are rejected.

Writes always go through the API routes using the service-role key; the browser
only ever holds the anon key, and uses it for Realtime subscriptions.

## Scripts

```bash
npm run dev        # dev server
npm run build      # production build
npm start          # serve the build
npm run typecheck  # tsc --noEmit
```
