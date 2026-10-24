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

export const DEFAULT_GUARDRAILS: GuardrailConfig = {
  perTransactionCap: 50,
  dailyCap: 120,
  requireApprovalAbove: 35,
  allowedCurrencies: ["USD"],
};

export class SpendingGuard {
  private spentToday = 0;
  private readonly ledger: Array<{ at: number; amount: number; merchant: string; purpose: string; orderId?: string }> = [];

  constructor(private readonly config: GuardrailConfig = DEFAULT_GUARDRAILS) {}

  get spent(): number {
    return this.spentToday;
  }

  get history() {
    return [...this.ledger];
  }

  evaluate(request: SpendRequest): GuardrailDecision {
    const remaining = Math.max(0, this.config.dailyCap - this.spentToday);
    if (!Number.isFinite(request.amount) || request.amount <= 0) {
      return { allowed: false, requiresApproval: false, reason: "amount must be a positive number", rule: "amount.valid", remainingDaily: remaining };
    }
    if (!this.config.allowedCurrencies.includes(request.currency)) {
      return {
        allowed: false,
        requiresApproval: false,
        reason: "currency " + request.currency + " is not in the allowlist (" + this.config.allowedCurrencies.join(", ") + ")",
        rule: "currency.allowlist",
        remainingDaily: remaining,
      };
    }
    if (request.amount > this.config.perTransactionCap) {
      return {
        allowed: false,
        requiresApproval: false,
        reason: "amount " + request.amount + " exceeds the per-transaction cap of " + this.config.perTransactionCap,
        rule: "amount.per_transaction_cap",
        remainingDaily: remaining,
      };
    }
    if (request.amount > remaining) {
      return {
        allowed: false,
        requiresApproval: false,
        reason: "amount " + request.amount + " exceeds the remaining daily budget of " + remaining,
        rule: "amount.daily_cap",
        remainingDaily: remaining,
      };
    }
    const requiresApproval = request.amount > this.config.requireApprovalAbove;
    return {
      allowed: true,
      requiresApproval,
      reason: requiresApproval
        ? "amount above the " + this.config.requireApprovalAbove + " auto-approval threshold, human confirmation required"
        : "within every configured limit",
      rule: requiresApproval ? "approval.human_required" : "amount.within_limits",
      remainingDaily: remaining,
    };
  }

  commit(request: SpendRequest, orderId?: string): void {
    this.spentToday += request.amount;
    this.ledger.push({ at: Date.now(), amount: request.amount, merchant: request.merchant, purpose: request.purpose, orderId });
  }

  reset(): void {
    this.spentToday = 0;
  }
}
