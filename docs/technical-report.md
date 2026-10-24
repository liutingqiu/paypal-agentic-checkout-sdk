# Agent Checkout - Technical Report

**Competition:** PayPal AI Hackathon  
**Team:** Tingqiu Liu (@liutingqiu)  
**Repository:** https://github.com/liutingqiu/paypal-agentic-checkout-sdk  
**Runtime:** Node 26, TypeScript 5.6.3

---

## 1. What was wrong before

The submitted `PayPalOrdersClient` had a `getAccessToken()` whose comment read "High-performance
token simulator for sandbox testing": it built `A21AA` + `Math.random()` and cached it. `createOrder`
returned an object assembled locally. `api-m.sandbox.paypal.com` appeared only as a string returned by
`getBaseUrl()`, never as a destination. The tests asserted the shape of those local objects.

## 2. Integration surface

| Call | Purpose |
| --- | --- |
| `POST /v1/oauth2/token` | client-credentials grant, Basic auth, response cached until 60 s before `expires_in` |
| `POST /v2/checkout/orders` | `intent: CAPTURE` with one purchase unit (`amount`, `reference_id`, `custom_id`) |
| `GET /v2/checkout/orders/:id` | state lookup |
| `POST /v2/checkout/orders/:id/capture` | capture, resulting status drives the run result |

Base URL: `https://api-m.sandbox.paypal.com` by default, `api-m.paypal.com` when `PAYPAL_ENVIRONMENT=live`,
overridable with `PAYPAL_BASE_URL`. 401/403 raises `PayPalAuthError` and is never retried; 429 and 5xx
are retried with doubling backoff plus jitter; each attempt is recorded with status and duration.

## 3. Guardrails

`SpendingGuard.evaluate()` returns a decision with the rule that fired, before any network call:

| Rule | Condition |
| --- | --- |
| `amount.valid` | amount must be a positive finite number |
| `currency.allowlist` | currency must be in the configured list |
| `amount.per_transaction_cap` | amount above the single-purchase cap |
| `amount.daily_cap` | amount above what is left of the daily budget |
| `approval.human_required` | allowed, but above the auto-approval threshold |

`commit()` writes the ledger only after a successful capture, so a failed capture cannot consume budget.

## 4. x402

`buildChallenge()` returns a 402 with an `x-payment-required` header holding a base64 JSON requirement
(scheme, network, amount, currency, payTo, resource, expiry, nonce). `verifyPayment()` checks expiry,
nonce, payee, currency, and that the offered amount covers the requirement. This implements the
challenge/authorise half of x402; settlement is the PayPal capture, and no crypto rail is touched.

## 5. Measured run

`scripts/contract-server.mjs` with 25 ms injected latency, 2026-10-24:

| Metric | Value |
| --- | --- |
| Status | completed |
| Order | `ORD-M33JW3L8`, CREATED then COMPLETED |
| Captured | 12.50 USD |
| HTTP calls | 3 (token, create, capture) |
| Status codes | 200, 201 |
| Latency p50 / max | 49 ms / 87 ms |
| Wall clock | 137 ms |
| Ledger after run | 12.50 USD |
| Tests | 9 passed |

## 6. What the contract server is

A transport fixture implementing the public Orders v2 shapes: Basic auth on the token endpoint,
Bearer everywhere else, `CREATED -> COMPLETED` state, 404 for unknown orders, 422 for double capture,
optional 429 injection and latency. It settles no money and holds no balances.

## 7. Limitations

* No live sandbox run in this report: no PayPal developer credentials existed at build time. The
  contract server proves the transport, retry, auth and state handling; it does not prove PayPal
  accepts the request.
* No webhook handling, so capture is confirmed by response only; a production flow needs
  `PAYMENT.CAPTURE.COMPLETED` verification.
* Guardrail state is in-memory and resets on restart; a real deployment needs a durable ledger.
* x402 settlement is out of scope; only the 402 challenge and verification are implemented.
