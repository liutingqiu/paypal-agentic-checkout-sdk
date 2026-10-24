/**
 * Tests against the PayPal contract server over real HTTP.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";

const PORT = 8899 + Math.floor(Math.random() * 150);
const BASE = "http://127.0.0.1:" + PORT;
const ID = "contract-client";
const SECRET = "contract-secret";

async function startServer(extra = []) {
  const child = spawn(process.execPath, ["scripts/contract-server.mjs", "--port", String(PORT), ...extra], { stdio: ["ignore", "pipe", "pipe"] });
  for (let i = 0; i < 60; i += 1) {
    try {
      if ((await fetch(BASE + "/health")).ok) return child;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("contract server did not start");
}

async function stopServer(child) {
  child.kill();
  await once(child, "exit");
}

const lib = await import("../dist/index.js");
const { PayPalClient, PayPalAuthError, SpendingGuard, DEFAULT_GUARDRAILS, CheckoutAgent, buildChallenge, encodePayment, verifyPayment, decodePayment } = lib;

function client(overrides = {}) {
  return new PayPalClient({ clientId: ID, clientSecret: SECRET, baseUrl: BASE, ...overrides });
}

test("token endpoint rejects wrong credentials with an auth error", async () => {
  const child = await startServer();
  try {
    const bad = new PayPalClient({ clientId: ID, clientSecret: "nope", baseUrl: BASE, maxRetries: 0 });
    await assert.rejects(() => bad.accessToken(), PayPalAuthError);
  } finally {
    await stopServer(child);
  }
});

test("token is fetched once and then served from cache", async () => {
  const child = await startServer();
  try {
    const calls = [];
    const api = client({ onRequest: (record) => calls.push(record) });
    const first = await api.accessToken();
    const second = await api.accessToken();
    assert.equal(first, second);
    assert.equal(calls.filter((call) => call.path === "/v1/oauth2/token").length, 1);
  } finally {
    await stopServer(child);
  }
});

test("create then capture moves the order to COMPLETED", async () => {
  const child = await startServer();
  try {
    const api = client();
    const order = await api.createOrder({ amount: { currency_code: "USD", value: "9.99" } });
    assert.equal(order.status, "CREATED");
    const captured = await api.captureOrder(order.id);
    assert.equal(captured.status, "COMPLETED");
    const fetched = await api.getOrder(order.id);
    assert.equal(fetched.status, "COMPLETED");
  } finally {
    await stopServer(child);
  }
});

test("retries a 429 before succeeding", async () => {
  const child = await startServer(["--fail-first", "2"]);
  try {
    const calls = [];
    const api = client({ maxRetries: 3, onRequest: (record) => calls.push(record) });
    const order = await api.createOrder({ amount: { currency_code: "USD", value: "1.00" } });
    assert.ok(order.id);
    assert.equal(calls.filter((call) => call.status === 429).length, 2);
  } finally {
    await stopServer(child);
  }
});

test("guardrail blocks an amount above the per-transaction cap", () => {
  const guard = new SpendingGuard(DEFAULT_GUARDRAILS);
  const decision = guard.evaluate({ amount: 500, currency: "USD", merchant: "X", purpose: "y" });
  assert.equal(decision.allowed, false);
  assert.equal(decision.rule, "amount.per_transaction_cap");
});

test("guardrail blocks a currency outside the allowlist and tracks the daily budget", () => {
  const guard = new SpendingGuard(DEFAULT_GUARDRAILS);
  assert.equal(guard.evaluate({ amount: 5, currency: "EUR", merchant: "X", purpose: "y" }).rule, "currency.allowlist");
  guard.commit({ amount: 50, currency: "USD", merchant: "X", purpose: "y" }, "ORD-1");
  guard.commit({ amount: 50, currency: "USD", merchant: "X", purpose: "y" }, "ORD-2");
  const decision = guard.evaluate({ amount: 30, currency: "USD", merchant: "X", purpose: "y" });
  assert.equal(decision.allowed, false);
  assert.equal(decision.rule, "amount.daily_cap");
});

test("amount above the approval threshold stops before any order is created", async () => {
  const child = await startServer();
  try {
    const calls = [];
    const api = client({ onRequest: (record) => calls.push(record) });
    const guard = new SpendingGuard(DEFAULT_GUARDRAILS);
    const agent = new CheckoutAgent(api, guard);
    const result = await agent.purchase({ amount: 40, currency: "USD", merchant: "Shop", purpose: "supplies" });
    assert.equal(result.status, "needs_approval");
    assert.equal(calls.filter((call) => call.path === "/v2/checkout/orders").length, 0);
    assert.equal(guard.spent, 0);
  } finally {
    await stopServer(child);
  }
});

test("approved purchase completes and updates the ledger", async () => {
  const child = await startServer();
  try {
    const api = client();
    const guard = new SpendingGuard(DEFAULT_GUARDRAILS);
    const agent = new CheckoutAgent(api, guard);
    const result = await agent.purchase({ amount: 12.5, currency: "USD", merchant: "Corner Coffee", purpose: "team breakfast" });
    assert.equal(result.status, "completed");
    assert.ok(result.orderId.startsWith("ORD-"));
    assert.equal(result.capturedAmount, "12.50");
    assert.equal(guard.spent, 12.5);
    assert.ok(result.trace.every((step) => step.ok));
  } finally {
    await stopServer(child);
  }
});

test("x402 challenge round-trips and rejects a mismatched nonce", () => {
  const challenge = buildChallenge({ network: "contract", amount: "0.25", currency: "USD", payTo: "merchant-1", resource: "/premium/thing" });
  assert.equal(challenge.status, 402);
  const requirement = JSON.parse(Buffer.from(challenge.headers["x-payment-required"], "base64").toString("utf8"));
  const good = encodePayment({ nonce: requirement.nonce, amount: "0.25", currency: "USD", payTo: "merchant-1" });
  assert.equal(verifyPayment(requirement, decodePayment(good)).ok, true);
  const bad = encodePayment({ nonce: "wrong", amount: "0.25", currency: "USD", payTo: "merchant-1" });
  assert.equal(verifyPayment(requirement, decodePayment(bad)).ok, false);
  const cheap = encodePayment({ nonce: requirement.nonce, amount: "0.01", currency: "USD", payTo: "merchant-1" });
  assert.equal(verifyPayment(requirement, decodePayment(cheap)).ok, false);
});
