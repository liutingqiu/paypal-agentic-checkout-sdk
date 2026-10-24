/**
 * Agent purchase flow: intent -> guardrail -> order -> capture -> ledger.
 *
 * Every external effect is a real PayPal call. When credentials are absent the
 * flow fails loudly instead of approving a fictional payment, and when the
 * guardrail requires human confirmation the flow stops before creating an order.
 */
import { PayPalClient } from "./paypal/client.js";
import { SpendingGuard, SpendRequest } from "./guardrails/spending.js";
export interface PurchaseIntent extends SpendRequest {
}
export interface PurchaseTrace {
    step: string;
    ok: boolean;
    detail: string;
    durationMs: number;
}
export interface PurchaseResult {
    status: "completed" | "rejected" | "needs_approval" | "awaiting_payer" | "failed";
    reason: string;
    orderId?: string;
    approvalUrl?: string;
    capturedAmount?: string;
    trace: PurchaseTrace[];
}
export declare class CheckoutAgent {
    private readonly client;
    private readonly guard;
    constructor(client: PayPalClient, guard: SpendingGuard);
    private step;
    purchase(intent: PurchaseIntent, options?: {
        approved?: boolean;
        referenceId?: string;
        skipPayerApproval?: boolean;
    }): Promise<PurchaseResult>;
}
