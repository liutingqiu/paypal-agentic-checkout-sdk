# PayPal Agentic Checkout Gateway 💳🤖

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/Tests-7%2F7%20Passed-brightgreen)](tests/paypal_agent.test.js)
[![PayPal AI](https://img.shields.io/badge/PayPal-Orders%20API%20v2-blue)](https://developer.paypal.com/)
[![Live Terminal](https://img.shields.io/badge/Live%20Terminal-GitHub%20Pages-success)](https://liutingqiu.github.io/paypal-agentic-checkout-sdk/)

**Autonomous AI Agent Commerce & Micro-Payment Gateway for PayPal Sandbox and x402 Protocol with Multi-Tier Spending Guardrails.**

Submitted to the **Devpost — PayPal AI Hackathon ($67,500 Cash Prize Pool)**.

---

## 🌟 Overview

As autonomous AI agents (Claude Code, AutoGen, CrewAI) navigate the web to perform research, manage servers, and book services, they need a safe, standardized way to pay and get paid.

**PayPal Agentic Checkout Gateway** transforms PayPal's global infrastructure into the native financial engine for autonomous AI agents:
1. **PayPal Orders REST API v2 Integration:** Bridges LLM tool-calling with PayPal order creation, authorization, and capture in sandbox/production environments.
2. **Spending Guardrails & Safety Firewall:** Enforces single-transaction caps, daily rolling budgets, and auto-approval thresholds ($\le \$30$) so agents cannot drain user balances.
3. **HTTP 402 Protocol Adapter:** Implements standardized machine-readable payment challenge headers for paywalled APIs and micro-services.
4. **Interactive Web Storefront:** Live terminal simulator demonstrating agent purchases, guardrail checks, and sandbox captures.

---

## 🌐 Live Interactive Terminal

Experience the live agent storefront and simulate purchases online:  
👉 **[https://liutingqiu.github.io/paypal-agentic-checkout-sdk/](https://liutingqiu.github.io/paypal-agentic-checkout-sdk/)**

---

## 📦 Quick Start & Usage

```bash
git clone https://github.com/liutingqiu/paypal-agentic-checkout-sdk.git
cd paypal-agentic-checkout-sdk
npm install
npm test
```

### TypeScript / ESM Example

```typescript
import {
  PayPalOrdersClient,
  AgentSpendingGuardrailEngine,
  X402PaymentAdapter
} from 'paypal-agentic-checkout-sdk';

// 1. Initialize PayPal Client & Guardrail Engine
const client = new PayPalOrdersClient({
  clientId: process.env.PAYPAL_CLIENT_ID,
  clientSecret: process.env.PAYPAL_CLIENT_SECRET,
  environment: 'SANDBOX'
});

const guardrails = new AgentSpendingGuardrailEngine({
  maxSingleTxUSD: 150.0,
  dailyBudgetUSD: 500.0,
  autoApproveThresholdUSD: 30.0
});

// 2. Evaluate purchase intent
const intent = {
  intentId: 'int_01',
  agentId: 'agent_shopping_01',
  itemId: 'gpu_compute_slice',
  itemName: '10,000 GPU Tokens',
  amountUSD: 25.0,
  merchantId: 'cloud_merchant_01',
  reasoning: 'Acquiring compute capacity for batch analysis'
};

const check = guardrails.evaluateIntent(intent);
if (check.passed) {
  // 3. Create and capture PayPal order
  const order = await client.createOrder(intent);
  const capture = await client.captureOrder(order.orderId, intent.amountUSD);
  guardrails.recordSettlement(intent.amountUSD);
  console.log(`Payment Captured: ${capture.captureId} | Status: ${capture.status}`);
}
```

---

## 🧪 Automated Test Suite

Run the unit tests covering OAuth token rotation, order creation, capture responses, spending caps, and x402 headers:

```bash
node --test tests/paypal_agent.test.js
```

Output:
```text
✔ 1. PayPalOrdersClient generates and caches OAuth2 token (0.7ms)
✔ 2. PayPalOrdersClient creates PayPal v2 order with approval URL (0.2ms)
✔ 3. PayPalOrdersClient captures authorized order (0.1ms)
✔ 4. SpendingGuardrails permits autonomous purchase below auto-approve threshold ($30) (0.2ms)
✔ 5. SpendingGuardrails flags purchases above threshold for human confirmation (0.1ms)
✔ 6. SpendingGuardrails strictly rejects purchases exceeding single tx or daily cap (0.1ms)
✔ 7. X402PaymentAdapter creates valid HTTP 402 challenge and verifies settlement (0.1ms)

ℹ pass 7
ℹ fail 0
```

---

## 📖 Hackathon Documentation

Read the full project pitch deck, architectural rationale, and market impact analysis:  
👉 **[PITCH_DECK.md](PITCH_DECK.md)**

---

## 📄 License

Released under the [MIT License](LICENSE).
