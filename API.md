# KAT for Schools. API v1

> **The canonical developer documentation is the web page**, not this file:
> **<https://kindleatechie.com/schools/developers>**
> (source: `src/components/marketing/schools/developer-docs.tsx`)
>
> This file is a one-screen cheat sheet for people working in the repo. **Do not restate the spec
> here.** Two copies of an API spec drift, and the copy a school's developer actually reads would be
> the stale one, so anything a school needs belongs on the page, and only on the page.

---

## Cheat sheet

**Base URL:** `https://schools.kindleatechie.com/api/v1`
**Auth:** `Authorization: Bearer kat_sk_…` (a `SchoolApiKey`; SHA-256 hashed, prefix stored for display)

`schoolId` **always comes from the key.** No endpoint accepts one, see the harness rule in
`src/__tests__/security/route-authorization.test.ts`.

| Endpoint | Scope |
|---|---|
| `GET /classes` | `CLASSES_READ` |
| `POST /roster` | `ROSTER_WRITE` |
| `GET /students/{student_id}/progress` | `PROGRESS_READ` |
| `GET /results` | `RESULTS_READ` |
| `GET POST DELETE /webhooks` | `PROGRESS_READ` |
| `POST /api/school/embed/token` (magic-link SSO) | `EMBED_MINT` |

## Where things live

| Concern | File |
|---|---|
| Auth, scope, rate limit, idempotency (the one chokepoint) | `src/lib/api-v1.ts` |
| Key issue / verify / soft-revoke | `src/lib/school-api-key.ts` |
| **The only path that creates children** | `src/lib/roster-sync.ts` |
| Webhooks: SSRF filter, HMAC, outbox, backoff | `src/lib/school-webhook.ts` |
| Embed launch/session tokens | `src/lib/school-embed.ts` |
| Outbox drain (cron, every 5 min, see `vercel.json`) | `src/app/api/cron/webhook-drain/` |

## Invariants the build enforces

- Every v1 handler goes through `authorizeV1()` **and names a scope**.
- No v1 route reads `schoolId` from the request.
- No v1 route takes a name or email from a query string (enumeration oracle).
- The CSV importer and `POST /v1/roster` both go through `syncRoster()`, never a second
  child-creation path.
- Webhook URLs are checked against the **resolved IP**; the drain **never reads the response body**
  (keeps the residual SSRF blind).
- Every cron route in code is scheduled in `vercel.json`.
