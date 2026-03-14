import { UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { buildZohoAuthorizationUrl, createZohoOAuthState } from "@/lib/zoho-oauth";

export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return fail("Unauthorized", 401);
  }
  if (session.user.role !== UserRole.SUPER_ADMIN) {
    return fail("Forbidden", 403);
  }

  try {
    const state = createZohoOAuthState({
      userId: session.user.id,
      organizationId: session.user.organizationId ?? null,
    });
    const authUrl = buildZohoAuthorizationUrl(state);
    return ok({ authUrl });
  } catch (error) {
    return fail("Could not initialize Zoho OAuth.", 500, error instanceof Error ? error.message : error);
  }
}
