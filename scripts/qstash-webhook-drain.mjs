// Create (or refresh) the QStash schedule that drains the school webhook outbox frequently, so the
// outbox does not wait for the once-a-day Vercel Hobby cron. Idempotent: it deletes any existing
// schedule pointing at this destination, then creates a fresh one.
//
// WHY QStash and not the Vercel cron: Vercel Hobby caps crons at once/day, which would delay every
// school webhook up to 24h. QStash calls our endpoint on a real sub-daily cron. The endpoint is
// unchanged: it already checks `Authorization: Bearer <CRON_SECRET>`, and QStash forwards that header
// via `Upstash-Forward-Authorization`. The route is a GET, so we set `Upstash-Method: GET` (QStash
// defaults to POST, which the GET-only route would 405).
//
// USAGE (run once against the DEPLOYED app; QStash cannot reach localhost):
//   QSTASH_TOKEN=... CRON_SECRET=... APP_URL=https://your-domain node scripts/qstash-webhook-drain.mjs
// APP_URL falls back to NEXTAUTH_URL. Override the cadence with DRAIN_CRON (default every 5 minutes).
// Get QSTASH_TOKEN from the Upstash console → QStash → "REST Token" (separate from the Redis token).

const QSTASH_URL = (process.env.QSTASH_URL || "https://qstash.upstash.io").replace(/\/$/, "");
const token = process.env.QSTASH_TOKEN;
const cronSecret = process.env.CRON_SECRET;
const appUrl = (process.env.APP_URL || process.env.NEXTAUTH_URL || "").replace(/\/$/, "");
const cron = process.env.DRAIN_CRON || "*/5 * * * *";

function requireEnv(name, value) {
  if (!value) {
    console.error(`Missing ${name}. See the usage comment at the top of this script.`);
    process.exit(1);
  }
}
requireEnv("QSTASH_TOKEN", token);
requireEnv("CRON_SECRET", cronSecret);
requireEnv("APP_URL (or NEXTAUTH_URL)", appUrl);

if (!/^https:\/\//.test(appUrl)) {
  console.error(`APP_URL must be a public https URL QStash can reach (got "${appUrl}"). QStash cannot call localhost.`);
  process.exit(1);
}

const destination = `${appUrl}/api/cron/webhook-drain`;
const auth = { Authorization: `Bearer ${token}` };

async function qstash(path, init = {}) {
  const res = await fetch(`${QSTASH_URL}${path}`, { ...init, headers: { ...auth, ...(init.headers || {}) } });
  const text = await res.text();
  if (!res.ok) throw new Error(`QStash ${init.method || "GET"} ${path} -> ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

try {
  // Remove any existing schedule aimed at this destination so re-running never stacks duplicates.
  const existing = (await qstash("/v2/schedules")) ?? [];
  const stale = existing.filter((s) => s.destination === destination);
  for (const s of stale) {
    await qstash(`/v2/schedules/${s.scheduleId}`, { method: "DELETE" });
    console.log(`Removed existing schedule ${s.scheduleId}`);
  }

  const created = await qstash(`/v2/schedules/${destination}`, {
    method: "POST",
    headers: {
      "Upstash-Cron": cron,
      "Upstash-Method": "GET",
      // Forwarded to the destination as `Authorization`, which the route checks against CRON_SECRET.
      "Upstash-Forward-Authorization": `Bearer ${cronSecret}`,
    },
  });

  console.log(`Scheduled webhook-drain: ${destination}`);
  console.log(`  cron: ${cron}   scheduleId: ${created?.scheduleId ?? "(see QStash console)"}`);
} catch (err) {
  console.error(String(err.message || err));
  process.exit(1);
}
