# Agent Checkout over PayPal Orders v2

Purchase flow for an autonomous agent: guardrails decide locally, PayPal executes, every call is recorded.

| | |
| --- | --- |
| Auth | `POST /v1/oauth2/token`, Basic client-credentials, cached until 60 s before expiry |
| Orders | `POST /v2/checkout/orders` (intent CAPTURE), `GET /v2/checkout/orders/:id`, `POST .../capture` |
| Guardrails | per-transaction cap, rolling daily cap, currency allowlist, human-approval threshold |
| x402 | `buildChallenge` / `encodePayment` / `verifyPayment` for HTTP 402 flows |
| Measured run | 3 HTTP calls, order CREATED then COMPLETED, p50 49 ms |

Trace page: https://liutingqiu.github.io/paypal-agentic-checkout-sdk/  
Report: [`docs/technical-report.md`](docs/technical-report.md)

## Quick start

```bash
npm install && npm run build
node scripts/contract-server.mjs --port 8899
PAYPAL_CLIENT_ID=contract-client PAYPAL_CLIENT_SECRET=contract-secret \
  PAYPAL_BASE_URL=http://127.0.0.1:8899 npm run cli -- --amount 12.50 --merchant "Corner Coffee"
npm test        # 9 tests
```

For a real sandbox run, create an app at developer.paypal.com and drop `PAYPAL_BASE_URL`:

```bash
PAYPAL_CLIENT_ID=<id> PAYPAL_CLIENT_SECRET=<secret> npm run cli -- --amount 12.50 --merchant "Corner Coffee"
```

The client refuses to run without credentials. The previous version returned a token built from
`Math.random()` and never contacted PayPal; there is no simulated-token path left in the code.

## Flow

```
intent -> SpendingGuard.evaluate -> (needs_approval stops here)
       -> PayPalClient.createOrder -> captureOrder -> SpendingGuard.commit
```

A blocked or unapproved purchase produces zero order calls; the trace page shows that as an empty
HTTP table rather than a simulated success.

## Layout

```
src/paypal/client.ts        OAuth, orders, retry, error classes
src/guardrails/spending.ts  deterministic limits and the ledger
src/x402/middleware.ts      402 challenge build / encode / verify
src/agent.ts                orchestration plus the recorded trace
src/cli.ts                  one purchase, writes result/requests/metrics
scripts/contract-server.mjs Orders v2 shapes over real sockets
tests/paypal.test.js        9 tests
```
