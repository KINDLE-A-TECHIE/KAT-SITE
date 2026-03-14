import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { trackEvent } from "@/lib/analytics";
import {
  exchangeZohoCodeForToken,
  fetchZohoUserDetails,
  verifyZohoOAuthState,
} from "@/lib/zoho-oauth";

function buildRedirectUrl(requestUrl: string, status: string, reason?: string) {
  const url = new URL(requestUrl);
  const base = (process.env.NEXTAUTH_URL ?? url.origin).replace(/\/$/, "");
  const target = new URL(`${base}/dashboard/super-admin-invites`);
  target.searchParams.set("zoho", status);
  if (reason) {
    target.searchParams.set("reason", reason);
  }
  return target.toString();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");

  if (error) {
    return NextResponse.redirect(buildRedirectUrl(request.url, "error", error));
  }
  if (!code || !stateParam) {
    return NextResponse.redirect(buildRedirectUrl(request.url, "error", "missing_code_or_state"));
  }

  try {
    const state = verifyZohoOAuthState(stateParam);
    const user = await prisma.user.findUnique({
      where: { id: state.userId },
      select: { id: true, role: true, organizationId: true },
    });
    if (!user || user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.redirect(buildRedirectUrl(request.url, "error", "forbidden"));
    }

    const token = await exchangeZohoCodeForToken(code);
    const details = await fetchZohoUserDetails(token.access_token!);
    const existing = await prisma.oAuthAccount.findFirst({
      where: {
        userId: user.id,
        provider: "zoho_meeting",
      },
      select: { refreshToken: true },
    });

    const refreshToken = token.refresh_token ?? existing?.refreshToken ?? null;
    const expiresAt = token.expires_in ? Math.floor(Date.now() / 1000) + token.expires_in : null;

    await prisma.$transaction([
      prisma.oAuthAccount.deleteMany({
        where: {
          userId: user.id,
          provider: "zoho_meeting",
          providerAccountId: { not: details.zuid },
        },
      }),
      prisma.oAuthAccount.upsert({
        where: {
          provider_providerAccountId: {
            provider: "zoho_meeting",
            providerAccountId: details.zuid,
          },
        },
        update: {
          userId: user.id,
          refreshToken,
          accessToken: token.access_token,
          expiresAt,
          tokenType: token.token_type ?? "Zoho-oauthtoken",
          scope: token.scope ?? null,
          sessionState: JSON.stringify({
            zsoid: details.zsoid,
            presenterId: details.zuid,
            connectedAt: new Date().toISOString(),
          }),
        },
        create: {
          userId: user.id,
          type: "oauth",
          provider: "zoho_meeting",
          providerAccountId: details.zuid,
          refreshToken,
          accessToken: token.access_token,
          expiresAt,
          tokenType: token.token_type ?? "Zoho-oauthtoken",
          scope: token.scope ?? undefined,
          sessionState: JSON.stringify({
            zsoid: details.zsoid,
            presenterId: details.zuid,
            connectedAt: new Date().toISOString(),
          }),
        },
      }),
    ]);

    await trackEvent({
      userId: user.id,
      organizationId: user.organizationId,
      eventType: "integration",
      eventName: "zoho_meeting_connected",
      payload: {
        zsoid: details.zsoid,
        presenterId: details.zuid,
        hasRefreshToken: Boolean(refreshToken),
      },
    });

    return NextResponse.redirect(
      buildRedirectUrl(request.url, refreshToken ? "connected" : "connected_access_only"),
    );
  } catch (error) {
    return NextResponse.redirect(
      buildRedirectUrl(
        request.url,
        "error",
        error instanceof Error ? error.message.slice(0, 100) : "callback_failed",
      ),
    );
  }
}
