import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { sendEmail, buildPasswordResetEmail } from "@/lib/email";

const schema = z.object({
  email: z.string().email(),
});

const BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
// Token valid for 1 hour
const TOKEN_TTL_MS = 60 * 60 * 1000;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return fail("Invalid email address.", 400);
    }

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email.toLowerCase().trim() },
      select: { id: true, firstName: true, email: true, isActive: true },
    });

    // Always return success to avoid user enumeration
    if (!user || !user.isActive) {
      return ok({ message: "If that email exists, a reset link has been sent." });
    }

    // Invalidate any existing unused tokens for this user
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    });

    const token = await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      },
    });

    const resetUrl = `${BASE_URL}/reset-password?token=${token.token}`;

    await sendEmail({
      to: user.email,
      subject: "Reset your KAT Learning password",
      html: buildPasswordResetEmail({ firstName: user.firstName, resetUrl }),
    });

    return ok({ message: "If that email exists, a reset link has been sent." });
  } catch (error) {
    return fail("Could not process request.", 500, error instanceof Error ? error.message : error);
  }
}
