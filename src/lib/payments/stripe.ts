import type {
  PaymentGateway,
  PaymentInitializeInput,
  PaymentInitializeResult,
  PaymentVerificationResult,
} from "./types";

export class StripeGateway implements PaymentGateway {
  async initialize(_input: PaymentInitializeInput): Promise<PaymentInitializeResult> {
    throw new Error("Stripe gateway is scaffolded but not enabled yet.");
  }

  async verify(_reference: string): Promise<PaymentVerificationResult> {
    throw new Error("Stripe gateway is scaffolded but not enabled yet.");
  }
}
