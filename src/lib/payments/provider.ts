import { PaymentProvider } from "@prisma/client";
import type { PaymentGateway } from "./types";
import { PaystackGateway } from "./paystack";
import { StripeGateway } from "./stripe";

export function getPaymentGateway(provider: PaymentProvider): PaymentGateway {
  if (provider === PaymentProvider.STRIPE) {
    return new StripeGateway();
  }
  return new PaystackGateway();
}
