# KAT — Kindle A Techie

A full-stack Learning Management System (LMS) for KAT Academy, serving students aged 8–19 across Africa. Built with Next.js 15, TypeScript, Prisma, Jitsi Meet and PostgreSQL.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| ORM | Prisma |
| Database | PostgreSQL (Neon) |
| Auth | NextAuth.js (credentials + JWT) |
| Styling | Tailwind CSS + shadcn/ui |
| Animations | Framer Motion |
| Validation | Zod |
| Payments | Paystack |
| File Storage | Cloudflare R2 (S3-compatible) |
| Email | Nodemailer (SMTP) |
| Meetings | Jitsi Meet (self-hosted) + Jibri (recordings) |
| Realtime | SSE + Redis pub/sub (optional) |
| Rate Limiting | Upstash Redis |

---

## Getting Started

```bash
# 1. Install dependencies
npm install --legacy-peer-deps

# 2. Configure environment
cp .env.example .env.local
# See "Environment Variables" section below

# 3. Push schema to database
npx prisma migrate dev

# 4. Seed demo data
npx prisma db seed

# 5. Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

```bash
# ── Database ──────────────────────────────────────────────────────────────────
DATABASE_URL=          # Pooled Neon connection string
DIRECT_URL=            # Direct (non-pooled) Neon connection string

# ── Auth ──────────────────────────────────────────────────────────────────────
NEXTAUTH_URL=          # e.g. http://localhost:3000
NEXTAUTH_SECRET=       # openssl rand -base64 32

# ── Paystack ──────────────────────────────────────────────────────────────────
PAYSTACK_SECRET_KEY=
PAYSTACK_WEBHOOK_SECRET=   # Required — webhook signature verification

# ── Cloudflare R2 (file uploads) ──────────────────────────────────────────────
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=         # Public bucket base URL (e.g. https://pub-xxx.r2.dev)

# ── Email (SMTP) ──────────────────────────────────────────────────────────────
SMTP_HOST=
SMTP_PORT=             # 587 (default) or 465
SMTP_USER=
SMTP_PASS=
SMTP_FROM=             # e.g. KAT Learning <noreply@kindleatechie.com>

# ── Jitsi Meet + Jibri ────────────────────────────────────────────────────────
JITSI_DOMAIN=              # Your Jitsi VPS domain, e.g. meet.yourdomain.com
JITSI_APP_ID=              # App ID for JWT auth, e.g. kat-app
JITSI_APP_SECRET=          # Secret for signing Jitsi JWTs
JIBRI_WEBHOOK_SECRET=      # Shared secret for the Jibri recording-ready webhook

# ── Rate Limiting (Upstash Redis) ─────────────────────────────────────────────
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# ── Cron ──────────────────────────────────────────────────────────────────────
CRON_SECRET=           # Shared secret for securing cron endpoints

# ── Gemini (AI enrollment chat) ───────────────────────────────────────────────
GEMINI_API_KEY=                  # Google AI Studio key — enables the Kemi enrollment assistant

