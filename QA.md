# QA.md. KAT App Quality Assurance

## Automated Checks

Run these before every merge to `main`. All three must pass clean.

```bash
npm test              # 199 unit + integration tests (Vitest)
npm run typecheck     # TypeScript, no emit
npm run lint          # ESLint flat config
```

### E2E Browser Tests (Playwright, requires dev server)

```bash
npm run dev           # terminal 1, start dev server
npm run test:e2e      # terminal 2, headless Chromium
npm run test:e2e:ui   # interactive UI mode
```

Covered by `e2e/`:
- `health.spec.ts`. `GET /api/health` returns 200 + `{ status: "ok" }`
- `auth.spec.ts`, login page renders; invalid credentials show error; 4 protected routes redirect to `/login`
- `authenticated.spec.ts`, student dashboard loads without redirect; enrollment list API returns 200 (requires `e2e/fixtures/student.json`, generate with `npx playwright codegen`)

### Load Tests (Artillery, requires running server)

```bash
npm run load:smoke    # pre-deploy: 2→10 RPS × 60 s, p95 < 500 ms, error rate < 1%
npm run load:soak     # post-deploy: 5→20→5 RPS × 7 min, p99 < 2 s, error rate < 2%

# For authenticated routes:
export STUDENT_TOKEN="next-auth.session-token=<value>"
```

---

## Manual QA Checklist

### Auth & Session

- [ ] **Login (credentials)**, navigate to `/login`, enter `student@example.com` / `Passw0rd!`, verify redirect to `/dashboard/student`
- [ ] **Login (invalid password)**, enter wrong password, verify error message appears, no redirect
- [ ] **Login (Google OAuth)**, if `NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED=true`, verify Google button appears and initiates OAuth flow
- [ ] **Protected route redirect**, visit `/dashboard/student` while logged out, verify redirect to `/login`
- [ ] **Logout**, click logout, verify session is cleared and subsequent visit to `/dashboard` redirects to `/login`
- [ ] **Session revocation**, log in as student in browser A; in Security tab, revoke all sessions; navigate to `/dashboard/student` → should redirect to `/login`
- [ ] **Turnstile bot protection**, login form should show Cloudflare Turnstile widget (requires `NEXT_PUBLIC_TURNSTILE_SITE_KEY`)

### Role-Based Dashboards

- [ ] **Student**. `/dashboard/student` loads enrollment list, module gate status visible
- [ ] **Instructor**. `/dashboard/instructor` loads assigned programs/cohorts
- [ ] **Admin**. `/dashboard/admin` loads org management UI
- [ ] **Fellow**. `/dashboard/fellow` loads fellow-specific view
- [ ] **Parent**. `/dashboard/parent` loads linked student info
- [ ] **Super Admin**. `/dashboard/super-admin` loads cross-org controls
- [ ] **Role enforcement**, log in as Student, manually navigate to `/dashboard/admin` → should get 403 or redirect

### Enrollment & Billing

- [ ] **Enroll in program**, student enrols in a program, `Enrollment` record created, billing period starts
- [ ] **Enrollment list**. `GET /api/enrollments` returns only the student's own enrollments (not another org's)
- [ ] **Reactivate enrollment**, if enrollment is inactive, PATCH re-activates it correctly

### Module Gate System

- [ ] **Quiz/assessment submission**, submit a knowledge assessment, auto-grading runs, `ModuleGateStatus` updated
- [ ] **Capstone upload**, upload a project file via presigned URL, instructor review queue shows the submission
- [ ] **Instructor evaluation**, instructor submits evaluation, gate advances correctly
- [ ] **Module advance**, student who passes all 3 gates can access the next module; one who hasn't cannot

### Payments (Paystack)

- [ ] **Initialize payment**. `POST /api/payments/initialize` with valid `programId` returns a Paystack authorization URL
- [ ] **Rate limiting**, initialize payment 11+ times in an hour → 429 response
- [ ] **Webhook (valid)**, send a Paystack webhook with correct HMAC-SHA512 signature → enrollment activated
- [ ] **Webhook (tampered)**, send webhook with wrong signature → 401, no side effects

### File Uploads (R2)

- [ ] **Project upload**, generate presigned URL, upload file directly from browser to R2, key stored in DB
- [ ] **Assessment resource upload (allowed)**, try an allowed MIME type (e.g. PDF) → upload URL returned
- [ ] **Assessment resource upload (blocked)**, try a disallowed type (e.g. `.exe`) → 400 "File type not allowed"
- [ ] **File access**, stored key constructs correct public URL via `R2_PUBLIC_URL`

### Messaging (SSE)

- [ ] **Send message**, student sends a message in a conversation, recipient sees it in real time via SSE
- [ ] **Rate limiting**, send 11 messages in 10 seconds → 429 response
- [ ] **Permission matrix**, verify RBAC: a role pair blocked in `src/lib/rbac.ts` cannot send messages to each other

### Meetings (Jitsi)

- [ ] **Create meeting**, instructor creates a meeting, JWT-gated Jitsi URL is generated
- [ ] **Join meeting**, student joins via the URL, Jitsi loads with correct room and JWT
- [ ] **Recording webhook**. Jibri webhook fires after recording; verify HMAC check passes and R2 upload is triggered

### Code Execution (Judge0)

- [ ] **Monaco editor**, code editor loads on a lesson with a code content type
- [ ] **Run code**, submit code, Judge0 returns stdout/stderr, result displayed correctly

### Certificates

- [ ] **Issue certificate**, complete a program, certificate is generated with a `credentialId`
- [ ] **Public verification**, navigate to `/certificate/[credentialId]` while logged out → certificate details visible

### Health & Observability

- [ ] **Health endpoint**. `GET /api/health` returns `{ status: "ok", timestamp: ".." }` with status 200
- [ ] **Sentry**, trigger a deliberate error, verify the event appears in the Sentry dashboard

### PWA

- [ ] **Service worker**, with `NEXT_PUBLIC_ENABLE_SW_DEV=true`, verify `sw.js` registers in devtools Application tab
- [ ] **Offline fallback**, disconnect network after first load, navigate to a cached page → served from SW cache

---

## Seed Accounts (password: `Passw0rd!`)

| Role | Email |
|---|---|
| Super Admin | superadmin@example.com |
| Admin | admin@example.com |
| Instructor | instructor@example.com |
| Fellow | fellow@example.com |
| Student | student@example.com |
| Parent | parent@example.com |

Run `npm run prisma:seed` to populate these accounts.
