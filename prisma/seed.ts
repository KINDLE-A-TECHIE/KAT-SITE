import bcrypt from "bcryptjs";
import {
  PrismaClient,
  UserRole,
  ProgramLevel,
  AssessmentType,
  AssessmentVerificationStatus,
  QuestionType,
  PaymentProvider,
  PaymentStatus,
  MeetingStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

async function createUser(data: {
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  organizationId?: string;
  password: string;
}) {
  const hash = await bcrypt.hash(data.password, 12);
  return prisma.user.upsert({
    where: { email: data.email },
    update: { firstName: data.firstName, lastName: data.lastName, role: data.role, organizationId: data.organizationId, passwordHash: hash },
    create: {
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role,
      organizationId: data.organizationId,
      passwordHash: hash,
      profile: {
        create: {
          headline: `${data.role.replace(/_/g, " ").toLowerCase()} at KAT`,
          bio: `${data.firstName} ${data.lastName} is part of the KAT learning platform.`,
        },
      },
    },
  });
}

async function main() {
  // ── Organisation ────────────────────────────────────────────────────────────
  const org = await prisma.organization.upsert({
    where: { code: "KAT-ORG" },
    update: { name: "KAT Learning", domain: "kindleatechie.com" },
    create: { name: "KAT Learning", code: "KAT-ORG", domain: "kindleatechie.com" },
  });

  // ── Users (one per role) ─────────────────────────────────────────────────────
  const superAdmin = await createUser({ email: "superadmin@kindleatechie.com", firstName: "System",  lastName: "Owner",      role: UserRole.SUPER_ADMIN, organizationId: org.id, password: "Passw0rd!" });
  const admin      = await createUser({ email: "admin@kindleatechie.com",      firstName: "Amina",   lastName: "Admin",      role: UserRole.ADMIN,       organizationId: org.id, password: "Passw0rd!" });
  const instructor = await createUser({ email: "instructor@kindleatechie.com", firstName: "Ifeanyi", lastName: "Instructor", role: UserRole.INSTRUCTOR,  organizationId: org.id, password: "Passw0rd!" });
  const fellow     = await createUser({ email: "fellow@kindleatechie.com",     firstName: "Fola",    lastName: "Fellow",     role: UserRole.FELLOW,      organizationId: org.id, password: "Passw0rd!" });
  const student    = await createUser({ email: "student@kindleatechie.com",    firstName: "Sade",    lastName: "Student",    role: UserRole.STUDENT,     organizationId: org.id, password: "Passw0rd!" });
  const parent     = await createUser({ email: "parent@kindleatechie.com",     firstName: "Peter",   lastName: "Parent",     role: UserRole.PARENT,      organizationId: org.id, password: "Passw0rd!" });

  // ── Invite / org codes ───────────────────────────────────────────────────────
  for (const [code, role, createdById] of [
    ["KAT-ADMIN-2026",      UserRole.ADMIN,      superAdmin.id],
    ["KAT-INSTRUCTOR-2026", UserRole.INSTRUCTOR, admin.id],
    ["KAT-FELLOW-2026",     UserRole.FELLOW,     admin.id],
  ] as const) {
    await prisma.organizationCode.upsert({
      where: { code },
      update: { role, organizationId: org.id, createdById },
      create: { code, role, organizationId: org.id, createdById },
    });
  }

  // ── Relationships ────────────────────────────────────────────────────────────
  await prisma.parentStudent.upsert({
    where: { parentId_childId: { parentId: parent.id, childId: student.id } },
    update: {},
    create: { parentId: parent.id, childId: student.id },
  });

  await prisma.mentorship.upsert({
    where: { fellowId_studentId: { fellowId: fellow.id, studentId: student.id } },
    update: { active: true, assignedById: admin.id },
    create: { fellowId: fellow.id, studentId: student.id, assignedById: admin.id },
  });

  // ── Programme → Cohort → Enrolment ─────────────────────────────────────────
  const program = await prisma.program.upsert({
    where: { slug: "full-stack-innovators" },
    update: { name: "Full Stack Innovators", monthlyFee: 120000, durationWeeks: 16, level: ProgramLevel.ADVANCED, organizationId: org.id },
    create: { name: "Full Stack Innovators", slug: "full-stack-innovators", description: "Advanced track focused on full-stack application development.", level: ProgramLevel.ADVANCED, durationWeeks: 16, monthlyFee: 120000, organizationId: org.id },
  });

  const cohortData = { name: "Innovators 2026 Cohort", startsAt: new Date("2026-01-10T08:00:00Z"), endsAt: new Date("2026-05-31T18:00:00Z"), programId: program.id, organizationId: org.id, applicationOpen: true, externalApplicationFee: 5000 };
  const existingCohort = await prisma.cohort.findFirst({ where: { name: cohortData.name, organizationId: org.id } });
  const cohort = existingCohort
    ? await prisma.cohort.update({ where: { id: existingCohort.id }, data: cohortData })
    : await prisma.cohort.create({ data: { ...cohortData, capacity: 100 } });

  const enrollment = await prisma.enrollment.upsert({
    where: { userId_programId: { userId: student.id, programId: program.id } },
    update: {},
    create: { userId: student.id, programId: program.id },
  });

  // ── Fellow application (approved — links fellow to cohort) ───────────────────
  await prisma.fellowApplication.upsert({
    where: { applicantId_cohortId: { applicantId: fellow.id, cohortId: cohort.id } },
    update: { status: "APPROVED", reviewedAt: new Date("2026-01-05T10:00:00Z"), reviewedById: admin.id },
    create: {
      applicantId: fellow.id,
      cohortId: cohort.id,
      motivation: "I am passionate about mentoring students and contributing to KAT's mission.",
      status: "APPROVED",
      isExternalApplicant: false,
      reviewedAt: new Date("2026-01-05T10:00:00Z"),
      reviewedById: admin.id,
    },
  });

  // ── Fellow program enrollment ────────────────────────────────────────────────
  await prisma.enrollment.upsert({
    where: { userId_programId: { userId: fellow.id, programId: program.id } },
    update: {},
    create: { userId: fellow.id, programId: program.id },
  });

  // ── Curriculum → Version → Module ───────────────────────────────────────────
  const curriculum = await prisma.curriculum.upsert({
    where: { programId: program.id },
    update: {},
    create: { programId: program.id, organizationId: org.id },
  });

  const existingVersion = await prisma.curriculumVersion.findFirst({
    where: { curriculumId: curriculum.id },
    select: { id: true },
  });
  const curriculumVersion = existingVersion
    ? await prisma.curriculumVersion.findUniqueOrThrow({ where: { id: existingVersion.id } })
    : await prisma.curriculumVersion.create({
        data: {
          curriculumId: curriculum.id,
          versionNumber: 1,
          label: "v1.0",
          changelog: "Initial curriculum version.",
          createdById: superAdmin.id,
          isActive: true,
        },
      });

  const existingModule = await prisma.module.findFirst({
    where: { versionId: curriculumVersion.id, title: "React Fundamentals" },
    select: { id: true },
  });
  const reactModule = existingModule
    ? await prisma.module.findUniqueOrThrow({ where: { id: existingModule.id } })
    : await prisma.module.create({
        data: {
          versionId: curriculumVersion.id,
          title: "React Fundamentals",
          description: "Core concepts of React including components, state, and hooks.",
          sortOrder: 0,
          badge: { create: { name: "React Fundamentals", icon: "⚛️", color: "#61DAFB" } },
        },
      });

  // ── Assessment (idempotent via title + program) ──────────────────────────────
  const existingAssessment = await prisma.assessment.findFirst({
    where: { title: "React Fundamentals Checkpoint", programId: program.id },
    select: { id: true },
  });
  if (existingAssessment) {
    await prisma.assessment.update({
      where: { id: existingAssessment.id },
      data: {
        moduleId: reactModule.id,
        verificationStatus: AssessmentVerificationStatus.APPROVED,
        verifiedById: superAdmin.id,
        verifiedAt: new Date("2026-03-01T10:00:00Z"),
      },
    });
  } else {
    await prisma.assessment.create({
      data: {
        title: "React Fundamentals Checkpoint",
        description: "Objective + open-ended assessment for the React module.",
        type: AssessmentType.QUIZ,
        totalPoints: 20,
        passScore: 12,
        published: true,
        verificationStatus: AssessmentVerificationStatus.APPROVED,
        verifiedById: superAdmin.id,
        verifiedAt: new Date("2026-03-01T10:00:00Z"),
        dueDate: new Date("2026-06-01T12:00:00Z"),
        programId: program.id,
        moduleId: reactModule.id,
        createdById: instructor.id,
        questions: {
          create: [
            {
              prompt: "React is mainly used for ____.",
              type: QuestionType.MULTIPLE_CHOICE,
              points: 5,
              sortOrder: 1,
              options: {
                create: [
                  { label: "Building user interfaces", value: "ui",     isCorrect: true  },
                  { label: "Managing servers",          value: "server", isCorrect: false },
                  { label: "Relational databases",      value: "db",     isCorrect: false },
                ],
              },
            },
            {
              prompt: "The Virtual DOM improves rendering performance.",
              type: QuestionType.TRUE_FALSE,
              points: 5,
              answerKey: "true",
              sortOrder: 2,
              options: {
                create: [
                  { label: "True",  value: "true",  isCorrect: true  },
                  { label: "False", value: "false", isCorrect: false },
                ],
              },
            },
            {
              prompt: "Explain when you would choose context over prop drilling in a React app.",
              type: QuestionType.OPEN_ENDED,
              points: 10,
              sortOrder: 3,
            },
          ],
        },
      },
    });
  }

  // ── Payment + Receipt ────────────────────────────────────────────────────────
  const payment = await prisma.payment.upsert({
    where: { reference: "KAT-PAY-2026-0001" },
    update: { status: PaymentStatus.SUCCESS, verifiedAt: new Date("2026-03-01T09:00:00Z") },
    create: {
      userId: student.id,
      enrollmentId: enrollment.id,
      programId: program.id,
      provider: PaymentProvider.PAYSTACK,
      status: PaymentStatus.SUCCESS,
      amount: 120000,
      currency: "NGN",
      reference: "KAT-PAY-2026-0001",
      billingMonth: new Date("2026-03-01T00:00:00Z"),
      initializedAt: new Date("2026-03-01T08:00:00Z"),
      verifiedAt: new Date("2026-03-01T09:00:00Z"),
    },
  });

  await prisma.paymentReceipt.upsert({
    where: { paymentId: payment.id },
    update: {},
    create: {
      paymentId: payment.id,
      receiptNumber: "KAT-RCP-2026-0001",
      issuedToId: student.id,
      issuedById: admin.id,
    },
  });

  // ── Certificate ──────────────────────────────────────────────────────────────
  await prisma.certificate.upsert({
    where: { userId_programId: { userId: student.id, programId: program.id } },
    update: {},
    create: {
      userId: student.id,
      programId: program.id,
      issuedById: admin.id,
      issuedAt: new Date("2026-03-10T09:00:00Z"),
    },
  });

  // ── Meeting ──────────────────────────────────────────────────────────────────
  const existingMeeting = await prisma.meeting.findFirst({
    where: { title: "March Mentorship Review", organizationId: org.id },
    select: { id: true },
  });
  const meeting = existingMeeting
    ? await prisma.meeting.findUniqueOrThrow({ where: { id: existingMeeting.id } })
    : await prisma.meeting.create({
        data: {
          title: "March Mentorship Review",
          hostId: fellow.id,
          organizationId: org.id,
          cohortId: cohort.id,
          startTime: new Date("2026-03-08T16:00:00Z"),
          endTime: new Date("2026-03-08T16:45:00Z"),
          dailyRoomName: "kat-mentorship-march-review",
          dailyRoomUrl: "https://meet.zoho.com/kat-mentorship-march-review",
          status: MeetingStatus.UPCOMING,
        },
      });

  for (const [userId, isHost] of [[fellow.id, true], [student.id, false]] as const) {
    await prisma.meetingParticipant.upsert({
      where: { meetingId_userId: { meetingId: meeting.id, userId } },
      update: {},
      create: { meetingId: meeting.id, userId, isHost },
    });
  }

  console.log("✅ Seed complete. All accounts use password: Passw0rd!");
  console.log("   superadmin@kindleatechie.com  →  SUPER_ADMIN");
  console.log("   admin@kindleatechie.com       →  ADMIN");
  console.log("   instructor@kindleatechie.com  →  INSTRUCTOR");
  console.log("   fellow@kindleatechie.com      →  FELLOW");
  console.log("   student@kindleatechie.com     →  STUDENT");
  console.log("   parent@kindleatechie.com      →  PARENT");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
