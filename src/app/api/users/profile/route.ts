import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { profileSchema } from "@/lib/validators";
import { trackEvent } from "@/lib/analytics";

export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return fail("Unauthorized", 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      profile: {
        include: {
          skills: true,
          education: true,
          experience: true,
        },
      },
    },
  });

  if (!user) {
    return fail("User not found.", 404);
  }

  return ok({ user });
}

export async function PUT(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return fail("Unauthorized", 401);
  }

  try {
    const body = await request.json();
    const parsed = profileSchema.safeParse(body);
    if (!parsed.success) {
      return fail("Invalid profile payload.", 400, parsed.error.flatten());
    }

    const updated = await prisma.$transaction(async (tx) => {
      const { skills, education, experience, visibility, firstName, lastName, ...profile } = parsed.data;

      const visibilityData = {
        summaryVisibility: visibility?.summary,
        linksVisibility: visibility?.links,
        skillsVisibility: visibility?.skills,
        educationVisibility: visibility?.education,
        experienceVisibility: visibility?.experience,
      };

      const userWithProfile = await tx.user.update({
        where: { id: session.user.id },
        data: {
          firstName: firstName ?? undefined,
          lastName: lastName ?? undefined,
          profile: {
            upsert: {
              create: { ...profile, ...visibilityData },
              update: { ...profile, ...visibilityData },
            },
          },
        },
        select: {
          profile: {
            select: {
              id: true,
            },
          },
        },
      });

      const profileId = userWithProfile.profile?.id;
      if (!profileId) {
        throw new Error("Profile could not be loaded.");
      }

      if (skills) {
        await tx.profileSkill.deleteMany({ where: { profileId } });
        if (skills.length > 0) {
          await tx.profileSkill.createMany({
            data: skills.map((skill) => ({
              profileId,
              name: skill.name,
              level: skill.level,
              yearsOfExperience: skill.yearsOfExperience,
            })),
          });
        }
      }

      if (education) {
        await tx.educationRecord.deleteMany({ where: { profileId } });
        if (education.length > 0) {
          await tx.educationRecord.createMany({
            data: education.map((item) => ({
              profileId,
              school: item.school,
              degree: item.degree,
              fieldOfStudy: item.fieldOfStudy,
              startDate: item.startDate ? new Date(item.startDate) : undefined,
              endDate: item.endDate ? new Date(item.endDate) : undefined,
              isCurrent: item.isCurrent ?? false,
              description: item.description,
            })),
          });
        }
      }

      if (experience) {
        await tx.experienceRecord.deleteMany({ where: { profileId } });
        if (experience.length > 0) {
          await tx.experienceRecord.createMany({
            data: experience.map((item) => ({
              profileId,
              company: item.company,
              title: item.title,
              startDate: item.startDate ? new Date(item.startDate) : undefined,
              endDate: item.endDate ? new Date(item.endDate) : undefined,
              isCurrent: item.isCurrent ?? false,
              description: item.description,
            })),
          });
        }
      }

      return tx.user.findUniqueOrThrow({
        where: { id: session.user.id },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          profile: {
            include: {
              skills: true,
              education: true,
              experience: true,
            },
          },
        },
      });
    }, { maxWait: 10_000, timeout: 20_000 });

    await trackEvent({
      userId: session.user.id,
      organizationId: session.user.organizationId,
      eventType: "profile",
      eventName: "profile_updated",
    });

    return ok({ user: updated });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2028") {
      return fail("Profile update timed out. Please retry with a smaller image.", 408);
    }

    if (error instanceof Error) {
      const lowered = error.message.toLowerCase();
      if (
        (lowered.includes("body") && lowered.includes("limit")) ||
        lowered.includes("too large") ||
        lowered.includes("request entity")
      ) {
        return fail("Profile image is too large. Please choose a smaller image.", 413);
      }
    }
    return fail("Could not update profile.", 500, error instanceof Error ? error.message : error);
  }
}
