import { z } from "zod";
import bcrypt from "bcryptjs";
import { fail, ok, serverError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { hashResetToken } from "@/lib/reset-token";

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid request.", 400);
    }

    // The DB stores only the SHA-256 hash of the token, so hash the value from the URL to look it up.
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token: hashResetToken(parsed.data.token) },
      include: { user: { select: { id: true, isActive: true } } },
    });

    if (!resetToken) {
      return fail("Invalid or expired reset link.", 400);
    }
    if (resetToken.usedAt) {
      return fail("This reset link has already been used.", 400);
    }
    if (resetToken.expiresAt < new Date()) {
      return fail("This reset link has expired. Please request a new one.", 400);
    }
    if (!resetToken.user.isActive) {
      return fail("Account is inactive.", 403);
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      // Invalidate all active sessions so the user must log in with new password
      prisma.userSession.deleteMany({
        where: { userId: resetToken.userId },
      }),
    ]);

    return ok({ message: "Password reset successfully. You can now sign in." });
  } catch (error) {
    return serverError(error, "Could not reset password.");
  }
}
