# KAT — Kindle A Techie

A full-stack Learning Management System (LMS) built with Next.js 15, TypeScript, Prisma, and PostgreSQL.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| ORM | Prisma |
| Database | PostgreSQL (Neon) |
| Auth | NextAuth.js |
| Styling | Tailwind CSS + shadcn/ui |
| Payments | Paystack |
| Meetings | Daily.co / Zoho Meet |
| Email | Nodemailer |
| File uploads | Cloudinary |
| Animations | Framer Motion |
| Validation | Zod |

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
# Fill in DATABASE_URL, DIRECT_URL, NEXTAUTH_SECRET, PAYSTACK_*, CLOUDINARY_*, etc.
# For Neon: DATABASE_URL = pooled connection string, DIRECT_URL = direct (non-pooled)
# Optional: REDIS_URL for horizontally scaled realtime messaging
# Optional: NEXT_PUBLIC_ENABLE_SW_DEV=true for service worker in dev

# 3. Push schema to database
npx prisma db push

# 4. Seed demo data
npx prisma db seed

# 5. Start dev server
npm run dev
```

Open `http://localhost:3000`.

## Seed Accounts

All accounts use the password `Passw0rd!`

| Email | Role |
|---|---|
| superadmin@kindleatechie.com | SUPER_ADMIN |
| admin@kindleatechie.com | ADMIN |
| instructor@kindleatechie.com | INSTRUCTOR |
| fellow@kindleatechie.com | FELLOW |
| student@kindleatechie.com | STUDENT |
| parent@kindleatechie.com | PARENT |

## Features

### Access & Roles
- Six roles: Super Admin, Admin, Instructor, Fellow, Student, Parent
- Role-based dashboards with scoped navigation and permissions
- Organisation codes for self-service role registration; invite-only for staff and SA
- Parent-student linking with delegated payment and notifications

### Curriculum
- Versioned curriculum builder: programs → versions → modules → lessons → content blocks
- Content types: rich text, code, document, video, links
- Multi-block content queue — stage multiple blocks before submitting for review
- Content review workflow — instructors submit, admins/SA approve or reject

### Assessments
- Drag-and-drop question builder with three question types: multiple choice, true/false, open-ended
- Assessments are linked to modules for structured progression
- Verification workflow — requires Super Admin approval before learners can access
- Assessments close after first submission; retakes require an explicit grant from an instructor/admin
- Super Admin can toggle retake-grant permission per instructor/admin account
- Auto-grading for objective questions; manual grading queue for open-ended responses

### Badges & Certificates
- Badges: auto-awarded per module when all assessments in that module are passed
- Certificates: issued at program completion; Admin/Instructor requests require Super Admin approval
- Public certificate verification page at `/certificate/[credentialId]`

### Billing & Enrollment
- Monthly Paystack billing with 30-day periods, 3-day warning, 4-day grace, then suspension
- Billing cron at `POST /api/cron/enrollment-billing` (secured via `CRON_SECRET`)
- Manual enrollment by staff: Waived (no billing ever) or Billable (30-day cycle starts immediately)
- Discount/promo codes with percentage off

### Other
- Messaging with pinned messages, read receipts, and role-based permission matrix
- Realtime messaging via SSE; scales to multi-instance with Redis pub/sub when `REDIS_URL` is set
- Video meeting scheduling (Zoho Meet / Daily.co)
- Cohort management with fellow applications (including external/guest applicants)
- In-app notifications (INFO, WARNING, ERROR, SUCCESS)
- Analytics event tracking
- Dark mode scoped to the dashboard — marketing and auth pages are always light
- PWA support with service worker, offline fallback, and manifest

## Maintenance

Backfill Zoho meeting join URLs (dry-run first):

```bash
npm run backfill:meeting-join-urls
npm run backfill:meeting-join-urls -- --apply
npm run backfill:meeting-join-urls -- --apply --limit=20
```

## Project Structure

```
prisma/
  schema.prisma         # Full data model
  seed.ts               # Demo data

src/
  app/
    api/                # Route handlers (REST)
    dashboard/          # Dashboard pages
    certificate/        # Public certificate verification
  components/
    dashboard/          # All dashboard panels and shell
    ui/                 # shadcn/ui primitives
  lib/
    auth.ts             # NextAuth config
    prisma.ts           # Prisma client singleton
    badges.ts           # Module badge award logic
    email.ts            # Email builders and templates
    validators.ts       # Zod schemas shared across API routes
    rbac.ts             # Messaging permission matrix
```

## License

Private. All rights reserved.
