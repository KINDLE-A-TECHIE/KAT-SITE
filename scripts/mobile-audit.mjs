// Repo-wide mobile responsiveness audit. Logs in as the seeded super-admin, visits every reachable
// route at a 390px (iPhone-class) viewport, and reports which pages overflow the viewport
// horizontally (the classic mobile failure) plus the elements that cross the right edge.
//
//   node scripts/mobile-audit.mjs            # audit at 390px
//   VIEW_W=768 node scripts/mobile-audit.mjs # tablet
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
// AUDIT_SET=b2c (default) sweeps marketing + B2C dashboard as the super-admin; AUDIT_SET=school
// sweeps the B2B school surfaces as a SCHOOL_STAFF member.
const AUDIT_SET = process.env.AUDIT_SET ?? "b2c";
const EMAIL =
  process.env.LOGIN_EMAIL ??
  (AUDIT_SET === "school" ? "schooladmin@kindleatechie.com" : "superadmin@kindleatechie.com");
const PASSWORD = process.env.LOGIN_PASSWORD ?? "Passw0rd!";
const LANDING = AUDIT_SET === "school" ? /^\/(admin|teach|learn|home|dashboard)/ : /^\/dashboard/;
const pathOf = (u) => {
  try {
    return new URL(u).pathname;
  } catch {
    return u;
  }
};
const VIEW_W = Number(process.env.VIEW_W ?? 390);
const VIEW_H = Number(process.env.VIEW_H ?? 844);

const PUBLIC_ROUTES = [
  "/",
  "/schools",
  "/schools/developers",
  "/login",
  "/register",
  "/fellowship",
  "/events",
  "/partners",
  "/projects",
  "/showcase",
  "/privacy",
  "/terms",
  "/cookies",
];

const DASHBOARD_ROUTES = [
  "/dashboard",
  "/dashboard/analytics",
  "/dashboard/messages",
  "/dashboard/curriculum",
  "/dashboard/assessments",
  "/dashboard/meetings",
  "/dashboard/challenges",
  "/dashboard/projects",
  "/dashboard/certificates",
  "/dashboard/schools",
  "/dashboard/settings",
  "/dashboard/profile",
  "/dashboard/cohorts",
  "/dashboard/partner-inquiries",
  "/dashboard/testimonials",
  "/dashboard/payments",
  "/dashboard/content-review",
  "/dashboard/fellows/applications",
  "/dashboard/recordings",
  "/dashboard/transcript",
  "/dashboard/badges",
];

const SCHOOL_ROUTES = [
  "/admin",
  "/admin/classes",
  "/admin/teachers",
  "/admin/billing",
  "/admin/reports",
  "/admin/certificates",
  "/admin/embed",
  "/admin/api",
  "/admin/profile",
  "/teach",
  "/learn",
  "/learn/assessments",
];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: VIEW_W, height: VIEW_H },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
});
const page = await ctx.newPage();
page.setDefaultTimeout(45000);

const LOGIN_URL = AUDIT_SET === "school" ? `${BASE}/login?callbackUrl=/admin` : `${BASE}/login`;

async function login() {
  await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(4500);
  for (let attempt = 0; attempt < 4 && !LANDING.test(pathOf(page.url())); attempt++) {
    await page.fill('input[type="email"]', EMAIL).catch(() => {});
    await page.fill('input[type="password"]', PASSWORD).catch(() => {});
    await page.click('button[type="submit"]').catch(() => {});
    await page.waitForURL((u) => LANDING.test(new URL(u).pathname), { timeout: 20000 }).catch(() => {});
    if (!LANDING.test(pathOf(page.url()))) {
      await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(4500);
    }
  }
  console.log("login:", LANDING.test(pathOf(page.url())) ? `ok (${page.url()})` : `FAILED (${page.url()})`);
}

// Elements that cross the right edge WHILE the document itself overflows. Children inside a
// legitimately scrollable container do not count, because the document does not overflow then.
async function audit(route) {
  try {
    await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  } catch {
    return { route, error: "nav timeout" };
  }
  await page.waitForTimeout(1500);
  const result = await page.evaluate(() => {
    const doc = document.documentElement;
    const vw = doc.clientWidth;
    const docW = Math.max(doc.scrollWidth, document.body ? document.body.scrollWidth : 0);
    const overflow = docW - vw;
    // An element inside a horizontally-scrollable (or clipped) container is contained, not a real
    // page-overflow offender. Walk ancestors and ignore those.
    const contained = (el) => {
      let n = el.parentElement;
      while (n && n !== document.body) {
        const s = getComputedStyle(n);
        if (["auto", "scroll", "hidden"].includes(s.overflowX) && n.clientWidth <= vw + 2) return true;
        n = n.parentElement;
      }
      return false;
    };
    const offenders = [];
    if (overflow > 1) {
      for (const el of document.querySelectorAll("body *")) {
        const r = el.getBoundingClientRect();
        if (r.right > vw + 2 && r.width > 24 && r.width < vw * 3 && !contained(el)) {
          const cls = typeof el.className === "string" ? el.className : "";
          offenders.push({ tag: el.tagName.toLowerCase(), cls: cls.slice(0, 100), right: Math.round(r.right), w: Math.round(r.width) });
        }
      }
      offenders.sort((a, b) => b.right - a.right);
    }
    return { vw, docW, overflow, url: location.pathname, offenders: offenders.slice(0, 6) };
  });
  if (result.overflow > 1) {
    await page
      .screenshot({ path: `C:/Users/user/Downloads/overflow_${route.replace(/[/]/g, "_") || "root"}.png`, fullPage: true })
      .catch(() => {});
  }
  return { route, ...result };
}

await login();

const routes = AUDIT_SET === "school" ? SCHOOL_ROUTES : [...PUBLIC_ROUTES, ...DASHBOARD_ROUTES];
const overflows = [];
for (const route of routes) {
  const r = await audit(route);
  if (r.error) {
    console.log(`?  ${route}  (${r.error})`);
    continue;
  }
  const redirected = r.url !== route && !(route === "/" && r.url === "/");
  const tag = r.overflow > 1 ? `OVERFLOW +${r.overflow}px` : "ok";
  console.log(`${r.overflow > 1 ? "X " : "  "}${route}${redirected ? ` -> ${r.url}` : ""}  ${tag}`);
  if (r.overflow > 1) {
    overflows.push(r);
    for (const o of r.offenders) {
      console.log(`      <${o.tag}> w${o.w} right${o.right}  ${o.cls}`);
    }
  }
}

console.log(`\n=== ${overflows.length} route(s) overflow at ${VIEW_W}px ===`);
for (const r of overflows) {
  console.log(`  ${r.route} (+${r.overflow}px)`);
}

await browser.close();
