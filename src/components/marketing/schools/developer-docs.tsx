import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { AlertTriangle, ArrowLeft, ShieldCheck } from "lucide-react";
import { DESIGN_TOKENS } from "../landing-tokens";
import { CopyBlock } from "./copy-block";

/**
 * The developer documentation for KAT for Schools.
 *
 * THIS PAGE IS THE CANONICAL SPEC. API.md in the repo points here rather than restating it, two
 * copies of an API spec drift, and the one a school's developer reads would be the stale one.
 *
 * Written for the reader who actually shows up: a school's IT contractor, often working alone,
 * often on a bespoke PHP or .NET system, who has thirty minutes. So: what you can build, what you need
 * before you start, then a working request in the first screen, and the dangerous parts called out
 * where they will be read, not buried in a security appendix nobody opens.
 */

const NAV = [
  { id: "requirements", label: "Requirements" },
  { id: "concepts", label: "Concepts" },
  { id: "keys", label: "API keys" },
  { id: "quickstart", label: "Quickstart" },
  { id: "roster", label: "Roster sync" },
  { id: "reading", label: "Reading data" },
  { id: "webhooks", label: "Webhooks" },
  { id: "sso", label: "Magic-link SSO" },
  { id: "errors", label: "Errors & limits" },
  { id: "golive", label: "Go-live checklist" },
];

