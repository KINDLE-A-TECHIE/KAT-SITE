import bcrypt from "bcryptjs";
import { PrismaClient, UserRole, ProgramLevel, AssessmentType, QuestionType, PaymentProvider, PaymentStatus, MeetingStatus } from "@prisma/client";

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
    update: {
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role,
      organizationId: data.organizationId,
      passwordHash: hash,
    },
    create: {
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role,
      organizationId: data.organizationId,
      passwordHash: hash,
      profile: {
        create: {
          headline: `${data.role.toLowerCase().replace("_", " ")} at KAT`,
          bio: `${data.firstName} ${data.lastName} is part of the KAT learning platform.`,
        },
      },
    },
  });
}

async function main() {
  const organization = await prisma.organization.upsert({
    where: { code: "KAT-ORG" },
    update: { name: "KAT Academy", domain: "kat.africa" },
    create: {
      name: "KAT Academy",
      code: "KAT-ORG",
      domain: "kat.africa",
    },
  });

  const superAdmin = await createUser({
    email: "superadmin@kat.africa",
    firstName: "System",
    lastName: "Owner",
    role: UserRole.SUPER_ADMIN,
    organizationId: organization.id,
    password: "Passw0rd!",
  });

  const admin = await createUser({
    email: "admin@kat.africa",
    firstName: "Amina",
    lastName: "Admin",
    role: UserRole.ADMIN,
    organizationId: organization.id,
    password: "Passw0rd!",
  });

  const instructor = await createUser({
    email: "instructor@kat.africa",
    firstName: "Ifeanyi",
    lastName: "Instructor",
    role: UserRole.INSTRUCTOR,
    organizationId: organization.id,
    password: "Passw0rd!",
  });

  const fellow = await createUser({
    email: "fellow@kat.africa",
    firstName: "Fola",
    lastName: "Fellow",
    role: UserRole.FELLOW,
    organizationId: organization.id,
    password: "Passw0rd!",
  });

  const student = await createUser({
    email: "student@kat.africa",
    firstName: "Sade",
    lastName: "Student",
    role: UserRole.STUDENT,
    organizationId: organization.id,
    password: "Passw0rd!",
  });

  const parent = await createUser({
    email: "parent@kat.africa",
    firstName: "Peter",
    lastName: "Parent",
    role: UserRole.PARENT,
    organizationId: organization.id,
    password: "Passw0rd!",
  });

  await prisma.organizationCode.upsert({
    where: { code: "KAT-ADMIN-2026" },
    update: { role: UserRole.ADMIN, organizationId: organization.id, createdById: superAdmin.id },
    create: {
      code: "KAT-ADMIN-2026",
      role: UserRole.ADMIN,
      organizationId: organization.id,
      createdById: superAdmin.id,
    },
  });

  await prisma.organizationCode.upsert({
    where: { code: "KAT-INSTRUCTOR-2026" },
    update: { role: UserRole.INSTRUCTOR, organizationId: organization.id, createdById: admin.id },
    create: {
      code: "KAT-INSTRUCTOR-2026",
      role: UserRole.INSTRUCTOR,
      organizationId: organization.id,
      createdById: admin.id,
    },
  });

  await prisma.organizationCode.upsert({
    where: { code: "KAT-FELLOW-2026" },
    update: { role: UserRole.FELLOW, organizationId: organization.id, createdById: admin.id },
    create: {
      code: "KAT-FELLOW-2026",
      role: UserRole.FELLOW,
      organizationId: organization.id,
      createdById: admin.id,
    },
  });

  await prisma.parentStudent.upsert({
    where: {
      parentId_childId: {
        parentId: parent.id,
        childId: student.id,
      },
    },
    update: {},
    create: {
      parentId: parent.id,
      childId: student.id,
    },
  });

  await prisma.mentorship.upsert({
    where: {
      fellowId_studentId: {
        fellowId: fellow.id,
        studentId: student.id,
      },
    },
    update: { active: true, assignedById: admin.id },
    create: {
      fellowId: fellow.id,
      studentId: student.id,
      assignedById: admin.id,
    },
  });

  const program = await prisma.program.upsert({
    where: { slug: "full-stack-innovators" },
    update: {
      name: "Full Stack Innovators",
      monthlyFee: 120000,
      durationWeeks: 16,
      level: ProgramLevel.ADVANCED,
      organizationId: organization.id,
    },
    create: {
      name: "Full Stack Innovators",
      slug: "full-stack-innovators",
      description: "Advanced track focused on full-stack application development.",
      level: ProgramLevel.ADVANCED,
      durationWeeks: 16,
      monthlyFee: 120000,
      organizationId: organization.id,
    },
  });

  const cohort = await prisma.cohort.upsert({
    where: { id: "cohort-innovators-2026" },
    update: {
      name: "Innovators 2026 Cohort",
      startsAt: new Date("2026-01-10T08:00:00.000Z"),
      endsAt: new Date("2026-05-31T18:00:00.000Z"),
      programId: program.id,
      organizationId: organization.id,
    },
    create: {
      id: "cohort-innovators-2026",
      name: "Innovators 2026 Cohort",
      startsAt: new Date("2026-01-10T08:00:00.000Z"),
      endsAt: new Date("2026-05-31T18:00:00.000Z"),
      programId: program.id,
      organizationId: organization.id,
      capacity: 100,
    },
  });

  const enrollment = await prisma.enrollment.upsert({
    where: {
      userId_programId: {
        userId: student.id,
        programId: program.id,
      },
    },
    update: { cohortId: cohort.id },
    create: {
      userId: student.id,
      programId: program.id,
      cohortId: cohort.id,
    },
  });

  const assessment = await prisma.assessment.create({
    data: {
      title: "React Fundamentals Checkpoint",
      description: "Objective + open-ended assessment for React module.",
      type: AssessmentType.QUIZ,
      totalPoints: 20,
      passScore: 12,
      published: true,
      dueDate: new Date("2026-03-20T12:00:00.000Z"),
      programId: program.id,
      cohortId: cohort.id,
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
                { label: "Building user interfaces", value: "ui", isCorrect: true },
                { label: "Managing servers", value: "server", isCorrect: false },
                { label: "Relational databases", value: "db", isCorrect: false },
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
                { label: "True", value: "true", isCorrect: true },
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

  const payment = await prisma.payment.upsert({
    where: { reference: "KAT-PAY-2026-0001" },
    update: {
      status: PaymentStatus.SUCCESS,
      verifiedAt: new Date("2026-03-01T09:00:00.000Z"),
    },
    create: {
      userId: student.id,
      enrollmentId: enrollment.id,
      programId: program.id,
      provider: PaymentProvider.PAYSTACK,
      status: PaymentStatus.SUCCESS,
      amount: 120000,
      currency: "NGN",
      reference: "KAT-PAY-2026-0001",
      billingMonth: new Date("2026-03-01T00:00:00.000Z"),
      initializedAt: new Date("2026-03-01T08:00:00.000Z"),
      verifiedAt: new Date("2026-03-01T09:00:00.000Z"),
    },
  });

  await prisma.paymentReceipt.upsert({
    where: { paymentId: payment.id },
    update: {
      issuedToId: student.id,
      issuedById: admin.id,
    },
    create: {
      paymentId: payment.id,
      receiptNumber: "KAT-RCP-2026-0001",
      issuedToId: student.id,
      issuedById: admin.id,
    },
  });

  const meeting = await prisma.meeting.upsert({
    where: { id: "meeting-onboarding-2026" },
    update: {
      title: "March Mentorship Review",
      hostId: fellow.id,
      organizationId: organization.id,
      cohortId: cohort.id,
      startTime: new Date("2026-03-08T16:00:00.000Z"),
      endTime: new Date("2026-03-08T16:45:00.000Z"),
      dailyRoomName: "kat-mentorship-march-review",
      dailyRoomUrl: "https://meet.zoho.com/kat-mentorship-march-review",
      status: MeetingStatus.UPCOMING,
    },
    create: {
      id: "meeting-onboarding-2026",
      title: "March Mentorship Review",
      hostId: fellow.id,
      organizationId: organization.id,
      cohortId: cohort.id,
      startTime: new Date("2026-03-08T16:00:00.000Z"),
      endTime: new Date("2026-03-08T16:45:00.000Z"),
      dailyRoomName: "kat-mentorship-march-review",
      dailyRoomUrl: "https://meet.zoho.com/kat-mentorship-march-review",
      status: MeetingStatus.UPCOMING,
    },
  });

  await prisma.meetingParticipant.upsert({
    where: {
      meetingId_userId: {
        meetingId: meeting.id,
        userId: fellow.id,
      },
    },
    update: { isHost: true },
    create: {
      meetingId: meeting.id,
      userId: fellow.id,
      isHost: true,
    },
  });

  await prisma.meetingParticipant.upsert({
    where: {
      meetingId_userId: {
        meetingId: meeting.id,
        userId: student.id,
      },
    },
    update: {},
    create: {
      meetingId: meeting.id,
      userId: student.id,
    },
  });

  await prisma.analyticsEvent.createMany({
    data: [
      {
        userId: student.id,
        organizationId: organization.id,
        eventType: "auth",
        eventName: "login",
        payload: { platform: "web" },
      },
      {
        userId: student.id,
        organizationId: organization.id,
        eventType: "assessment",
        eventName: "assessment_view",
        payload: { assessmentId: assessment.id },
      },
      {
        userId: admin.id,
        organizationId: organization.id,
        eventType: "payment",
        eventName: "payment_verified",
        payload: { reference: payment.reference, amount: payment.amount },
      },
    ],
  });

  console.log("Seed complete. Demo accounts use password: Passw0rd!");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
