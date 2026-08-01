import { CourseAudience, NerdcLevel, ProgramLevel, Strand, UserRole } from "@prisma/client";
import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { orgScope } from "@/lib/tenant";

// Derives a school programme's ProgramLevel from its NERDC level, the same mapping the crosswalk
// seed uses, so a UI-created school programme can't drift from the seeded ones.
const PROGRAM_LEVEL: Record<NerdcLevel, ProgramLevel> = {
  PRIMARY_1_3: ProgramLevel.BEGINNER,
  PRIMARY_4_6: ProgramLevel.BEGINNER,
  JSS: ProgramLevel.INTERMEDIATE,
  SSS: ProgramLevel.ADVANCED,
};

const createProgramSchema = z
  .object({
    name:            z.string().trim().min(3).max(150),
    slug:            z.string().trim().min(3).max(150),
    description:     z.string().trim().max(4000).optional(),
    level:           z.nativeEnum(ProgramLevel),
    monthlyFee:      z.number().nonnegative(),
    discountPercent: z.number().min(0).max(100).optional(),
    audience:        z.nativeEnum(CourseAudience).default(CourseAudience.B2C),
    nerdcLevel:      z.nativeEnum(NerdcLevel).optional(),
    strand:          z.nativeEnum(Strand).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.audience === CourseAudience.SCHOOL) {
      // Seat-licensed: no fee, but it must carry the NERDC level + strand a school course needs.
      if (!data.nerdcLevel) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["nerdcLevel"], message: "NERDC level is required for a school programme." });
      if (!data.strand) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["strand"], message: "Strand is required for a school programme." });
    } else if (!(data.monthlyFee > 0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["monthlyFee"], message: "A B2C programme needs a positive monthly fee." });
    }
  });

export async function GET(request: Request) {
  const session = await getServerAuthSession();
  const url = new URL(request.url);
  const includeInactive = url.searchParams.get("includeInactive") === "true";
  // Optional audience facet for the curriculum panel: B2C (priced) vs SCHOOL (seat-licensed).
  const audienceParam = url.searchParams.get("audience");
  const audience =
    audienceParam === "B2C" || audienceParam === "SCHOOL"
      ? (audienceParam as CourseAudience)
      : undefined;

  const programs = await prisma.program.findMany({
    where: {
      ...orgScope(session?.user.organizationId),
      isActive: includeInactive ? undefined : true,
      audience,
    },
    include: {
      cohorts: {
        select: {
          id: true,
          name: true,
          startsAt: true,
          endsAt: true,
        },
      },
      _count: {
        select: {
          enrollments: true,
          assessments: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return ok({ programs });
}

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return fail("Unauthorized", 401);
  }

  const role = session.user.role;
  if (role !== UserRole.SUPER_ADMIN && role !== UserRole.ADMIN) {
    return fail("Forbidden", 403);
  }

  const body = await request.json();
  const parsed = createProgramSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Invalid program payload.", 400, parsed.error.flatten());
  }

  if (!session.user.organizationId) {
    return fail("Organization not found for user.", 400);
  }

  const d = parsed.data;
  const isSchool = d.audience === CourseAudience.SCHOOL;
  const program = await prisma.program.create({
    data: {
      name:            d.name,
      slug:            d.slug,
      description:     d.description,
      // School level is derived from the NERDC level; fee/discount don't apply (seat-licensed).
      level:           isSchool ? PROGRAM_LEVEL[d.nerdcLevel!] : d.level,
      monthlyFee:      isSchool ? 0 : d.monthlyFee,
      discountPercent: isSchool ? null : (d.discountPercent ?? null),
      audience:        d.audience,
      nerdcLevel:      isSchool ? d.nerdcLevel : null,
      strand:          isSchool ? d.strand : null,
      organizationId:  session.user.organizationId!,
    },
  });

  return ok({ program }, 201);
}
