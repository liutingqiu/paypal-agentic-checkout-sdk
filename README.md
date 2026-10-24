# Agent Checkout over PayPal Orders v2

Autonomous purchase flow: guardrails decide locally, PayPal executes, every call is recorded.

| Run | Endpoint | Result |
| --- | --- | --- |
| Card settlement | api-m.sandbox.paypal.com | **completed**, order `4VB84323BA045715C`, 1.00 USD, 2 calls |
| Wallet approval | api-m.sandbox.paypal.com | **awaiting_payer**, order `3AK81340R0019721S`, payer-action link issued |
| Fixture capture | contract server | **completed**, order `ORD-3KSE8QP8`, exercises the capture branch offline |

Trace page: https://liutingqiu.github.io/paypal-agentic-checkout-sdk/  
Report: [`docs/technical-report.md`](docs/technical-report.md)

## Three things the live sandbox taught this code

1. **Capture needs approval.** A wallet order is created as `CREATED`; capturing it returns
   `422 UNPROCESSABLE_ENTITY / ORDER_NOT_APPROVED`. The agent now stops at `awaiting_payer` and
   returns the `payer-action` link, and `--capture-order` runs the second phase.
2. **A payment source needs an idempotency key.** Posting `payment_source.card` without
   `PayPal-Request-Id` returns `400 PAYPAL_REQUEST_ID_REQUIRED`.
3. **Cards settle at creation.** A card order returns `COMPLETED` straight from
   `POST /v2/checkout/orders`, and a second capture is rejected with `ORDER_ALREADY_CAPTURED`, so
   that status is treated as done.

## Run it

```bash
npm install && npm run build

# live card settlement (sandbox test card)
PAYPAL_CLIENT_ID=... PAYPAL_CLIENT_SECRET=... PAYPAL_TEST_CARD=4111111111111111 \
  npm run cli -- --amount 1.00 --merchant "Sandbox Coffee Co" --card

# live wallet order, then capture after the payer approves
PAYPAL_CLIENT_ID=... PAYPAL_CLIENT_SECRET=... npm run cli -- --amount 1.00
PAYPAL_CLIENT_ID=... PAYPAL_CLIENT_SECRET=... npm run cli -- --capture-order <ORDER_ID>

# offline
node scripts/contract-server.mjs --port 8899 --auto-approve
PAYPAL_CLIENT_ID=contract-client PAYPAL_CLIENT_SECRET=contract-secret \
  PAYPAL_BASE_URL=http://127.0.0.1:8899 npm run cli -- --amount 12.50
npm test   # 9 tests
```

## Layout

```
src/paypal/client.ts        OAuth, orders (wallet + card), retry, error classes
src/guardrails/spending.ts  per-transaction cap, daily cap, allowlist, approval threshold
src/x402/middleware.ts      402 challenge build / encode / verify
src/agent.ts                create -> settlement or approval gate -> capture -> commit
src/cli.ts                  create, card settle, capture, or fixture run
scripts/contract-server.mjs Orders v2 shapes over real sockets
tests/paypal.test.js        9 tests
data/{sandbox-card,sandbox,contract}/  recorded artifacts for each run
```
