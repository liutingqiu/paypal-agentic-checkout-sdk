/**
 * Spending guardrails.
 *
 * Deterministic limits evaluated before any order is created: per-transaction
 * cap, rolling daily cap, and a hard approval threshold. The engine never asks
 * PayPal for permission; it decides locally and records why.
 */
export interface GuardrailConfig {
    perTransactionCap: number;
    dailyCap: number;
    requireApprovalAbove: number;
    allowedCurrencies: string[];
}
export interface SpendRequest {
    amount: number;
    currency: string;
    merchant: string;
    purpose: string;
}
export interface GuardrailDecision {
    allowed: boolean;
    requiresApproval: boolean;
    reason: string;
    rule: string;
    remainingDaily: number;
}
export declare const DEFAULT_GUARDRAILS: GuardrailConfig;
export declare class SpendingGuard {
    private readonly config;
    private spentToday;
    private readonly ledger;
    constructor(config?: GuardrailConfig);
    get spent(): number;
    get history(): {
        at: number;
        amount: number;
        merchant: string;
        purpose: string;
        orderId?: string;
    }[];
    evaluate(request: SpendRequest): GuardrailDecision;
    commit(request: SpendRequest, orderId?: string): void;
    reset(): void;
}
