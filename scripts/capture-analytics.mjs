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
// Warm the route so it is compiled; the second load hydrates fast.
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
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
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.waitForTimeout(5000);
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
  }
}
await page.waitForTimeout(1500);
console.log("post-login url:", page.url());

console.log("analytics…");
await page.goto(`${BASE}/dashboard/analytics`, { waitUntil: "domcontentloaded" });
await page.waitForSelector(".recharts-surface", { timeout: 30000 }).catch(() => console.log("no recharts surface found"));
await page.waitForTimeout(2500);

async function shot(name, opts = {}) {
  const file = `${OUT}/${name}`;
  await page.screenshot({ path: file, ...opts });
  console.log("saved", file);
}

// Light mode, full page.
await shot("analytics-charts-light.png", { fullPage: true });

// Dark mode: set the theme the way the app does (localStorage) and reload so the shell mounts
// dark from the start. Toggling the class live makes the theme provider thrash and re-animate.
await page.evaluate(() => localStorage.setItem("theme", "dark"));
await page.goto(`${BASE}/dashboard/analytics`, { waitUntil: "domcontentloaded" });
await page.waitForSelector(".recharts-surface", { timeout: 30000 }).catch(() => console.log("no recharts surface (dark)"));
await page.waitForTimeout(3000);
await shot("analytics-charts-dark.png", { fullPage: true });

await browser.close();
console.log("done");
