// Deep mobile audit for the three B2B learner/teacher surfaces the shallow sweep could not reach:
//   MODE=teach  node --env-file=.env.local scripts/mobile-audit-school-deep.mjs
//   MODE=learn  node --env-file=.env.local scripts/mobile-audit-school-deep.mjs
//   MODE=embed  node --env-file=.env.local scripts/mobile-audit-school-deep.mjs
// Requires scripts/_school_setup.ts to have provisioned the test pupil (join code + PIN).
import { chromium } from "playwright";
import { SignJWT } from "jose";

const MODE = process.env.MODE ?? "teach";
const BASE = process.env.BASE_URL ?? "http://schools.localhost:3000";
const VIEW_W = Number(process.env.VIEW_W ?? 390);
const VIEW_H = Number(process.env.VIEW_H ?? 844);
const OUT = "C:/Users/user/Downloads";

// Test pupil provisioned by _school_setup.ts.
const JOIN_CODE = process.env.JOIN_CODE ?? "DEMO01";
const PIN = process.env.PIN ?? "1234";
const PUPIL_NAME = process.env.PUPIL_NAME ?? "Mobile";
const PUPIL_REF = process.env.PUPIL_REF ?? "cmsots9xh0001im14lfgv27ql";
const SCHOOL_ID = process.env.SCHOOL_ID ?? "cmrmu9wol001fim6oko9ldzya";
const PUPIL_USER_ID = process.env.PUPIL_USER_ID ?? "cmsots8ys0000im146h2luefi";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: VIEW_W, height: VIEW_H }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.setDefaultTimeout(60000);

async function audit(label, { screenshot = false } = {}) {
  // Wait for real content to paint (these are client-rendered, data-fetching pages) before measuring;
  // a blank page trivially "has no overflow", which would be a false pass.
  await page
    .waitForFunction(() => (document.querySelector("main") ?? document.body).innerText.trim().length > 40, { timeout: 25000 })
    .catch(() => console.log(`      (content did not paint for ${label})`));
  await page.waitForTimeout(2500);
  const r = await page.evaluate(() => {
    const doc = document.documentElement;
    const vw = doc.clientWidth;
    const docW = Math.max(doc.scrollWidth, document.body ? document.body.scrollWidth : 0);
    const overflow = docW - vw;
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
        const rect = el.getBoundingClientRect();
        if (rect.right > vw + 2 && rect.width > 24 && rect.width < vw * 3 && !contained(el)) {
          const cls = typeof el.className === "string" ? el.className : "";
          offenders.push({ tag: el.tagName.toLowerCase(), cls: cls.slice(0, 100), right: Math.round(rect.right), w: Math.round(rect.width) });
        }
      }
      offenders.sort((a, b) => b.right - a.right);
    }
    return { vw, overflow, url: location.pathname, offenders: offenders.slice(0, 6) };
  });
  const flag = r.overflow > 1 ? `OVERFLOW +${r.overflow}px` : "ok";
  console.log(`${r.overflow > 1 ? "X " : "  "}${label} [${r.url}]  ${flag}`);
  for (const o of r.offenders) console.log(`      <${o.tag}> w${o.w} right${o.right}  ${o.cls}`);
  if (screenshot || r.overflow > 1) {
    await page.screenshot({ path: `${OUT}/deep_${MODE}_${label.replace(/\W+/g, "_")}.png`, fullPage: true }).catch(() => {});
  }
  return r;
}

async function go(path) {
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
}

