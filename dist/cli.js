/**
 * One agent purchase, end to end, with artifacts written for inspection.
 *
 *   node dist/cli.js --amount 12.50 --merchant "Corner Coffee" --purpose "team breakfast"
 *
 * Without PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET the run stops before creating
 * an order and says so. Point PAYPAL_BASE_URL at the contract server to test the
 * transport offline.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CheckoutAgent } from "./agent.js";
import { PayPalClient, resolveBaseUrl } from "./paypal/client.js";
import { SpendingGuard, DEFAULT_GUARDRAILS } from "./guardrails/spending.js";
function arg(name, fallback) {
    const index = process.argv.indexOf("--" + name);
    return index >= 0 ? process.argv[index + 1] : fallback;
}
async function main() {
    const outDir = arg("out", "runs/last");
    const amount = Number(arg("amount", "12.50"));
    const merchant = arg("merchant", "Corner Coffee");
    const purpose = arg("purpose", "team breakfast");
    const approved = process.argv.includes("--approved");
    const records = [];
    const client = new PayPalClient({
        clientId: process.env.PAYPAL_CLIENT_ID ?? "",
        clientSecret: process.env.PAYPAL_CLIENT_SECRET ?? "",
        baseUrl: resolveBaseUrl(),
        onRequest: (record) => records.push(record),
    });
    const guard = new SpendingGuard(DEFAULT_GUARDRAILS);
    const agent = new CheckoutAgent(client, guard);
    if (!client.configured) {
        console.error("PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET are not set; no order was created.");
        return 2;
    }
    const started = Date.now();
    // Second half of the two-phase flow: capture an order the payer approved.
    const captureOrderId = arg("capture-order");
    if (captureOrderId) {
        const order = await client.getOrder(captureOrderId);
        const statusBefore = order.status;
        const captured = await client.captureOrder(captureOrderId);
        mkdirSync(outDir, { recursive: true });
        writeFileSync(join(outDir, "capture.json"), JSON.stringify(captured, null, 2));
        const summary = { orderId: captureOrderId, statusBefore, statusAfter: captured.status, requests: records.length };
        writeFileSync(join(outDir, "metrics.json"), JSON.stringify(summary, null, 2));
        console.log(JSON.stringify(summary, null, 2));
        return captured.status === "COMPLETED" ? 0 : 1;
    }
    const card = process.argv.includes("--card")
        ? { number: process.env.PAYPAL_TEST_CARD ?? "4032039899785273", expiry: "2030-12", securityCode: "123", billingName: "Sandbox Agent" }
        : undefined;
    const result = await agent.purchase({ amount, currency: "USD", merchant, purpose }, { approved, card });
    const wallMs = Date.now() - started;
    const durations = records.map((record) => Number(record.durationMs)).sort((a, b) => a - b);
    const metrics = {
        status: result.status,
        reason: result.reason,
        orderId: result.orderId ?? null,
        capturedAmount: result.capturedAmount ?? null,
        httpRequests: records.length,
        httpStatuses: [...new Set(records.map((record) => record.status))],
        retries: records.filter((record) => Number(record.attempt) > 0).length,
        latencyMs: {
            p50: durations.length ? durations[Math.floor(durations.length / 2)] : null,
            max: durations.length ? durations[durations.length - 1] : null,
        },
        endpoint: client.isLocalEndpoint ? "contract-server" : client.baseUrl,
        wallMs,
        spentToday: guard.spent,
        trace: result.trace,
    };
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "result.json"), JSON.stringify(result, null, 2));
    writeFileSync(join(outDir, "requests.json"), JSON.stringify(records, null, 2));
    writeFileSync(join(outDir, "metrics.json"), JSON.stringify(metrics, null, 2));
    console.log(JSON.stringify(metrics, null, 2));
    return result.status === "completed" || result.status === "needs_approval" ? 0 : 1;
}
main().then((code) => process.exit(code)).catch((error) => {
    console.error(error);
    process.exit(3);
});
