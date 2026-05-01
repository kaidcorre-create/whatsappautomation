/**
 * Daily WhatsApp group update via GreenAPI's free Developer plan.
 *
 * Architecture:
 *   Cloudflare Worker (cron)  ──▶  GreenAPI  ──▶  WhatsApp group
 *
 * No VPS needed. GreenAPI holds the WhatsApp session for you.
 *
 * Free Developer plan limits to be aware of:
 *   - sendMessage: unlimited
 *   - You can only interact with 3 chats (a group counts as 1)
 *   - 1 instance per account
 */

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(sendDailyUpdate(env));
  },

  // Manual trigger: GET /run?key=<MANUAL_TRIGGER_KEY>
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/run' && url.searchParams.get('key') === env.MANUAL_TRIGGER_KEY) {
      const result = await sendDailyUpdate(env);
      return Response.json(result);
    }

    // Helper to find your group ID — visit /chats?key=... once during setup
    if (url.pathname === '/chats' && url.searchParams.get('key') === env.MANUAL_TRIGGER_KEY) {
      const chats = await listChats(env);
      return Response.json(chats);
    }

    return new Response('OK');
  },
};

async function sendDailyUpdate(env) {
  try {
    const data = await fetchYourData(env);
    const message = formatMessage(data);
    const result = await sendToWhatsApp(message, env);
    return { ok: true, result };
  } catch (err) {
    console.error('Daily update failed:', err);
    return { ok: false, error: err.message };
  }
}

// --- 1. Fetch from Google Sheets web app ---
async function fetchYourData(env) {
  const res = await fetch(env.SHEETS_WEB_APP_URL);
  if (!res.ok) throw new Error(`Sheets ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (data.error) throw new Error(`Sheets error: ${data.error}`);
  return data;
}

// --- 2. Format the message ---
function formatMessage(data) {
  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const foodLines = Object.entries(data.food ?? {})
    .map(([pref, count]) => `  • ${pref}: ${count}`)
    .join('\n');

  return [
    `*OnebyOne Info - ${today}*`,
    '',
    `*Arrivals`
     '',  
    `*Friday 10am - 7pm:* ${data.arrivals.fridayone}`,
     '', 
    `*Friday 8pm onwards:* ${data.arrivals.fridaytwo}`,
     '',
    `*Saturday:* ${data.arrivals.saturday}`,
     '',  
    `*Ssunday:* ${data.arrivals.sunday}`,
     '', 
    '', 
    `*Baptisms*`,
    `  Confirmed: ${data.baptism.confirmed}`,
    `  Waiting list: ${data.baptism.waiting}`,
    '',
    `*Endowments*`,
    `  Confirmed: ${data.endowment.confirmed}`,
    `  Waiting list: ${data.endowment.waiting}`,
    '',
    `*Missions*`,
    `  Preparing papers: ${data.mission.preparing}`,
    `  Papers in: ${data.mission.papersIn}`,
    `  Call received: ${data.mission.call}`,

    '',
    `*Food Preferences*`,
    foodLines || '  No data',
  ].join('\n');
}

// --- 3. Send via GreenAPI ---
async function sendToWhatsApp(message, env) {
  const url = `https://api.green-api.com/waInstance${env.GREENAPI_ID}/sendMessage/${env.GREENAPI_TOKEN}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chatId: env.WHATSAPP_GROUP_ID, // e.g. "120363012345678901@g.us"
      message,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`greenapi ${res.status}: ${JSON.stringify(body)}`);
  return body; // { idMessage: "..." }
}

// --- Setup helper: list recent chats so you can find your group ID ---
async function listChats(env) {
  const url = `https://api.green-api.com/waInstance${env.GREENAPI_ID}/lastIncomingMessages/${env.GREENAPI_TOKEN}`;
  const res = await fetch(url);
  const body = await res.json();
  // Pull unique chatIds + names
  const seen = new Map();
  for (const m of body) {
    if (!seen.has(m.chatId)) seen.set(m.chatId, m.senderName ?? m.chatName ?? '');
  }
  return Array.from(seen, ([chatId, name]) => ({ chatId, name }));
}