export function DeveloperDocs() {
  return (
    <main
      style={DESIGN_TOKENS as CSSProperties}
      className="relative min-h-screen bg-[var(--kat-paper)] font-serif text-[var(--kat-ink)]"
    >
      {/* Header, same slim, quiet register as the schools landing. */}
      <header className="sticky top-0 z-40 border-b border-[var(--kat-line)] bg-[var(--kat-paper)]/90 backdrop-blur-xl">
        <div className="kat-page flex h-16 items-center justify-between">
          <Link href="/schools" className="flex items-center gap-2.5">
            <Image src="/kindle-a-techie.svg" alt="KAT logo" width={36} height={36} priority />
            <span className="font-display text-[0.95rem] font-semibold tracking-tight">
              kindle <span className="text-[var(--kat-clay)]">a techie</span>
              <span className="ml-2 border-l border-[var(--kat-line)] pl-2 font-mono text-[0.68rem] font-medium uppercase tracking-[0.16em] text-[var(--kat-text-2)]">
                developers
              </span>
            </span>
          </Link>
          <Link
            href="/schools"
            className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.14em] text-[var(--kat-text-2)] transition hover:text-[var(--kat-clay)]"
          >
            <ArrowLeft className="size-3.5" />
            For schools
          </Link>
        </div>
      </header>

      <div className="kat-page grid gap-12 pb-24 pt-12 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-16">
        {/* Sticky table of contents. */}
        <nav aria-label="Contents" className="hidden lg:block">
          <div className="sticky top-24">
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-[var(--kat-text-2)]">
              Contents
            </p>
            <ul className="mt-4 space-y-2 border-l border-[var(--kat-line)]">
              {NAV.map((n) => (
                <li key={n.id}>
                  <a
                    href={`#${n.id}`}
                    className="-ml-px block border-l border-transparent py-0.5 pl-3 text-sm text-[var(--kat-text-2)] transition hover:border-[var(--kat-clay)] hover:text-[var(--kat-clay)]"
                  >
                    {n.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <article className="min-w-0 max-w-3xl">
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-[var(--kat-clay)]">
            // api v1
          </p>
          <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
            Connect KAT to your school&apos;s own systems.
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-[var(--kat-text-2)]">
            Sync your roster from the system where you already keep your pupil records. Pull
            progress and results into your own reports. Sign pupils straight into their lessons from
            your portal, with no second password. Get a webhook the moment a pupil finishes a lesson.
          </p>
          <p className="mt-4 text-[var(--kat-text-2)]">
            Everything below is scoped to <strong>your school</strong>. There is no{" "}
            <Code>school_id</Code> parameter anywhere in this API. You cannot reach another school,
            even by accident.
          </p>

          <Rule />

          {/* ── Requirements ─────────────────────────────────────────────── */}
          <Section id="requirements" title="Before you start">
            <p>
              This is a small REST API. If you can make an HTTPS request from your server, you can
              integrate. You will need:
            </p>
            <Checklist
              items={[
                <>
                  <strong>A server.</strong> Your API key must never appear in a web page. See{" "}
                  <a href="#keys" className="underline decoration-[var(--kat-clay)] decoration-2 underline-offset-2 transition hover:text-[var(--kat-clay)]">
                    API keys
                  </a>
                  .
                </>,
                <>
                  <strong>A stable pupil id.</strong> Whatever your school system already calls a
                  pupil, whether that is an admission number or a register number. We call it <Code>student_id</Code>.
                  It never leaves your school.
                </>,
                <>
                  <strong>For webhooks only:</strong> a public <Code>https</Code> endpoint we can
                  POST to.
                </>,
                <>
                  <strong>For the lesson window only:</strong> the exact address of the page it will
                  sit on, e.g. <Code>https://portal.yourschool.edu.ng</Code>.
                </>,
              ]}
            />
            <Note>
              No SDK to install, no OAuth dance, no XML. Your school system might be called an MIS,
              an SMS or an SIS. It does not matter. If it can make an HTTPS request, you are ten
              minutes from a working sync.
              <br />
              <br />
              <strong>The API and the lesson window are included in your licence.</strong> There is
              no separate charge and no usage meter: every pupil the API can create or sign in is a
              seat you have already paid for.
            </Note>
          </Section>

          {/* ── Concepts ─────────────────────────────────────────────────── */}
          <Section id="concepts" title="Three things to know">
            <Defn term="student_id">
              <strong>Your</strong> id for a pupil, not ours. You send it when you upload your
              roster, and every endpoint after that speaks it back to you. It is meaningless outside
              your school.
              <br />
              <span className="text-[var(--kat-text-2)]">
                We never accept a name or an email as a lookup key. An endpoint that took an email
                would let anyone guess their way through your roll.
              </span>
            </Defn>
            <Defn term="class_id">
              Ours. Get it from <Code>GET /v1/classes</Code>. Classes are created by your school
              admin in the KAT dashboard.
            </Defn>
            <Defn term="scopes">
              What a key is allowed to do. Give each system its own key with only what it needs, so
              revoking one does not take down the others.
            </Defn>
          </Section>

          {/* ── Keys ─────────────────────────────────────────────────────── */}
          <Section id="keys" title="API keys">
            <p>
              Your school admin creates keys in the KAT dashboard, under{" "}
              <em>Connect your school&apos;s own systems</em>. The secret is shown{" "}
              <strong>once</strong>. We store only a hash of it and genuinely cannot show it again.
            </p>

            <CopyBlock label="every request" code={`Authorization: Bearer kat_sk_xxxxxxxxxxxxxxxx`} />

            <Danger title="This key belongs on your server. Nowhere else.">
              Depending on its scopes, a key can <strong>create pupil accounts</strong> or{" "}
              <strong>open a lesson window as any pupil at your school</strong>. A key in a web page
              is a key that every visitor can read. Not in JavaScript, not in a mobile app, not in a
              public repository.
            </Danger>

            <h3 className="mt-8 font-display text-base font-semibold tracking-tight">Scopes</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--kat-ink)] text-left">
                    <th className="py-2 pr-4 font-mono text-[0.68rem] uppercase tracking-[0.14em]">
                      Scope
                    </th>
                    <th className="py-2 font-mono text-[0.68rem] uppercase tracking-[0.14em]">
                      Lets the key…
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--kat-line)]">
                  {[
                    ["CLASSES_READ", "List your classes.", false],
                    ["PROGRESS_READ", "Read pupil progress. Also required to register webhooks.", false],
                    ["RESULTS_READ", "Read assessment results.", false],
                    ["ROSTER_WRITE", "Create and deactivate pupil accounts.", true],
                    ["EMBED_MINT", "Sign in as any pupil at your school.", true],
                  ].map(([scope, what, danger]) => (
                    <tr key={scope as string}>
                      <td className="py-2.5 pr-4 align-top">
                        <code className="font-mono text-[0.78rem] text-[var(--kat-clay)]">
                          {scope as string}
                        </code>
                        {danger ? (
                          <span className="ml-2 inline-flex items-center gap-1 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-[var(--kat-clay)]">
                            <AlertTriangle className="size-3" />
                            powerful
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2.5 align-top text-[var(--kat-text-2)]">{what as string}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-sm text-[var(--kat-text-2)]">
              Missing a scope gives you <Code>403 insufficient_scope</Code>, naming the one you need.
            </p>

            <h3 className="mt-8 font-display text-base font-semibold tracking-tight">Rotating a key</h3>
            <p>
              Create the new key → point your system at it → revoke the old one. Both work until you
              revoke, so there is no window where your integration is down.
            </p>
            <p className="text-[var(--kat-text-2)]">
              Revocation takes effect immediately. Revoked keys are <em>kept</em>, not deleted. If a
              key ever leaks, the record of what it did is exactly what you will want to read.
            </p>
          </Section>

          {/* ── Quickstart ───────────────────────────────────────────────── */}
          <Section id="quickstart" title="Quickstart">
            <p>Your first request. Everything else is a variation on this.</p>
            <CopyBlock
              label="1. list your classes"
              code={`curl https://schools.kindleatechie.com/api/v1/classes \\
  -H "Authorization: Bearer $KAT_API_KEY"`}
            />
            <CopyBlock
              label="response"
              language="json"
              code={`{
  "data": [
    {
      "id": "cls_abc123",
      "name": "Primary 5A",
      "nerdc_level": "PRIMARY_4_6",
      "term": "2026/2027 Term 1",
      "teacher": "Ngozi Okafor",
      "student_count": 32
    }
  ],
  "has_more": false,
  "next_cursor": null
}`}
            />
            <p className="text-[var(--kat-text-2)]">
              That <Code>id</Code> is the <Code>class_id</Code> you will use everywhere below.
            </p>
          </Section>

          {/* ── Roster ───────────────────────────────────────────────────── */}
          <Section id="roster" title="Roster sync">
            <p>
              Send us a class list. New pupils are created; pupils already on the roster are skipped.
              Run it nightly, run it twice. It is safe.
            </p>
            <CopyBlock
              label="POST /v1/roster · scope: ROSTER_WRITE"
              code={`curl -X POST https://schools.kindleatechie.com/api/v1/roster \\
  -H "Authorization: Bearer $KAT_API_KEY" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: 2026-09-01-primary5a" \\
  -d '{
    "class_id": "cls_abc123",
    "students": [
      { "student_id": "STU-0417", "name": "Chidi Okafor", "guardian_email": "parent@example.com" },
      { "student_id": "STU-0418", "name": "Ada Balogun" }
    ]
  }'`}
            />
            <CopyBlock
              label="response"
              language="json"
              code={`{
  "created": 2,
  "reactivated": 0,
  "skipped": 0,
  "deactivated": 0,
  "errors": [],
  "seats": { "used": 32, "limit": 40 }
}`}
            />

            <h3 className="mt-8 font-display text-base font-semibold tracking-tight">Always send an Idempotency-Key</h3>
            <p>
              A sync of 400 pupils over a flaky line <em>will</em> get retried. With an{" "}
              <Code>Idempotency-Key</Code>, the retry replays the original response instead of
              creating every child a second time. Use anything stable and unique per sync. A date
              plus the class works well.
            </p>
            <p className="text-sm text-[var(--kat-text-2)]">
              The same key with a <em>different</em> body is a <Code>422</Code>. That is deliberate:
              silently replaying an unrelated response would be worse than either honest answer.
            </p>

            <h3 className="mt-8 font-display text-base font-semibold tracking-tight">Removing pupils</h3>
            <p>
              <strong>We never delete a pupil.</strong> Deleting one would take their progress, their
              certificates and their history with them. Pupils are <em>deactivated</em>, and come
              back the moment they reappear in a sync.
            </p>
            <CopyBlock
              label="deactivate pupils missing from the list"
              language="json"
              code={`{
  "class_id": "cls_abc123",
  "students": [ … ],
  "deactivate_missing": true
}`}
            />
            <Danger title="The 20% rule">
              If a sync would deactivate <strong>more than 20% of a class</strong>, we refuse it with
              a <Code>409</Code> and <strong>change nothing</strong>. Send <Code>&quot;force&quot;: true</Code> to
              confirm you meant it.
              <br />
              <br />
              This exists because the realistic accident is not malice. It is a sync run against a
              half-populated export on a Friday afternoon, quietly unenrolling a year group.
            </Danger>
          </Section>

          {/* ── Reading ──────────────────────────────────────────────────── */}
          <Section id="reading" title="Reading progress and results">
            <CopyBlock
              label="GET /v1/students/{student_id}/progress · scope: PROGRESS_READ"
              code={`curl https://schools.kindleatechie.com/api/v1/students/STU-0417/progress \\
  -H "Authorization: Bearer $KAT_API_KEY"`}
            />
            <CopyBlock
              label="response"
              language="json"
              code={`{
  "student_id": "STU-0417",
  "name": "Chidi Okafor",
  "status": "ACTIVE",
  "class_id": "cls_abc123",
  "lessons_total": 36,
  "lessons_completed": 12,
  "percent_complete": 33,
  "units": [
    {
      "unit_id": "mod_…",
      "title": "Term 1: Introduction to Computers",
      "strand": "DIGLIT",
      "lessons_total": 6,
      "lessons_completed": 6,
      "percent_complete": 100
    }
  ]
}`}
            />
            <CopyBlock
              label="GET /v1/results · scope: RESULTS_READ"
              code={`curl "https://schools.kindleatechie.com/api/v1/results?class_id=cls_abc123" \\
  -H "Authorization: Bearer $KAT_API_KEY"`}
            />
            <p className="text-sm text-[var(--kat-text-2)]">
              Both endpoints paginate: <Code>?limit=</Code> (default 50, max 200) and{" "}
              <Code>?cursor=</Code>. Follow <Code>next_cursor</Code> until <Code>has_more</Code> is
              false.
            </p>
          </Section>

          {/* ── Webhooks ─────────────────────────────────────────────────── */}
          <Section id="webhooks" title="Webhooks">
            <p>Rather than polling, let us tell you.</p>
            <CopyBlock
              label="POST /v1/webhooks · scope: PROGRESS_READ"
              code={`curl -X POST https://schools.kindleatechie.com/api/v1/webhooks \\
  -H "Authorization: Bearer $KAT_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "url": "https://portal.yourschool.edu.ng/hooks/kat" }'`}
            />
            <p className="text-sm text-[var(--kat-text-2)]">
              Returns a <Code>secret</Code>, shown once. Your URL must be <Code>https</Code> and
              publicly reachable. Private and internal addresses are rejected.
            </p>

            <h3 className="mt-8 font-display text-base font-semibold tracking-tight">Events</h3>
            <ul className="my-4 list-disc space-y-2 pl-5 text-sm leading-relaxed marker:text-[var(--kat-clay)]">
              <li>
                <Code>lesson.completed</Code>: a pupil finishes a lesson
              </li>
              <li>
                <Code>assessment.graded</Code>: a pupil&apos;s assessment is marked
              </li>
            </ul>

            <h3 className="mt-8 font-display text-base font-semibold tracking-tight">Payloads carry no names</h3>
            <CopyBlock
              label="POST to your endpoint"
              language="json"
              code={`{
  "id": "whd_…",
  "type": "lesson.completed",
  "createdAt": "2026-09-12T09:14:22.000Z",
  "data": {
    "student_id": "STU-0417",
    "class_id": "cls_abc123",
    "lesson_id": "les_…",
    "completed_at": "2026-09-12T09:14:22.000Z"
  }
}`}
            />
            <p>
              Refs only, with <strong>no names and no emails</strong>. Call the API back if you need detail.
              This keeps children&apos;s names out of your webhook logs and your error tracker, which
              is where data actually leaks from.
            </p>

            <h3 className="mt-8 font-display text-base font-semibold tracking-tight">Verify every delivery</h3>
            <p>
              We sign with{" "}
              <a
                href="https://standardwebhooks.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-[var(--kat-clay)] decoration-2 underline-offset-2 transition hover:text-[var(--kat-clay)]"
              >
                Standard Webhooks
              </a>
             , so an off-the-shelf library will work. Or do it by hand:
            </p>
            <CopyBlock
              label="node.js"
              language="javascript"
              code={`const crypto = require("crypto");

function verify(req, secret) {
  const id  = req.headers["webhook-id"];
  const ts  = req.headers["webhook-timestamp"];
  const sig = req.headers["webhook-signature"];

  // Reject anything older than 5 minutes, or a captured delivery
  // can be replayed against you forever.
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;

  const expected = "v1," + crypto
    .createHmac("sha256", secret.replace(/^whsec_/, ""))
    .update(\`\${id}.\${ts}.\${req.rawBody}\`)   // the RAW body, before JSON.parse
    .digest("base64");

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}`}
            />
            <Danger title="An unverified endpoint believes anybody">
              Without this check, anyone who guesses your URL can tell you whatever they like about
              your pupils. Verify before you trust, and use the <strong>raw</strong> body, not the
              re-serialised JSON object.
            </Danger>

            <h3 className="mt-8 font-display text-base font-semibold tracking-tight">Retries</h3>
            <p>
              A non-2xx or a timeout is retried with backoff (1 minute → 12 hours) for up to 10
              attempts. After 10 consecutive failures the endpoint is <strong>disabled</strong> and
              your admin is told, rather than us hammering a dead URL while live events queue up
              behind it.
            </p>
            <p className="text-sm text-[var(--kat-text-2)]">
              Return <Code>2xx</Code> quickly and do your work afterwards.
            </p>
          </Section>

          {/* ── SSO ──────────────────────────────────────────────────────── */}
          <Section id="sso" title="Magic-link SSO: lessons inside your own site">
            <p>
              Put a pupil&apos;s lessons on <em>your</em> portal. They click through and land already
              signed in. No second password to remember, and none to reset.
            </p>

            <h3 className="mt-8 font-display text-base font-semibold tracking-tight">How it works</h3>
            <ol className="my-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed marker:font-mono marker:text-[var(--kat-clay)]">
              <li>
                Your <strong>server</strong> asks us for a launch token for one pupil, using your API
                key.
              </li>
              <li>
                Your <strong>page</strong> drops that token into an iframe URL, after the{" "}
                <Code>#</Code>.
              </li>
              <li>
                The frame exchanges it for a session and the pupil is in their lessons.
              </li>
            </ol>

            <Note>
              <strong>Why the token is minted server-side.</strong> The only alternative is putting
              your API key on the page, where any visitor could read it and sign in as any child in
              your school. There is no version of this that is safe to do purely in JavaScript, and
              we would rather say so than ship you a convenient hole.
            </Note>

            <CopyBlock
              label="1. on your server: mint a token"
              code={`curl -X POST https://schools.kindleatechie.com/api/school/embed/token \\
  -H "Authorization: Bearer $KAT_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "ref": "STU-0417" }'

# → { "token": "eyJhbGciOi…", "expiresIn": 60 }`}
            />
            <CopyBlock
              label="2. on your page: put it after the #"
              language="html"
              code={`<iframe
  src="https://schools.kindleatechie.com/embed/your-school#t=THE_TOKEN"
  style="width:100%;height:720px;border:0"
  referrerpolicy="no-referrer"
></iframe>`}
            />

            <h3 className="mt-8 font-display text-base font-semibold tracking-tight">The token</h3>
            <ul className="my-4 list-disc space-y-2 pl-5 text-sm leading-relaxed marker:text-[var(--kat-clay)]">
              <li>
                <strong>Lives 60 seconds.</strong> Mint it when the page is served, not in advance.
              </li>
              <li>
                <strong>Works once.</strong> Reusing it fails. Mint a fresh one per page load.
              </li>
              <li>
                <strong>Goes after the <Code>#</Code>, never after a <Code>?</Code>.</strong> A URL
                fragment is never sent to a server, so the token stays out of access logs, out of{" "}
                <Code>Referer</Code> headers, and out of any analytics on your page. A query string
                would leak it into all three.
              </li>
            </ul>

            <h3 className="mt-8 font-display text-base font-semibold tracking-tight">Requirement: register your page&apos;s address</h3>
            <p>
              Your school admin must add the exact origin the iframe will sit on (e.g.{" "}
              <Code>https://portal.yourschool.edu.ng</Code>) in the KAT dashboard.{" "}
              <strong>Until they do, the frame will not load anywhere.</strong>
            </p>
            <p className="text-[var(--kat-text-2)]">
              We do not accept wildcards. <Code>https://*.yourschool.edu.ng</Code> would let any
              subdomain you have forgotten about, an old WordPress, a student club page, frame a
              signed-in child&apos;s session. List the two or three real addresses instead.
            </p>

            <h3 className="mt-8 font-display text-base font-semibold tracking-tight">Safari</h3>
            <p>
              Safari and some privacy settings block the cookie an embedded frame needs. When that
              happens the frame does not break, it shows a single{" "}
              <strong>&ldquo;Open my lessons&rdquo;</strong> button that opens the same lesson in a
              tab, signed in exactly the same way. Nothing to configure; it just needs to be allowed
              to open a tab.
            </p>
          </Section>

          {/* ── Errors ───────────────────────────────────────────────────── */}
          <Section id="errors" title="Errors, limits, versioning">
            <CopyBlock
              label="every error"
              language="json"
              code={`{ "error": "This key does not have the ROSTER_WRITE scope.", "code": "insufficient_scope" }`}
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[30rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--kat-ink)] text-left">
                    <th className="py-2 pr-4 font-mono text-[0.68rem] uppercase tracking-[0.14em]">
                      Status
                    </th>
                    <th className="py-2 font-mono text-[0.68rem] uppercase tracking-[0.14em]">
                      Meaning
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--kat-line)]">
                  {[
                    ["400", "Malformed JSON or payload."],
                    ["401", "Key missing, wrong, or revoked."],
                    ["403", "Key is valid but lacks the scope."],
                    ["404", "Not found, or not yours. We do not distinguish."],
                    ["409", "Refused for safety (e.g. the 20% rule). Nothing changed."],
                    ["422", "Understood, but rejected: over seats, unsafe URL, key reuse."],
                    ["429", "Rate limited. Wait for Retry-After."],
                  ].map(([code, meaning]) => (
                    <tr key={code}>
                      <td className="py-2.5 pr-4 align-top font-mono text-[0.8rem] text-[var(--kat-clay)]">
                        {code}
                      </td>
                      <td className="py-2.5 align-top text-[var(--kat-text-2)]">{meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="mt-8 font-display text-base font-semibold tracking-tight">Rate limit</h3>
            <p>
              <strong>600 requests per minute, per key.</strong> Over it you get a <Code>429</Code>{" "}
              with a <Code>Retry-After</Code> header in seconds. Honour it rather than guessing.
            </p>

            <h3 className="mt-8 font-display text-base font-semibold tracking-tight">Versioning</h3>
            <p>
              <Code>v1</Code> is stable. Breaking changes ship as <Code>v2</Code>;{" "}
              <Code>v1</Code> keeps working. We may <em>add</em> fields to a <Code>v1</Code> response,
              so <strong>ignore fields you do not recognise</strong> rather than failing on them.
            </p>
          </Section>

          {/* ── Go-live ──────────────────────────────────────────────────── */}
          <Section id="golive" title="Go-live checklist">
            <Checklist
              icon
              items={[
                <>
                  API key stored as a <strong>server-side environment variable</strong>, not in the
                  codebase, not in the page.
                </>,
                <>
                  A separate key per system, each with only the scopes it needs.
                </>,
                <>
                  <Code>Idempotency-Key</Code> on every roster sync.
                </>,
                <>
                  Webhook signature <strong>verified</strong>, using the raw body, with the 5-minute
                  timestamp check.
                </>,
                <>
                  <Code>deactivate_missing</Code> tested against a <em>real</em> export before you
                  trust it on a live class.
                </>,
                <>Your iframe origin registered in the dashboard.</>,
                <>
                  A plan for rotating the key. You will need to one day, and it is much easier when
                  it is not an emergency.
                </>,
              ]}
            />
          </Section>

          <Rule />

          <div className="mt-10 border border-[var(--kat-line)] bg-[var(--kat-surface)] p-6">
            <h2 className="font-display text-xl font-semibold">Stuck?</h2>
            <p className="mt-2 text-[var(--kat-text-2)]">
              Email{" "}
              <a href="mailto:hello@kindleatechie.com" className="underline decoration-[var(--kat-clay)] decoration-2 underline-offset-2 transition hover:text-[var(--kat-clay)]">
                hello@kindleatechie.com
              </a>{" "}
              with your school name and the request you are making.{" "}
              <strong>Never send us your API key</strong>. We will never ask for it, and anyone who
              does is not us.
            </p>
          </div>
        </article>
      </div>
    </main>
  );
}

/* ── small building blocks ─────────────────────────────────────────────── */

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 pt-14">
      <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
      <div className="mt-5 space-y-4 leading-relaxed [&_p]:text-[var(--kat-ink)]">{children}</div>
    </section>
  );
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="whitespace-nowrap border border-[var(--kat-line)] bg-[var(--kat-surface)] px-1.5 py-0.5 font-mono text-[0.8em] text-[var(--kat-clay)]">
      {children}
    </code>
  );
}

function Rule() {
  return <hr className="mt-12 border-t border-[var(--kat-ink)]" />;
}

function Note({ children }: { children: ReactNode }) {
  return (
    <aside className="my-5 border-l-2 border-[var(--kat-pine)] bg-[var(--kat-surface)] py-3 pl-4 pr-3 text-sm leading-relaxed text-[var(--kat-text-2)]">
      {children}
    </aside>
  );
}

/** The dangerous parts, where they will actually be read. */
function Danger({ title, children }: { title: string; children: ReactNode }) {
  return (
    <aside className="my-6 border border-[var(--kat-clay)] bg-[var(--kat-surface)] p-4">
      <p className="flex items-center gap-2 font-display text-sm font-semibold text-[var(--kat-clay)]">
        <AlertTriangle className="size-4 shrink-0" />
        {title}
      </p>
      <div className="mt-2 text-sm leading-relaxed text-[var(--kat-ink)]">{children}</div>
    </aside>
  );
}

function Defn({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="border-t border-[var(--kat-line)] py-4 first:border-t-0 first:pt-0">
      <p className="font-mono text-sm font-medium text-[var(--kat-clay)]">{term}</p>
      <p className="mt-1.5 text-sm leading-relaxed">{children}</p>
    </div>
  );
}

function Checklist({ items, icon }: { items: ReactNode[]; icon?: boolean }) {
  return (
    <ul className="my-4 space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-sm leading-relaxed">
          {icon ? (
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--kat-pine)]" />
          ) : (
            <span className="mt-[0.55rem] size-1.5 shrink-0 bg-[var(--kat-clay)]" />
          )}
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
