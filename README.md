# KAT Platform (Next.js + Prisma + NextAuth)

Production-grade learning platform foundation with:

- Multi-role authentication: `SUPER_ADMIN`, `ADMIN`, `INSTRUCTOR`, `FELLOW`, `STUDENT`, `PARENT`
- Single-tenant organization model with automatic user assignment
- Prisma/PostgreSQL schema with 20+ interconnected models
- Role-aware messaging with read receipts and permission matrix
- Assessment engine with objective auto-grading + manual grading flow
- Payments via Paystack with Stripe-ready provider abstraction
- Zoho Meeting session creation for live meeting scheduling with recording policy flags
- Role dashboards and analytics endpoints
- Animated UI with Tailwind + Framer Motion + Sonner toasts

## Stack

- Frontend: Next.js App Router, React, TypeScript, Tailwind CSS, Framer Motion
- Backend: Next.js API Routes (Route Handlers)
- Database: PostgreSQL + Prisma
- Realtime: SSE + optional Redis pub/sub fan-out for multi-instance messaging
- Auth: NextAuth.js JWT credentials flow + bcrypt
- Payments: Paystack integration (`src/lib/payments`), Stripe scaffold
- Video: Zoho Meeting integration (`src/lib/zoho-meeting.ts`)

## Quick Start

1. Install dependencies

```bash
npm install
```

2. Configure environment

```bash
cp .env.example .env
```

Optional for horizontally scaled realtime messaging:

- Set `REDIS_URL` (for example: `redis://localhost:6379`)
- Optionally override `REDIS_MESSAGES_CHANNEL`

Optional for PWA testing on local development:

- Set `NEXT_PUBLIC_ENABLE_SW_DEV=true` to register service worker in dev

If you use Neon:

- Set `DATABASE_URL` to the pooled connection string (`...-pooler...` host).
- Set `DIRECT_URL` to the direct/non-pooled connection string (no `-pooler` in host).

3. Initialize Prisma

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

4. Run app

```bash
npm run dev
```

Open `http://localhost:3000`.

## Maintenance

Backfill old Zoho meeting URLs safely (dry-run first):

```bash
npm run backfill:meeting-join-urls
```

Apply updates:

```bash
npm run backfill:meeting-join-urls -- --apply
```

Optional limit for staged updates:

```bash
npm run backfill:meeting-join-urls -- --apply --limit=20
```

Include `path_key_mismatch` cases only if you explicitly want them:

```bash
npm run backfill:meeting-join-urls -- --apply --include-path-mismatch
```

## Demo Credentials

After seed, these accounts exist (password: `Passw0rd!`):

- `superadmin@kat.africa`
- `admin@kat.africa`
- `instructor@kat.africa`
- `fellow@kat.africa`
- `student@kat.africa`
- `parent@kat.africa`

All public registrations are auto-assigned to the default organization (`KAT-ORG` by default).

## API Surface

- `/api/auth/[...nextauth]`
- `/api/users/register`
- `/api/users/profile`
- `/api/messages`
- `/api/messages/contacts`
- `/api/assessments`
- `/api/assessments/submissions`
- `/api/payments`
- `/api/payments/initialize`
- `/api/payments/verify`
- `/api/meetings`
- `/api/programs`
- `/api/enrollments`
- `/api/notifications`
- `/api/analytics`
- `/api/super-admin/invites`
- `/api/super-admin/invites/accept`
- `/api/super-admin/admin-invites`
- `/api/super-admin/admin-invites/accept`
- `/api/super-admin/admin-accounts`
- `/api/integrations/zoho/start`
- `/api/integrations/zoho/callback`
- `/api/integrations/zoho/connection`

## Notes

- Messaging permissions are enforced server-side in `src/lib/rbac.ts`.
- Realtime messaging works in-memory by default and automatically uses Redis pub/sub when `REDIS_URL` is set.
- PWA support includes manifest, offline fallback route (`/offline`), and service worker caching.
- Assessment objective questions are auto-graded on submission.
- Open-ended answers move submissions to manual grading queue.
- Paystack verification creates receipts for successful payments.
- Meeting status is derived from schedule (`UPCOMING`, `LIVE`, `ENDED`).
- Zoho Meeting can be connected via in-app OAuth (`Dashboard -> Access`) or env tokens.
- Meetings that include `STUDENT` or `FELLOW` are marked `AUTO_REQUIRED` for recording and can sync recording links from Zoho.
- Public registration cannot create `SUPER_ADMIN`, `ADMIN`, or `INSTRUCTOR`.
- Super admins are created through invite-only flow at `/register/super-admin`.
- Admins and instructors are created through invite-only flow at `/register/staff`.