# ── Optional ──────────────────────────────────────────────────────────────────
REDIS_URL=                       # Enables Redis pub/sub for multi-instance realtime messaging
NEXT_PUBLIC_ENABLE_SW_DEV=true   # Enable service worker in development
```

---

## Seed Accounts

All seed accounts use the password `Passw0rd!`

| Email | Role |
|---|---|
| superadmin@kindleatechie.com | SUPER_ADMIN |
| admin@kindleatechie.com | ADMIN |
| instructor@kindleatechie.com | INSTRUCTOR |
| fellow@kindleatechie.com | FELLOW |
| student@kindleatechie.com | STUDENT |
| parent@kindleatechie.com | PARENT |

---

## Features

### Access & Roles
- Six roles: Super Admin, Admin, Instructor, Fellow, Student, Parent
- Role-based dashboards with scoped navigation and permissions
- Organisation codes for self-service role registration; invite-only for staff and Super Admin
- Parent–student linking with delegated payment handling and monthly digest emails

### Curriculum
- Versioned curriculum builder: Programs → Versions → Modules → Lessons → Content Blocks
- Content types: rich text, code, document, video, external links
- Multi-block content queue — stage multiple blocks before submitting for review
- Content review workflow — instructors submit, admins/Super Admin approve or reject

### Assessments
- Drag-and-drop question builder: multiple choice, true/false, open-ended
- Assessments linked to modules for structured progression
- Requires Super Admin verification before learners can access
- Closes after first submission; retakes require an explicit instructor/admin grant
- Super Admin can toggle retake-grant permission per instructor/admin account
- Auto-grading for objective questions; manual grading queue for open-ended responses

### Projects
- Students create standalone or program-linked projects with a required description and optional "How to Use" guide
- Direct browser-to-R2 uploads via presigned PUT URLs (max 20 MB per file, 10 files per project)
- Submission workflow: Draft → Submitted → Approved / Needs Work / Rejected
- Instructor/admin feedback thread per project with edit and delete support
- Approval history: each review action is recorded with reviewer name and timestamp
- Instructors and admins can upload scoped asset files per project for students to download
- Approved projects get a shareable public link at `/showcase/[projectId]` (ISR, 5-minute revalidation)
- Rate limiting on create, upload, feedback, and status-change endpoints

### Badges & Certificates
- Badges auto-awarded per module when all assessments in that module are passed
- Certificates issued on program completion; Admin/Instructor requests require Super Admin approval
- Public certificate verification at `/certificate/[credentialId]`

### Billing & Enrollment
- Monthly Paystack billing: 30-day period → 3-day warning → 4-day grace → suspension
- Billing cron at `POST /api/cron/enrollment-billing` (secured via `CRON_SECRET`)
- Manual enrolment by staff: Waived (no billing) or Billable (30-day cycle starts immediately)
- Discount/promo codes with percentage-off support
- Payment history with cursor-based pagination

### Messaging & Realtime
- Direct and group message threads with pinned messages and read receipts
- Role-based permission matrix (who can message whom)
- Realtime delivery via SSE; scales horizontally with Redis pub/sub when `REDIS_URL` is set

### Meetings
- Self-hosted Jitsi Meet scheduling with JWT authentication
- Role-based moderator rights (hosts get moderator JWT; students do not)
- Auto-recording policy: sessions with students/fellows trigger `AUTO_REQUIRED` mode via Jibri
- Jibri webhook at `POST /api/meetings/recording-ready` (HMAC-SHA256 verified) saves recording URLs
- Signed join URLs generated per-user at join time (4-hour JWT validity)

### Security
- Rate limiting on auth endpoints: login (10/15 min), register (5/hr), forgot-password (3/15 min)
- Rate limiting on project endpoints: create (10/hr), upload (30/hr), feedback (60/hr), status change (100/hr)
- Security headers on all routes: `X-Frame-Options`, `X-Content-Type-Options`, `HSTS`, `Referrer-Policy`, `Permissions-Policy`
- Paystack webhook signature verification (hard-required)

### Other
- Cohort management with fellow applications (including external/guest applicants)
- In-app notifications (INFO, WARNING, ERROR, SUCCESS)
- Analytics event tracking with monthly aggregation
- Partner enquiry form at `/partners` with email notification to `hello@kindleatechie.com`
- Dark mode scoped to the dashboard — marketing and auth pages are always light
- PWA: service worker, offline fallback, web manifest

---

## Cron Jobs

| Endpoint | Schedule | Purpose |
|---|---|---|
| `POST /api/cron/enrollment-billing` | Daily | Charge renewals, send reminders, suspend overdue enrolments |
| `POST /api/cron/parent-digest` | Monthly | Send parent progress digest emails |

All cron endpoints require the `Authorization: Bearer <CRON_SECRET>` header.

---

## Maintenance

Backfill Zoho meeting join URLs (dry-run first):

```bash
npm run backfill:meeting-join-urls
npm run backfill:meeting-join-urls -- --apply
npm run backfill:meeting-join-urls -- --apply --limit=20
```

---

## Project Structure

```
prisma/
  schema.prisma           # Full data model
  seed.ts                 # Demo seed data

public/
  kindle-a-techie.svg     # Brand logo
  manifest.webmanifest    # PWA manifest

src/
  app/
    api/
      assessments/        # Assessment CRUD, submissions, retakes
      auth/               # NextAuth, password reset, forgot-password
      badges/             # Badge queries
      certificates/       # Certificate issuance and verification
      cohorts/            # Cohort management
      cron/               # Scheduled job endpoints
      curriculum/         # Versioned curriculum builder
      enrollments/        # Enrolment management
      fellows/            # Fellowship applications
      messages/           # Messaging threads and SSE stream
      meetings/           # Jitsi meeting scheduling + Jibri webhook
      notifications/      # In-app notifications
      partners/           # Partner enquiry form handler
      payments/           # Paystack billing, webhooks, history
      programs/           # Program management
      projects/           # Project CRUD, R2 uploads, feedback, assets, status reviews, showcase
      super-admin/        # Admin account and invite management
      users/              # Registration, profile, avatar
      waitlist/           # Landing page waitlist
    dashboard/            # All dashboard pages by role
    showcase/             # Public project showcase index (/showcase)
    showcase/[projectId]/ # ISR public project detail page
    certificate/          # Public certificate verification
    partners/             # Partner enquiry page

  components/
    dashboard/            # Dashboard panels, shell, nav
    marketing/            # Landing page sections and tokens
    ui/                   # shadcn/ui primitives

  lib/
    auth.ts               # NextAuth config and JWT
    badges.ts             # Module badge award logic
    email.ts              # Email builders, templates, SMTP transport
    prisma.ts             # Prisma client singleton
    r2.ts                 # Cloudflare R2 client and presigned URL helpers
    ratelimit.ts          # Upstash rate limiter instances
    rbac.ts               # Messaging permission matrix
    validators.ts         # Shared Zod schemas
    jitsi.ts              # Jitsi JWT generation, room naming, status helpers
```

---

## License

Private. All rights reserved. © Kindle A Techie.
