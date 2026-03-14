import bcrypt from "bcryptjs";
import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required."),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters.")
      .max(128, "Password is too long."),
    confirmPassword: z.string().min(1, "Please confirm your new password."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export async function PUT(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return fail("Unauthorized", 401);
  }

  try {
    const body = await request.json();
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return fail("Validation failed.", 400, parsed.error.flatten());
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, passwordHash: true },
    });

    if (!user) {
      return fail("User not found.", 404);
    }

    const currentValid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
    if (!currentValid) {
      return fail("Current password is incorrect.", 400);
    }

    if (parsed.data.newPassword === parsed.data.currentPassword) {
      return fail("New password must differ from your current password.", 400);
    }

    const newHash = await bcrypt.hash(parsed.data.newPassword, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash },
      }),
      // Invalidate all sessions so the user must log in again on other devices
      prisma.userSession.deleteMany({
        where: { userId: user.id },
      }),
    ]);

    return ok({ message: "Password updated. You will be signed out of all devices." });
  } catch (error) {
    return fail("Could not update password.", 500, error instanceof Error ? error.message : error);
  }
}
