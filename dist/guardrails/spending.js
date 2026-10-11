export const DEFAULT_GUARDRAILS = {
    maxSingleTxUSD: 150.0,
    dailyBudgetUSD: 500.0,
    allowedMerchants: [], // Empty array permits all verified PayPal merchants
    autoApproveThresholdUSD: 30.0
};
export class AgentSpendingGuardrailEngine {
    config;
    dailySpendUSD;
    lastResetTimestamp;
    constructor(config = {}) {
        this.config = { ...DEFAULT_GUARDRAILS, ...config };
        this.dailySpendUSD = 0;
        this.lastResetTimestamp = Date.now();
    }
    getDailySpend() {
        this.checkDailyReset();
        return this.dailySpendUSD;
    }
    getRemainingBudget() {
        this.checkDailyReset();
        return Math.max(0, this.config.dailyBudgetUSD - this.dailySpendUSD);
    }
    /**
     * Validates an AI Agent purchase intent against safety guardrails.
     */
    evaluateIntent(intent) {
        this.checkDailyReset();
        // 1. Single transaction cap
        if (intent.amountUSD > this.config.maxSingleTxUSD) {
            return {
                passed: false,
                requiresHumanConfirmation: true,
                rejectionReason: `Exceeds max single transaction cap: $${intent.amountUSD} > $${this.config.maxSingleTxUSD}`,
                currentDailySpendUSD: this.dailySpendUSD,
                remainingDailyBudgetUSD: this.getRemainingBudget()
            };
        }
        // 2. Daily budget cap
        if (this.dailySpendUSD + intent.amountUSD > this.config.dailyBudgetUSD) {
            return {
                passed: false,
                requiresHumanConfirmation: true,
                rejectionReason: `Exceeds daily budget limit: $${this.dailySpendUSD + intent.amountUSD} > $${this.config.dailyBudgetUSD}`,
                currentDailySpendUSD: this.dailySpendUSD,
                remainingDailyBudgetUSD: this.getRemainingBudget()
            };
        }
        // 3. Merchant whitelist check (if configured)
        if (this.config.allowedMerchants.length > 0 && !this.config.allowedMerchants.includes(intent.merchantId)) {
            return {
                passed: false,
                requiresHumanConfirmation: true,
                rejectionReason: `Merchant ${intent.merchantId} is not in authorized whitelist`,
                currentDailySpendUSD: this.dailySpendUSD,
                remainingDailyBudgetUSD: this.getRemainingBudget()
            };
        }
        // 4. Autonomous threshold check
        const requiresHuman = intent.amountUSD > this.config.autoApproveThresholdUSD;
        return {
            passed: true,
            requiresHumanConfirmation: requiresHuman,
            currentDailySpendUSD: this.dailySpendUSD,
            remainingDailyBudgetUSD: this.getRemainingBudget()
        };
    }
    /**
     * Records a settled purchase and increments rolling daily spend.
     */
    recordSettlement(amountUSD) {
        this.checkDailyReset();
        this.dailySpendUSD += amountUSD;
    }
    checkDailyReset() {
        const ONE_DAY_MS = 24 * 60 * 60 * 1000;
        if (Date.now() - this.lastResetTimestamp >= ONE_DAY_MS) {
            this.dailySpendUSD = 0;
            this.lastResetTimestamp = Date.now();
        }
    }
}
