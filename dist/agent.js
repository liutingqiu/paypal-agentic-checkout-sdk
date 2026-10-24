/**
 * Agent purchase flow: intent -> guardrail -> order -> capture -> ledger.
 *
 * Every external effect is a real PayPal call. When credentials are absent the
 * flow fails loudly instead of approving a fictional payment, and when the
 * guardrail requires human confirmation the flow stops before creating an order.
 */
export class CheckoutAgent {
    client;
    guard;
    constructor(client, guard) {
        this.client = client;
        this.guard = guard;
    }
    async step(name, fn, describe) {
        const started = Date.now();
        try {
            const value = await fn();
            return { trace: { step: name, ok: true, detail: describe(value), durationMs: Date.now() - started }, value };
        }
        catch (error) {
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
    async purchase(intent, options = {}) {
        const trace = [];
        const decision = this.guard.evaluate(intent);
        trace.push({
            step: "guardrail.evaluate",
            ok: decision.allowed,
            detail: decision.rule + " :: " + decision.reason,
            durationMs: 0,
        });
        if (!decision.allowed)
            return { status: "rejected", reason: decision.reason, trace };
        if (decision.requiresApproval && !options.approved) {
            return { status: "needs_approval", reason: decision.reason, trace };
        }
        const amount = { currency_code: intent.currency, value: intent.amount.toFixed(2) };
        const created = await this.step("paypal.create_order", () => this.client.createOrder({
            amount,
            referenceId: options.referenceId ?? "agent-purchase",
            customId: intent.purpose.slice(0, 120),
            card: options.card,
        }), (order) => "order " + order.id + " status " + order.status);
        trace.push(created.trace);
        if (!created.value)
            return { status: "failed", reason: created.trace.detail, trace };
        // A freshly created order with the PayPal payment source is CREATED, not
        // APPROVED: the payer has to approve it on the approval URL before capture is
        // legal. Skipping this check is what produces UNPROCESSABLE_ENTITY
        // ORDER_NOT_APPROVED, so the link is returned instead of guessed away.
        const approvalUrl = (created.value.links ?? []).find((link) => link.rel === "payer-action" || link.rel === "approve")?.href;
        // A card payment source settles immediately: PayPal returns COMPLETED from
        // create, and a second capture is rejected with ORDER_ALREADY_CAPTURED.
        if (created.value.status === "COMPLETED") {
            trace.push({
                step: "paypal.settled_on_create",
                ok: true,
                detail: "order " + created.value.id + " returned COMPLETED, capture not needed",
                durationMs: 0,
            });
            this.guard.commit(intent, created.value.id);
            trace.push({ step: "guardrail.commit", ok: true, detail: "ledger updated, spent today " + this.guard.spent, durationMs: 0 });
            return {
                status: "completed",
                reason: "card settlement completed during order creation",
                orderId: created.value.id,
                capturedAmount: amount.value,
                trace,
            };
        }
        // A card payment source is approved out of band, so capture is legal straight away.
        const needsPayer = !options.card && !options.skipPayerApproval;
        if (needsPayer && created.value.status !== "APPROVED") {
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
        const captured = await this.step("paypal.capture_order", () => this.client.captureOrder(created.value.id), (order) => "status " + order.status);
        trace.push(captured.trace);
        if (!captured.value)
            return { status: "failed", reason: captured.trace.detail, orderId: created.value.id, approvalUrl, trace };
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
