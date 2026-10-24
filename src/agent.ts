/**
 * Agent purchase flow: intent -> guardrail -> order -> capture -> ledger.
 *
 * Every external effect is a real PayPal call. When credentials are absent the
 * flow fails loudly instead of approving a fictional payment, and when the
 * guardrail requires human confirmation the flow stops before creating an order.
 */

import { PayPalClient, OrderAmount } from "./paypal/client.js";
import { SpendingGuard, SpendRequest } from "./guardrails/spending.js";

export interface PurchaseIntent extends SpendRequest {}

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

export class CheckoutAgent {
  constructor(
    private readonly client: PayPalClient,
    private readonly guard: SpendingGuard,
  ) {}

  private async step<T>(name: string, fn: () => Promise<T> | T, describe: (value: T) => string): Promise<{ trace: PurchaseTrace; value?: T }> {
    const started = Date.now();
    try {
      const value = await fn();
      return { trace: { step: name, ok: true, detail: describe(value), durationMs: Date.now() - started }, value };
    } catch (error) {
      return {
        trace: {
          step: name,
          ok: false,
          detail: error instanceof Error ? error.message.slice(0, 200) : String(error),
          durationMs: Date.now() - started,
        },
      };
    }
  }

  async purchase(
    intent: PurchaseIntent,
    options: { approved?: boolean; referenceId?: string; skipPayerApproval?: boolean } = {},
  ): Promise<PurchaseResult> {
    const trace: PurchaseTrace[] = [];

    const decision = this.guard.evaluate(intent);
    trace.push({
      step: "guardrail.evaluate",
      ok: decision.allowed,
      detail: decision.rule + " :: " + decision.reason,
      durationMs: 0,
    });
    if (!decision.allowed) return { status: "rejected", reason: decision.reason, trace };
    if (decision.requiresApproval && !options.approved) {
      return { status: "needs_approval", reason: decision.reason, trace };
    }

    const amount: OrderAmount = { currency_code: intent.currency, value: intent.amount.toFixed(2) };
    const created = await this.step(
      "paypal.create_order",
      () => this.client.createOrder({ amount, referenceId: options.referenceId ?? "agent-purchase", customId: intent.purpose.slice(0, 120) }),
      (order) => "order " + order.id + " status " + order.status,
    );
    trace.push(created.trace);
    if (!created.value) return { status: "failed", reason: created.trace.detail, trace };

    // A freshly created order with the PayPal payment source is CREATED, not
    // APPROVED: the payer has to approve it on the approval URL before capture is
    // legal. Skipping this check is what produces UNPROCESSABLE_ENTITY
    // ORDER_NOT_APPROVED, so the link is returned instead of guessed away.
    const approvalUrl = (created.value.links ?? []).find(
      (link) => link.rel === "payer-action" || link.rel === "approve",
    )?.href;

    if (!options.skipPayerApproval && created.value.status !== "APPROVED") {
      trace.push({
        step: "paypal.await_payer_approval",
        ok: Boolean(approvalUrl),
        detail: approvalUrl
          ? "order " + created.value.id + " is CREATED; payer approval required at " + approvalUrl
          : "order " + created.value.id + " has no approval link",
        durationMs: 0,
      });
      return {
        status: "awaiting_payer",
        reason: "PayPal requires payer approval before capture",
        orderId: created.value.id,
        approvalUrl,
        trace,
      };
    }

    const captured = await this.step(
      "paypal.capture_order",
      () => this.client.captureOrder(created.value!.id),
      (order) => "status " + order.status,
    );
    trace.push(captured.trace);
    if (!captured.value) return { status: "failed", reason: captured.trace.detail, orderId: created.value.id, approvalUrl, trace };

    this.guard.commit(intent, created.value.id);
    trace.push({ step: "guardrail.commit", ok: true, detail: "ledger updated, spent today " + this.guard.spent, durationMs: 0 });
    return {
      status: captured.value.status === "COMPLETED" ? "completed" : "failed",
      reason: "capture returned " + captured.value.status,
      orderId: created.value.id,
      capturedAmount: amount.value,
      trace,
    };
  }
}
