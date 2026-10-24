export { PayPalClient, PayPalAuthError, PayPalHttpError, resolveBaseUrl } from "./paypal/client.js";
export { SpendingGuard, DEFAULT_GUARDRAILS } from "./guardrails/spending.js";
export { buildChallenge, encodePayment, decodePayment, verifyPayment } from "./x402/middleware.js";
export { CheckoutAgent } from "./agent.js";
export type { HttpRecord, PayPalOrder, OrderAmount, PayPalConfig } from "./paypal/client.js";
export type { GuardrailDecision, SpendRequest, GuardrailConfig } from "./guardrails/spending.js";
export type { PurchaseIntent, PurchaseResult, PurchaseTrace } from "./agent.js";
export type { PaymentRequirement, PaymentPayload } from "./x402/middleware.js";
