/**
 * x402 payment challenge, following the HTTP 402 flow: a resource answers 402
 * with a machine-readable payment requirement, the client retries with an
 * X-PAYMENT header carrying a base64 JSON payload, and the server verifies it.
 *
 * This module builds and verifies the payloads. It does not settle funds and it
 * does not pretend to: settlement is the PayPal capture call.
 */
export interface PaymentRequirement {
    scheme: "exact";
    network: "paypal-sandbox" | "paypal-live" | "contract";
    amount: string;
    currency: string;
    payTo: string;
    resource: string;
    expiresAt: number;
    nonce: string;
}
export interface PaymentPayload {
    nonce: string;
    amount: string;
    currency: string;
    payTo: string;
    orderId?: string;
    payer?: string;
}
export declare function buildChallenge(input: Omit<PaymentRequirement, "scheme" | "expiresAt" | "nonce"> & {
    ttlSeconds?: number;
}): {
    status: 402;
    headers: Record<string, string>;
    body: Record<string, unknown>;
};
export declare function encodePayment(payload: PaymentPayload): string;
export declare function decodePayment(header: string | undefined): PaymentPayload | null;
export declare function verifyPayment(requirement: PaymentRequirement, payload: PaymentPayload | null): {
    ok: boolean;
    reason: string;
};
