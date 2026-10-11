import { PurchaseIntent, SpendingGuardrails, GuardrailCheckResult } from '../types.js';
export declare const DEFAULT_GUARDRAILS: SpendingGuardrails;
export declare class AgentSpendingGuardrailEngine {
    private config;
    private dailySpendUSD;
    private lastResetTimestamp;
    constructor(config?: Partial<SpendingGuardrails>);
    getDailySpend(): number;
    getRemainingBudget(): number;
    /**
     * Validates an AI Agent purchase intent against safety guardrails.
     */
    evaluateIntent(intent: PurchaseIntent): GuardrailCheckResult;
    /**
     * Records a settled purchase and increments rolling daily spend.
     */
    recordSettlement(amountUSD: number): void;
    private checkDailyReset;
}
