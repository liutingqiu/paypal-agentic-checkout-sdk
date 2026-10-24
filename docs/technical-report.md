# Agent Checkout - Technical Report

**Competition:** PayPal AI Hackathon  
**Team:** Tingqiu Liu (@liutingqiu)  
**Repository:** https://github.com/liutingqiu/paypal-agentic-checkout-sdk  
**Runtime:** Node 26, TypeScript 5.6.3

---

## 1. What was wrong before

The submitted `PayPalOrdersClient.getAccessToken()` carried the comment "High-performance token
simulator for sandbox testing" and built `A21AA` + `Math.random()`. `createOrder` assembled an object
locally. `api-m.sandbox.paypal.com` appeared only as a string from `getBaseUrl()`. Nothing in the
repository had ever contacted PayPal.

## 2. Integration surface

| Call | Purpose |
| --- | --- |
| `POST /v1/oauth2/token` | client-credentials grant, Basic auth, cached until 60 s before `expires_in` |
| `POST /v2/checkout/orders` | `intent: CAPTURE`, one purchase unit |
| `GET /v2/checkout/orders/:id` | state lookup before capture |
| `POST /v2/checkout/orders/:id/capture` | capture, status drives the run result |

401/403 raises `PayPalAuthError` and is never retried. 429/5xx retry with doubling backoff plus
jitter. Every attempt is recorded with status and duration.

## 3. Real sandbox evidence

Run against `https://api-m.sandbox.paypal.com` with a sandbox app created on the developer dashboard:

| Step | Result |
| --- | --- |
| `POST /v1/oauth2/token` | 200, access token issued |
| `POST /v2/checkout/orders` | 201, order `3AK81340R0019721S`, status `CREATED`, `payer-action` link returned |
| `POST .../capture` (before approval) | **422** `UNPROCESSABLE_ENTITY`, issue `ORDER_NOT_APPROVED` |
| Round-trip latency | 1548 ms (create), 702 ms (rejected capture), 905 ms p50 |

That 422 is the finding that changed the design. The first version of this integration assumed
create-then-capture; PayPal requires payer approval in between. The agent now stops at
`awaiting_payer` and returns the approval link, and `--capture-order` performs the second phase.

The sandbox checkout page itself would not accept an automated confirmation click, so the approval
and the resulting `COMPLETED` capture were not executed in this session. What is proven: the token,
the order creation, the approval-link issuance, and the fact that capture without approval fails in
exactly the documented way.

## 4. Fixture evidence

`scripts/contract-server.mjs --auto-approve` models a payer who already approved, which is the only
way to run the capture path without a human:

| Metric | Value |
| --- | --- |
| Order | `ORD-3KSE8QP8` |
| Status | completed |
| HTTP calls | 3 (token, create, capture) |
| Latency p50 | 25 ms injected + overhead |

This run proves the client and the state machine. It does not prove PayPal accepts the request; §3
is what covers that, and §3 stops one step earlier.

## 5. Guardrails

Evaluated before any network call, each with its own rule id: `amount.valid`,
`currency.allowlist`, `amount.per_transaction_cap`, `amount.daily_cap`,
`approval.human_required`. `commit()` writes the ledger only after a successful capture, so a failed
capture cannot consume budget. Tests assert that an unapproved purchase produces zero order calls.

## 6. x402

`buildChallenge()` returns 402 with an `x-payment-required` base64 JSON requirement (scheme, network,
amount, currency, payTo, resource, expiry, nonce). `verifyPayment()` checks expiry, nonce, payee,
currency and that the offered amount covers the requirement. Only the challenge and verification
halves are implemented; settlement is the PayPal capture, and no crypto rail is touched.

## 7. Limitations

* No `COMPLETED` sandbox transaction: the payer approval needs a human at the PayPal checkout page.
* No webhook handling; capture is confirmed by response only.
* Guardrail state is in-memory and resets on restart.
* The contract server models approval with a flag rather than implementing the approval handshake.
