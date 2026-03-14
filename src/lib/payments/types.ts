export type PaymentInitializeInput = {
  email: string;
  amount: number;
  currency: string;
  reference: string;
  callbackUrl: string;
};

export type PaymentInitializeResult = {
  authorizationUrl: string;
  reference: string;
  accessCode?: string;
  raw?: unknown;
};

export type PaymentVerificationResult = {
  success: boolean;
  status: string;
  paidAt?: Date;
  channel?: string;
  amount?: number;
  currency?: string;
  raw?: unknown;
};

export interface PaymentGateway {
  initialize(input: PaymentInitializeInput): Promise<PaymentInitializeResult>;
  verify(reference: string): Promise<PaymentVerificationResult>;
}
