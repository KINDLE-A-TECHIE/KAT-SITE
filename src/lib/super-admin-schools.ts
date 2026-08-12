import "server-only";
import { SchoolInvoiceStatus, SchoolLicenseStatus, SchoolRole } from "@prisma/client";
import { prisma } from "./prisma";
import { termEndsAt } from "./school-term";

/**
 * The super-admin "Manage schools" list. ALL schools (not the top-20 the analytics overview shows),
 * with the fields a super-admin acts on: the negotiated per-seat price, active-licence seat usage,
 * revenue, and pupil/admin counts. Read-only aggregation; the mutation is the price PATCH.
 *
 * Money is returned as a plain number (Prisma Decimal -> Number) so the client renders it directly.
 */
export type ManagedSchool = {
  id: string;
  name: string;
  slug: string;
  pricePerSeat: number;
  discountPercent: number;
  discountReason: string | null;
  suspendedAt: string | null;
  createdAt: string;
  adminCount: number;
  activeLicenses: number;
  seatLimit: number;
  seatsUsed: number;
  paidRevenue: number;
  pendingInvoiceCount: number;
  pendingInvoiceAmount: number;
  pupilCount: number;
};

export async function listManagedSchools(): Promise<ManagedSchool[]> {
  const [schools, adminGroups, activeLicenses, paidGroups, pendingGroups, pupilGroups] =
    await Promise.all([
      prisma.school.findMany({
        select: { id: true, name: true, slug: true, pricePerSeat: true, discountPercent: true, discountReason: true, suspendedAt: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.schoolMembership.groupBy({
        by: ["schoolId"],
        where: { role: SchoolRole.SCHOOL_ADMIN },
        _count: { _all: true },
      }),
      prisma.schoolLicense.findMany({
        where: { status: SchoolLicenseStatus.ACTIVE },
        select: { schoolId: true, seatLimit: true, seatsUsed: true },
      }),
      prisma.schoolInvoice.groupBy({
        by: ["schoolId"],
        where: { status: SchoolInvoiceStatus.PAID },
        _sum: { amount: true },
      }),
      prisma.schoolInvoice.groupBy({
        by: ["schoolId"],
        where: { status: SchoolInvoiceStatus.PENDING },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      prisma.enrollment.groupBy({
        by: ["schoolId"],
        where: { schoolId: { not: null } },
        _count: { _all: true },
      }),
    ]);

  const adminCount = new Map(adminGroups.map((g) => [g.schoolId, g._count._all]));
  const paidRevenue = new Map(paidGroups.map((g) => [g.schoolId, Number(g._sum.amount ?? 0)]));
  const pending = new Map(
    pendingGroups.map((g) => [g.schoolId, { count: g._count._all, amount: Number(g._sum.amount ?? 0) }]),
  );
  const pupilCount = new Map(
    pupilGroups
      .filter((g): g is typeof g & { schoolId: string } => g.schoolId !== null)
      .map((g) => [g.schoolId, g._count._all]),
  );

  const licenseAgg = new Map<string, { active: number; seatLimit: number; seatsUsed: number }>();
  for (const lic of activeLicenses) {
    const entry = licenseAgg.get(lic.schoolId) ?? { active: 0, seatLimit: 0, seatsUsed: 0 };
    entry.active += 1;
    entry.seatLimit += lic.seatLimit;
    entry.seatsUsed += lic.seatsUsed;
    licenseAgg.set(lic.schoolId, entry);
  }

  return schools.map((school) => {
    const lic = licenseAgg.get(school.id);
    const pend = pending.get(school.id);
    return {
      id: school.id,
      name: school.name,
      slug: school.slug,
      pricePerSeat: Number(school.pricePerSeat),
      discountPercent: Number(school.discountPercent),
      discountReason: school.discountReason,
      suspendedAt: school.suspendedAt ? school.suspendedAt.toISOString() : null,
      createdAt: school.createdAt.toISOString(),
      adminCount: adminCount.get(school.id) ?? 0,
      activeLicenses: lic?.active ?? 0,
      seatLimit: lic?.seatLimit ?? 0,
      seatsUsed: lic?.seatsUsed ?? 0,
      paidRevenue: paidRevenue.get(school.id) ?? 0,
      pendingInvoiceCount: pend?.count ?? 0,
      pendingInvoiceAmount: pend?.amount ?? 0,
      pupilCount: pupilCount.get(school.id) ?? 0,
    };
  });
}

export type SchoolLicenseRow = {
  sessionLabel: string;
  termNumber: number;
  status: string;
  seatLimit: number;
  seatsUsed: number;
  pricePerSeat: number;
  startsAt: string | null;
  /** Derived window end = startsAt + 15 weeks; null when startsAt is unset (no time limit). */
  endsAt: string | null;
};

export type SchoolInvoiceRow = {
  id: string;
  sessionLabel: string;
  termNumber: number;
  seatCount: number;
  amount: number;
  discountPercent: number;
  status: string;
  createdAt: string;
};

export type SchoolDetail = {
  id: string;
  name: string;
  slug: string;
  pricePerSeat: number;
  discountPercent: number;
  discountReason: string | null;
  suspendedAt: string | null;
  licenses: SchoolLicenseRow[];
  invoices: SchoolInvoiceRow[];
};

/** One school's licences (per term) and recent invoices, for the super-admin drill-down. */
export async function getSchoolDetail(schoolId: string): Promise<SchoolDetail | null> {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { id: true, name: true, slug: true, pricePerSeat: true, discountPercent: true, discountReason: true, suspendedAt: true },
  });
  if (!school) return null;

  const [licenses, invoices] = await Promise.all([
    prisma.schoolLicense.findMany({
      where: { schoolId },
      orderBy: [{ sessionLabel: "desc" }, { termNumber: "desc" }],
      select: {
        sessionLabel: true,
        termNumber: true,
        status: true,
        seatLimit: true,
        seatsUsed: true,
        pricePerSeat: true,
        startsAt: true,
      },
    }),
    prisma.schoolInvoice.findMany({
      where: { schoolId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        sessionLabel: true,
        termNumber: true,
        seatCount: true,
        amount: true,
        discountPercent: true,
        status: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    id: school.id,
    name: school.name,
    slug: school.slug,
    pricePerSeat: Number(school.pricePerSeat),
    discountPercent: Number(school.discountPercent),
    discountReason: school.discountReason,
    suspendedAt: school.suspendedAt ? school.suspendedAt.toISOString() : null,
    licenses: licenses.map((l) => {
      const end = termEndsAt(l.startsAt);
      return {
        sessionLabel: l.sessionLabel,
        termNumber: l.termNumber,
        status: l.status,
        seatLimit: l.seatLimit,
        seatsUsed: l.seatsUsed,
        pricePerSeat: Number(l.pricePerSeat),
        startsAt: l.startsAt ? l.startsAt.toISOString() : null,
        endsAt: end ? end.toISOString() : null,
      };
    }),
    invoices: invoices.map((i) => ({
      id: i.id,
      sessionLabel: i.sessionLabel,
      termNumber: i.termNumber,
      seatCount: i.seatCount,
      amount: Number(i.amount),
      discountPercent: Number(i.discountPercent),
      status: i.status,
      createdAt: i.createdAt.toISOString(),
    })),
  };
}
