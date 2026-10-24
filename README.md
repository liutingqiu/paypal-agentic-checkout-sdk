# Agent Checkout over PayPal Orders v2

Purchase flow for an autonomous agent: guardrails decide locally, PayPal executes, every call is recorded.

| | |
| --- | --- |
| Auth | `POST /v1/oauth2/token`, Basic client-credentials, cached until 60 s before expiry |
| Orders | `POST /v2/checkout/orders` (intent CAPTURE), `GET /v2/checkout/orders/:id`, `POST .../capture` |
| Guardrails | per-transaction cap, daily cap, currency allowlist, approval threshold |
| x402 | `buildChallenge` / `encodePayment` / `verifyPayment` for HTTP 402 flows |
| Sandbox run | order `3AK81340R0019721S` created against api-m.sandbox.paypal.com, status CREATED, approval link issued |
| Fixture run | order `ORD-3KSE8QP8` CREATED -> COMPLETED, captures the whole path offline |

Trace page: https://liutingqiu.github.io/paypal-agentic-checkout-sdk/  
Report: [`docs/technical-report.md`](docs/technical-report.md)

## Two phases, because PayPal says so

A newly created order is `CREATED`, not approved. Capturing it returns
`422 UNPROCESSABLE_ENTITY / ORDER_NOT_APPROVED`; that response is recorded in this repository's
history and is the reason the agent returns the `payer-action` link instead of assuming capture.

```bash
# phase 1 - create, print the approval link
PAYPAL_CLIENT_ID=... PAYPAL_CLIENT_SECRET=... npm run cli -- --amount 1.00 --merchant "Sandbox Coffee Co"
# -> status awaiting_payer, approvalUrl https://www.sandbox.paypal.com/checkoutnow?token=...

# phase 2 - after the payer approves
PAYPAL_CLIENT_ID=... PAYPAL_CLIENT_SECRET=... npm run cli -- --capture-order <ORDER_ID>
```

## Offline

```bash
npm install && npm run build
node scripts/contract-server.mjs --port 8899 --auto-approve   # models an already-approved payer
PAYPAL_CLIENT_ID=contract-client PAYPAL_CLIENT_SECRET=contract-secret \
  PAYPAL_BASE_URL=http://127.0.0.1:8899 npm run cli -- --amount 12.50
npm test    # 9 tests
```

## Layout

```
src/paypal/client.ts        OAuth, orders, retry, error classes
src/guardrails/spending.ts  deterministic limits and the ledger
src/x402/middleware.ts      402 challenge build / encode / verify
src/agent.ts                create -> approval gate -> capture -> commit, with trace
src/cli.ts                  create, capture, or record a purchase
scripts/contract-server.mjs Orders v2 shapes over real sockets
tests/paypal.test.js        9 tests
data/sandbox/               artifacts from the real sandbox run
data/contract/              artifacts from the fixture run
```
