# Agent Checkout - Technical Report

**Competition:** PayPal AI Hackathon  
**Team:** Tingqiu Liu (@liutingqiu)  
**Repository:** https://github.com/liutingqiu/paypal-agentic-checkout-sdk  
**Runtime:** Node 26, TypeScript 5.6.3

---

## 1. What was wrong before

The submitted client carried the comment "High-performance token simulator for sandbox testing" on
`getAccessToken()`, which built a token from `Math.random()`. `createOrder` assembled its object
locally, and `api-m.sandbox.paypal.com` existed only as a string. No request had ever left the
process.

## 2. Integration surface

| Call | Purpose |
| --- | --- |
| `POST /v1/oauth2/token` | client-credentials grant, Basic auth, cached until 60 s before expiry |
| `POST /v2/checkout/orders` | `intent: CAPTURE`; optional `payment_source.card`; `PayPal-Request-Id` always sent |
| `GET /v2/checkout/orders/:id` | state lookup before capture |
| `POST /v2/checkout/orders/:id/capture` | capture, only when the order is APPROVED |

401/403 raises `PayPalAuthError` without retry; 429/5xx retry with doubling backoff plus jitter.
Each attempt is recorded with status and duration.

## 3. Live sandbox evidence

Two runs against `https://api-m.sandbox.paypal.com`, sandbox app created on the developer dashboard.

**Card settlement (completed).** Order `4VB84323BA045715C`, 1.00 USD, 2 HTTP calls (token, create),
201 on create with status `COMPLETED`, p50 round trip 4156 ms. Settlement happened during creation,
so no capture was issued.

**Wallet approval (awaiting_payer).** Order `3AK81340R0019721S` created with status `CREATED` and a
`payer-action` link. A direct capture attempt returned:

```
422 UNPROCESSABLE_ENTITY
details: ORDER_NOT_APPROVED  "Payer has not yet approved the Order for payment."
```

That response is the most useful thing the sandbox produced, because it invalidated the original
create-then-capture assumption. The agent now returns the approval link and stops; `--capture-order`
completes the flow once a payer approves.

## 4. Contract fixture

`scripts/contract-server.mjs --auto-approve` models a payer who already approved, which is the only
way to run the approved-capture branch without a human: order `ORD-3KSE8QP8`, `CREATED -> APPROVED
-> COMPLETED`, 3 calls. It proves the client and state machine; §3 proves PayPal accepts the
requests.

## 5. Guardrails

Evaluated before any network call, each with a rule id: `amount.valid`, `currency.allowlist`,
`amount.per_transaction_cap`, `amount.daily_cap`, `approval.human_required`. The ledger commits
only after settlement, so neither a rejected purchase nor a failed capture consumes budget. Tests
assert an unapproved purchase issues zero order calls.

## 6. x402

`buildChallenge()` returns 402 with an `x-payment-required` base64 JSON requirement; `verifyPayment()`
checks expiry, nonce, payee, currency and amount coverage. Only the challenge and verification halves
are implemented; settlement stays on PayPal.

## 7. What the sandbox forced us to change

| Finding | Change |
| --- | --- |
| `422 ORDER_NOT_APPROVED` on capture | two-phase flow, approval link returned, `--capture-order` |
| `400 PAYPAL_REQUEST_ID_REQUIRED` with `payment_source` | `PayPal-Request-Id` sent on every create |
| `201` with status `COMPLETED` for card | settlement branch, capture skipped, ledger committed |

## 8. Limitations

* Card settlement used PayPal's documented sandbox test card, not a real funding instrument.
* The wallet approval leg was not completed end to end: the sandbox checkout page refused an
  automated confirmation click, so `COMPLETED` for the wallet path rests on §4 rather than §3.
* No webhook handling; settlement is confirmed by the create/capture response only.
* Guardrail state is in-memory and resets on restart.
