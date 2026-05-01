/**
 * Daily WhatsApp group update via GreenAPI — reads directly from D1.
 *
 * Architecture:
 *   Cloudflare Worker (cron)  ──▶  D1 (ysa-temple-booking)
 *                             ──▶  GreenAPI  ──▶  WhatsApp group
 */

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(sendDailyUpdate(env));
  },

  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/run' && url.searchParams.get('key') === env.MANUAL_TRIGGER_KEY) {
      const result = await sendDailyUpdate(env);
      return Response.json(result);
    }

    if (url.pathname === '/test' && url.searchParams.get('key') === env.MANUAL_TRIGGER_KEY) {
      const result = await sendToWhatsApp('✅ Test message from the OnebyOne bot!', env);
      return Response.json({ ok: true, result });
    }

    if (url.pathname === '/chats' && url.searchParams.get('key') === env.MANUAL_TRIGGER_KEY) {
      const chats = await listChats(env);
      return Response.json(chats);
    }


    return new Response('OK');
  },
};

async function sendDailyUpdate(env) {
  try {
    const data = await fetchFromD1(env);
    const message = formatMessage(data);
    const result = await sendToWhatsApp(message, env);
    return { ok: true, result };
  } catch (err) {
    console.error('Daily update failed:', err);
    return { ok: false, error: err.message };
  }
}

// --- 1. Query D1 ---
async function fetchFromD1(env) {
  const db = env.DB;

  // Arrivals
  const arrivals = await db.prepare(`
    SELECT arrival, COUNT(*) as count
    FROM arrival_responses
    GROUP BY arrival
  `).all();

  const arrivalMap = {};
  for (const row of arrivals.results) {
    arrivalMap[row.arrival] = row.count;
  }

  // Baptism bookings (session_type = 'baptism')
  const baptism = await db.prepare(`
    SELECT b.status, COUNT(*) as count
    FROM bookings b
    JOIN sessions s ON b.session_id = s.id
    WHERE s.session_type = 'baptism'
    GROUP BY b.status
  `).all();

  const baptismMap = {};
  for (const row of baptism.results) baptismMap[row.status] = row.count;

  // Endowment bookings (session_type = 'endowment')
  const endowment = await db.prepare(`
    SELECT b.status, COUNT(*) as count
    FROM bookings b
    JOIN sessions s ON b.session_id = s.id
    WHERE s.session_type = 'endowment'
    GROUP BY b.status
  `).all();

  const endowmentMap = {};
  for (const row of endowment.results) endowmentMap[row.status] = row.count;

  // Total session capacity
  const capacity = await db.prepare(`
    SELECT session_type, SUM(capacity) as total
    FROM sessions
    GROUP BY session_type
  `).all();

  const capacityMap = {};
  for (const row of capacity.results) capacityMap[row.session_type] = row.total;

  // Mission stage
  const stage = await db.prepare(`
    SELECT stage, COUNT(*) as count
    FROM stage_responses
    GROUP BY stage
  `).all();

  const stageMap = {};
  for (const row of stage.results) stageMap[row.stage] = row.count;

  return { arrivalMap, baptismMap, endowmentMap, capacityMap, stageMap };
}

// --- 2. Format the message ---
function formatMessage({ arrivalMap, baptismMap, endowmentMap, capacityMap, stageMap }) {
  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const n = (map, key) => map[key] ?? 0;

  return [
    `*OnebyOne Collected Data - ${today}*`,
    '',
    '*Arrival Information:*',
    '',
    `• Friday 10am - 7pm - ${n(arrivalMap, 'friday_day')}`,
    `• Friday 8pm onwards - ${n(arrivalMap, 'friday_evening')}`,
    `• Saturday - ${n(arrivalMap, 'saturday')}`,
    `• Sunday - ${n(arrivalMap, 'sunday')}`,
    '',
    '*Temple Information:*',
    '',
    `• Baptism Sessions Confirmed - ${n(baptismMap, 'confirmed')}/${n(capacityMap, 'baptism')}`,
    `• Endowment Sessions Confirmed - ${n(endowmentMap, 'confirmed')}/${n(capacityMap, 'endowment')}`,
    '',
    `• Baptism Sessions Waiting List - ${n(baptismMap, 'waitlist')}`,
    `• Endowment Sessions Waiting List - ${n(endowmentMap, 'waitlist')}`,
    '',
    '*Mission Information:*',
    '',
    `• Preparing Papers - ${n(stageMap, 'preparing_papers')}`,
    `• Papers in - ${n(stageMap, 'papers_in')}`,
    `• Call Received - ${n(stageMap, 'call_received')}`,
  ].join('\n');
}

// --- 3. Send via GreenAPI ---
async function sendToWhatsApp(message, env) {
  const url = `https://api.green-api.com/waInstance${env.GREENAPI_ID}/sendMessage/${env.GREENAPI_TOKEN}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chatId: env.WHATSAPP_GROUP_ID,
      message,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`greenapi ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

// --- Setup helper ---
async function listChats(env) {
  const url = `https://api.green-api.com/waInstance${env.GREENAPI_ID}/getChats/${env.GREENAPI_TOKEN}`;
  const res = await fetch(url);
  const body = await res.json();
  return body.map(c => ({ chatId: c.id, name: c.name ?? '' }));
}
