// One-off visual check for the analytics dashboard charts. Logs in as the seeded super-admin,
// opens /dashboard/analytics, waits for recharts to paint, and writes screenshots to Downloads.
// Run with the dev server already up:  node scripts/capture-analytics.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.LOGIN_EMAIL ?? "superadmin@kindleatechie.com";
const PASSWORD = process.env.LOGIN_PASSWORD ?? "Passw0rd!";
const OUT = "C:/Users/user/Downloads";

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();

console.log("login…");
// Warm the route so it is compiled; the second load hydrates fast. Use domcontentloaded + a fixed
// pause instead of networkidle so a recompiling dev server does not blow the navigation timeout.
page.setDefaultTimeout(60000);
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(4000);
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
// Wait for React hydration before interacting, or the form does a native GET.
await page.waitForTimeout(6000);
await page.fill('input[type="email"]', EMAIL);
await page.fill('input[type="password"]', PASSWORD);
for (let attempt = 0; attempt < 3 && /\/login/.test(page.url()); attempt++) {
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/, { timeout: 20000 }).catch(() => {});
  if (/\/login/.test(page.url())) {
    // Native-GET fallback happened (email/password land in the query). Reset and retry.
    console.log("retry login, url was:", page.url());
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(5000);
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
  }
}
await page.waitForTimeout(1500);
console.log("post-login url:", page.url());

console.log("analytics…");
// First cold compile of the analytics route (recharts + framer-motion + heavy API) can be slow.
await page.goto(`${BASE}/dashboard/analytics`, { waitUntil: "domcontentloaded", timeout: 150000 });
// Wait until recharts has actually PAINTED its marks (a bar with real width or an area path with a
// real `d`), not merely mounted the <svg>. The marks animate in from zero, so screenshotting on the
// bare surface freezes a blank frame. Then a short pause to let the entrance animation finish.
async function waitForCharts() {
  await page.waitForSelector(".recharts-surface", { timeout: 30000 }).catch(() => console.log("no recharts surface"));
  await page
    .waitForFunction(
      () => {
        for (const r of document.querySelectorAll(".recharts-rectangle")) {
          if (r.getBoundingClientRect().width > 3) return true;
        }
        for (const a of document.querySelectorAll(".recharts-area-area, path.recharts-curve")) {
          const d = a.getAttribute("d");
          if (d && d.length > 40) return true;
        }
        return false;
      },
      { timeout: 15000 },
    )
    .catch(() => console.log("charts did not paint in time"));
  await page.waitForTimeout(2000);
}

async function shot(name, opts = {}) {
  const file = `${OUT}/${name}`;
  await page.screenshot({ path: file, ...opts });
  console.log("saved", file);
}

// B2C tab (default view), full page.
await waitForCharts();

// Prove the paginated list endpoint responds with the right shape under the session cookie.
const probe = await page.evaluate(async () => {
  const out = {};
  for (const t of ["programs", "cohorts", "schools"]) {
    const res = await fetch(`/api/analytics/list?type=${t}&page=1&pageSize=8`, { cache: "no-store" });
    const body = res.ok ? await res.json() : null;
    out[t] = { status: res.status, total: body?.total ?? null, items: Array.isArray(body?.items) ? body.items.length : null };
  }
  return out;
});
console.log("list endpoint probe:", JSON.stringify(probe));

await shot("analytics-b2c.png", { fullPage: true });

// Switch to the Schools (B2B) tab and capture it.
const b2bTab = page.getByRole("tab", { name: "Schools (B2B)" });
if (await b2bTab.count()) {
  await b2bTab.click();
  await page.waitForTimeout(600);
  await waitForCharts();
  await shot("analytics-b2b.png", { fullPage: true });
} else {
  console.log("no B2B tab found");
}

await browser.close();
console.log("done");
