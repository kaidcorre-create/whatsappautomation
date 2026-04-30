# Free WhatsApp Daily Updates: Cloudflare Worker + GreenAPI

```
Cloudflare Worker (cron) ──▶ GreenAPI ──▶ WhatsApp group
```

No VPS, no server to maintain. GreenAPI's free Developer plan handles the WhatsApp session.

## Free tier limits

- `sendMessage` is **unlimited** even on the free plan
- You can only interact with **3 chats total** (your target group counts as 1, so you're fine)
- 1 instance per account
- The free plan calls itself a "Developer" plan, but it works for personal use indefinitely

## Setup

### 1. Create a GreenAPI account

Sign up at [green-api.com](https://green-api.com). Create a new instance on the **Developer (free)** plan.

You'll get two values from the instance dashboard:
- **idInstance** (e.g. `1101000001`) — this is `GREENAPI_ID`
- **apiTokenInstance** (long string) — this is `GREENAPI_TOKEN`

### 2. Link your WhatsApp number

In the GreenAPI console, scan the QR with WhatsApp on your phone (Settings → Linked Devices → Link a Device).

The instance will show `authorized`. The session persists on GreenAPI's servers, so this is a one-time step.

**Tip:** consider linking a secondary number rather than your primary, to limit ban risk.

### 3. Find your group ID

The number that's linked to GreenAPI must be a member of the target group.

Send any message in the group from the linked phone, then deploy this Worker (next step) and visit:

```
https://your-worker.workers.dev/chats?key=<MANUAL_TRIGGER_KEY>
```

You'll see a list with `chatId` values. Group IDs end in `@g.us` (e.g. `120363012345678901@g.us`). Copy the right one.

Alternatively, GreenAPI's web console has a "Chats" page that lists them.

### 4. Deploy the Worker

```bash
cd whatsapp-greenapi
npm install -g wrangler
wrangler login

wrangler secret put GREENAPI_ID         # from instance dashboard
wrangler secret put GREENAPI_TOKEN      # from instance dashboard
wrangler secret put WHATSAPP_GROUP_ID   # 120363xxx@g.us
wrangler secret put YOUR_API_KEY        # your data API
wrangler secret put MANUAL_TRIGGER_KEY  # any random string

wrangler deploy
```

### 5. Test

```bash
curl "https://whatsapp-daily-update.<your-subdomain>.workers.dev/run?key=<MANUAL_TRIGGER_KEY>"
```

You should see `{"ok": true, "result": {"idMessage": "..."}}` and the message in the group.

## Customising

- **Schedule** — edit `crons` in `wrangler.toml`. Cloudflare crons run on UTC. Examples:
  - `"0 9 * * *"` daily at 09:00 UTC
  - `"30 7 * * 1-5"` weekdays at 07:30 UTC
  - `"0 18 * * 0"` Sundays at 18:00 UTC
- **Data source** — replace `fetchYourData()` in `worker.js`
- **Message format** — edit `formatMessage()`. WhatsApp supports `*bold*`, `_italic_`, `~strike~`, ` ```mono``` `
- **Media** — GreenAPI's `sendFileByUrl` takes the same URL pattern with a `urlFile` field. Drop in if you need images later.

## Reliability notes

- The phone linked to GreenAPI must stay online (or at least come online occasionally) for messages to flow — same as WhatsApp Web
- If WhatsApp logs the device out, you re-scan the QR in GreenAPI's console
- Free plan is fine for daily personal use; only reason to upgrade is if you need >3 chats or higher limits on group-management methods (creating groups, etc.)
- Ban risk is low for low-volume personal use, but never zero — don't link a number you can't afford to lose
