import type { PaymentGateway, PaymentInitializeInput } from "./types";

const PAYSTACK_API_BASE = "https://api.paystack.co";

function getSecretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    throw new Error("PAYSTACK_SECRET_KEY is not configured.");
  }
  return key;
}

export class PaystackGateway implements PaymentGateway {
  async initialize(input: PaymentInitializeInput) {
    const response = await fetch(`${PAYSTACK_API_BASE}/transaction/initialize`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getSecretKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: input.email,
        amount: Math.round(input.amount * 100),
        currency: input.currency,
        reference: input.reference,
        callback_url: input.callbackUrl,
      }),
    });

    const payload = (await response.json()) as {
      status: boolean;
      message: string;
      data?: {
        authorization_url: string;
        access_code: string;
        reference: string;
      };
    };

    if (!response.ok || !payload.status || !payload.data) {
      throw new Error(payload.message ?? "Paystack initialization failed.");
    }

    return {
      authorizationUrl: payload.data.authorization_url,
      accessCode: payload.data.access_code,
      reference: payload.data.reference,
      raw: payload,
    };
  }

  async verify(reference: string) {
    const response = await fetch(`${PAYSTACK_API_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: {
        Authorization: `Bearer ${getSecretKey()}`,
      },
      cache: "no-store",
    });

    const payload = (await response.json()) as {
      status: boolean;
      message: string;
      data?: {
        status: string;
        paid_at?: string;
        channel?: string;
        amount?: number;
        currency?: string;
      };
    };

    if (!response.ok || !payload.status || !payload.data) {
      throw new Error(payload.message ?? "Paystack verification failed.");
    }

    return {
      success: payload.data.status === "success",
      status: payload.data.status,
      paidAt: payload.data.paid_at ? new Date(payload.data.paid_at) : undefined,
      channel: payload.data.channel,
      amount: payload.data.amount ? payload.data.amount / 100 : undefined,
      currency: payload.data.currency,
      raw: payload,
    };
  }
}
