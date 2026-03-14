import { UserRole } from "@prisma/client";
import { cookies } from "next/headers";
import { ok, fail } from "@/lib/http";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const role = body?.role;

  if (role !== UserRole.STUDENT && role !== UserRole.PARENT) {
    return fail("Invalid role.", 400);
  }

  const cookieStore = await cookies();
  cookieStore.set("oauth_register_role", role, {
    httpOnly: true,
    maxAge: 300, // 5 minutes — enough to complete OAuth flow
    path: "/",
    sameSite: "lax",
  });

  return ok({ ok: true });
}