if (MODE === "teach") {
  await go("/login?callbackUrl=/teach");
  await page.waitForTimeout(4500);
  for (let i = 0; i < 4 && !/\/(teach|home|admin|dashboard)/.test(new URL(page.url()).pathname); i++) {
    await page.fill('input[type="email"]', "schoolteacher@kindleatechie.com").catch(() => {});
    await page.fill('input[type="password"]', "Passw0rd!").catch(() => {});
    await page.click('button[type="submit"]').catch(() => {});
    await page.waitForURL((u) => /\/(teach|home|admin|dashboard)/.test(new URL(u).pathname), { timeout: 20000 }).catch(() => {});
    if (!/\/(teach|home)/.test(new URL(page.url()).pathname)) {
      await go("/login?callbackUrl=/teach");
      await page.waitForTimeout(4500);
    }
  }
  console.log("teacher landed:", page.url());
  await go("/teach");
  await audit("teach-home", { screenshot: true });
  await go("/teach/seed-demo-jss-class");
  await audit("teach-class", { screenshot: true });
} else if (MODE === "learn") {
  await go("/student-login");
  await page.waitForTimeout(4000);
  await audit("student-login-code", { screenshot: true });
  await page.fill("#code", JOIN_CODE).catch(() => {});
  await page.click('button[type="submit"]').catch(() => {});
  // Wait for the roster (cold API compile can be slow) to render the pupil pick step.
  const pupilBtn = page.getByRole("button", { name: new RegExp(PUPIL_NAME, "i") }).first();
  await pupilBtn.waitFor({ state: "visible", timeout: 40000 }).catch(() => console.log("      (pupil pick did not appear)"));
  await audit("student-login-name", { screenshot: true });
  await pupilBtn.click().catch(() => {});
  await page.getByRole("button", { name: "1", exact: true }).waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
  await audit("student-login-pin", { screenshot: true });
  // The PIN keypad is a young-child UI; drive the sign-in programmatically via the NextAuth
  // credentials callback (backend auth already verified) rather than fight per-digit taps.
  const signInStatus = await page.evaluate(
    async ({ code, ref, pin }) => {
      const csrf = (await (await fetch("/api/auth/csrf")).json()).csrfToken;
      const body = new URLSearchParams({ csrfToken: csrf, classCode: code, pupilRef: ref, pin, json: "true", callbackUrl: "/learn" });
      const res = await fetch("/api/auth/callback/student-pin", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
      });
      return res.status;
    },
    { code: JOIN_CODE, ref: PUPIL_REF, pin: PIN },
  );
  console.log("student-pin callback status:", signInStatus);
  await page.waitForTimeout(1500);
  console.log("pupil landed:", page.url());
  await go("/learn");
  await audit("learn-home", { screenshot: true });
  await go("/learn/assessments");
  await audit("learn-assessments", { screenshot: true });
} else if (MODE === "embed") {
  const secret = new TextEncoder().encode(process.env.EMBED_TOKEN_SECRET);
  const mint = async () => {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({ schoolId: SCHOOL_ID, userId: PUPIL_USER_ID, purpose: "learn" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("kat")
      .setAudience("kat:embed:launch")
      .setJti(crypto.randomUUID())
      .setIssuedAt(now)
      .setExpirationTime(now + 60)
      .sign(secret);
  };
  void mint; // launch-token path is flaky top-level (cookie must stick in a frame); inject session directly
  // The embed page reads the kat_embed_session cookie and validates the SESSION JWT (readEmbedSession).
  // Minting that JWT and injecting it as the cookie renders the real learner content top-level,
  // bypassing the iframe cookie-stick handshake that only works framed on an allowed origin.
  const now = Math.floor(Date.now() / 1000);
  const sessionJwt = await new SignJWT({ schoolId: SCHOOL_ID, userId: PUPIL_USER_ID, purpose: "learn" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("kat")
    .setAudience("kat:embed:session")
    .setIssuedAt(now)
    .setExpirationTime(now + 30 * 60)
    .sign(secret);
  await ctx.addCookies([
    { name: "kat_embed_session", value: sessionJwt, domain: "schools.localhost", path: "/", httpOnly: true, secure: true, sameSite: "None" },
  ]);
  await go("/embed/demo-academy");
  await audit("embed-home", { screenshot: true });
  await go("/embed/demo-academy/assessments");
  await audit("embed-assessments", { screenshot: true });
}

await browser.close();
console.log("done");
