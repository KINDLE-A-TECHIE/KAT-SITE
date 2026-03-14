import "server-only";
import crypto from "crypto";

const DEFAULT_ACCOUNTS_BASE_URL = "https://accounts.zoho.com";
const DEFAULT_MEETING_API_ROOT = "https://meeting.zoho.com/api/v2";
const DEFAULT_SCOPES = "ZohoMeeting.manageOrg.READ,ZohoMeeting.meeting.CREATE,ZohoMeeting.recording.READ";

type OAuthStatePayload = {
  userId: string;
  organizationId: string | null;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
};

type ZohoTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  api_domain?: string;
  error?: string;
  error_description?: string;
};

type ZohoUserDetailsResponse = {
  userDetails?: {
    zsoid?: string | number;
    zuid?: string | number;
    email?: string;
  };
};

function getSigningSecret() {
  const secret = process.env.NEXTAUTH_SECRET?.trim();
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is required for Zoho OAuth state signing.");
  }
  return secret;
}

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, "base64").toString("utf8");
}

function signStatePayload(payload: string) {
  return base64UrlEncode(crypto.createHmac("sha256", getSigningSecret()).update(payload).digest());
}

export function getZohoAccountsBaseUrl() {
  return (process.env.ZOHO_ACCOUNTS_BASE_URL ?? DEFAULT_ACCOUNTS_BASE_URL).replace(/\/$/, "");
}

export function getZohoMeetingApiRoot() {
  return (process.env.ZOHO_MEETING_API_ROOT ?? DEFAULT_MEETING_API_ROOT).replace(/\/$/, "");
}

export function getZohoOAuthClientId() {
  const clientId = process.env.ZOHO_OAUTH_CLIENT_ID?.trim();
  if (!clientId) {
    throw new Error("ZOHO_OAUTH_CLIENT_ID is not configured.");
  }
  return clientId;
}

export function getZohoOAuthClientSecret() {
  const clientSecret = process.env.ZOHO_OAUTH_CLIENT_SECRET?.trim();
  if (!clientSecret) {
    throw new Error("ZOHO_OAUTH_CLIENT_SECRET is not configured.");
  }
  return clientSecret;
}

export function getZohoOAuthRedirectUri() {
  const explicit = process.env.ZOHO_OAUTH_REDIRECT_URI?.trim();
  if (explicit) {
    return explicit;
  }
  const base = (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/api/integrations/zoho/callback`;
}

export function createZohoOAuthState(input: { userId: string; organizationId: string | null }) {
  const issuedAt = Date.now();
  const payload: OAuthStatePayload = {
    userId: input.userId,
    organizationId: input.organizationId,
    issuedAt,
    expiresAt: issuedAt + 10 * 60 * 1000,
    nonce: base64UrlEncode(crypto.randomBytes(12)),
  };
  const serializedPayload = JSON.stringify(payload);
  const encodedPayload = base64UrlEncode(serializedPayload);
  const signature = signStatePayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyZohoOAuthState(state: string) {
  const [encodedPayload, signature] = state.split(".");
  if (!encodedPayload || !signature) {
    throw new Error("Invalid OAuth state.");
  }
  const expected = signStatePayload(encodedPayload);
  const actual = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length || !crypto.timingSafeEqual(actual, wanted)) {
    throw new Error("Invalid OAuth state signature.");
  }

  const parsed = JSON.parse(base64UrlDecode(encodedPayload)) as OAuthStatePayload;
  if (!parsed.userId || !parsed.nonce || !parsed.expiresAt) {
    throw new Error("Malformed OAuth state payload.");
  }
  if (Date.now() > parsed.expiresAt) {
    throw new Error("OAuth state expired.");
  }

  return parsed;
}

export function buildZohoAuthorizationUrl(state: string) {
  const accountsBase = getZohoAccountsBaseUrl();
  const clientId = getZohoOAuthClientId();
  const redirectUri = getZohoOAuthRedirectUri();
  const scopes = process.env.ZOHO_MEETING_OAUTH_SCOPES?.trim() || DEFAULT_SCOPES;

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: scopes,
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return `${accountsBase}/oauth/v2/auth?${params.toString()}`;
}

export async function exchangeZohoCodeForToken(code: string) {
  const response = await fetch(`${getZohoAccountsBaseUrl()}/oauth/v2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: getZohoOAuthClientId(),
      client_secret: getZohoOAuthClientSecret(),
      redirect_uri: getZohoOAuthRedirectUri(),
      code,
    }).toString(),
  });

  const payload = (await response.json().catch(() => null)) as ZohoTokenResponse | null;
  if (!response.ok || !payload?.access_token) {
    throw new Error(
      `Failed to exchange Zoho OAuth code: ${payload?.error ?? response.status} ${payload?.error_description ?? ""}`.trim(),
    );
  }

  return payload;
}

export async function refreshZohoAccessToken(refreshToken: string) {
  const response = await fetch(`${getZohoAccountsBaseUrl()}/oauth/v2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: getZohoOAuthClientId(),
      client_secret: getZohoOAuthClientSecret(),
    }).toString(),
  });

  const payload = (await response.json().catch(() => null)) as ZohoTokenResponse | null;
  if (!response.ok || !payload?.access_token) {
    throw new Error(
      `Failed to refresh Zoho OAuth token: ${payload?.error ?? response.status} ${payload?.error_description ?? ""}`.trim(),
    );
  }

  return payload;
}

export async function fetchZohoUserDetails(accessToken: string) {
  const response = await fetch(`${getZohoMeetingApiRoot()}/user.json`, {
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to fetch Zoho user details: ${body}`);
  }

  const payload = (await response.json()) as ZohoUserDetailsResponse;
  const zsoid = String(payload.userDetails?.zsoid ?? "");
  const zuid = String(payload.userDetails?.zuid ?? "");
  if (!zsoid || !zuid) {
    throw new Error("Zoho user details did not include zsoid/zuid.");
  }

  return {
    zsoid,
    zuid,
    email: payload.userDetails?.email ?? "",
  };
}
