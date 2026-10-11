# PayPal Agentic Checkout Gateway: Autonomous AI Agent Commerce & Micro-Payments 💳🤖

> **Submitted to Devpost — PayPal AI Hackathon ($67,500 Cash Prize Pool)**  
> **Theme:** Build what's next with PayPal and AI  
> **Live Interactive Terminal:** [https://liutingqiu.github.io/paypal-agentic-checkout-sdk/](https://liutingqiu.github.io/paypal-agentic-checkout-sdk/)  
> **Open Source GitHub Repository:** [https://github.com/liutingqiu/paypal-agentic-checkout-sdk](https://github.com/liutingqiu/paypal-agentic-checkout-sdk)  
> **Lead Engineer & Author:** Tingqiu Liu (`@liutingqiu`, `tianqi689@gmail.com`)

---

## 🎯 Executive Summary & The Problem

As autonomous AI agents (Claude Code, AutoGen, CrewAI, LangChain) transition from answering questions to executing real-world tasks, they face a critical financial roadblock:
1. **Agents Cannot Pay:** When an agent needs to rent a GPU instance, purchase API credits, or subscribe to premium data, it hits paywalls with no native payment rail.
2. **The "Rogue Agent" Financial Risk:** Giving an AI agent direct access to credit cards or unrestricted bank accounts is dangerous. Hallucinations or prompt injections could drain a user's balance within minutes.
3. **Lack of Standardized Protocols:** Web services currently lack an automated way to issue payment challenges to machine agents.

---

## 💡 The Solution: PayPal Agentic Checkout Gateway

**PayPal Agentic Checkout Gateway** is a production-ready TypeScript SDK and developer framework that turns PayPal's global payment network into the native financial rail for autonomous AI agents.

### Core Architectural Innovations:

### 1. PayPal Orders REST API v2 Agentic Wrapper
- Bridges LLM tool-calling with PayPal's Orders API v2 (`createOrder` with `CAPTURE` intent and `captureOrder`).
- Automatically manages OAuth2 client credentials token rotation and caching.
- Native sandbox simulation environment for instant testing without financial risk.

### 2. Multi-Tiered Spending Guardrails & Intent Firewall
Protects users against agent over-spending:
- **Autonomous Auto-Approve Threshold:** Micro-payments below a configurable limit (e.g. $\le \$30$) are executed autonomously.
- **Human Confirmation Escrow:** Purchases above the threshold pause and generate an interactive approval request for the human owner.
- **Hard Single-Transaction & Daily Rolling Budget Caps:** Strictly rejects purchases exceeding single caps (e.g. $\$150$) or daily quotas (e.g. $\$500$).
- **Merchant Whitelisting:** Restricts agent spending to approved PayPal merchant IDs.

### 3. HTTP 402 "Payment Required" Agentic Protocol
- Standardized middleware implementing the HTTP 402 protocol.
- API endpoints can issue 402 challenge headers (`WWW-Authenticate: x402 protocol=paypal`), which autonomous agents parse, fund via PayPal, and redeem with cryptographic settlement proofs.

### 4. Interactive Live Terminal & Storefront
- Deployed on **GitHub Pages** with zero setup.
- Features a simulated agent micro-services storefront (GPU tokens, storage quotas, audit reports) and real-time execution logs.

---

## 🛠️ Architecture & Tech Stack

```text
paypal-agentic-checkout-sdk/
├── src/
│   ├── types.ts                   # Credentials, PurchaseIntents, Guardrails, x402 schemas
│   ├── paypal/
│   │   └── orders.ts              # PayPal REST API v2 client (OAuth2 tokens, create, capture)
│   ├── guardrails/
│   │   └── spending.ts            # Intent evaluation, budget caps, rolling spend manager
│   ├── x402/
│   │   └── middleware.ts          # HTTP 402 Payment Required agent adapter
│   └── index.ts                   # Unified library entrypoint
├── tests/
│   └── paypal_agent.test.js       # 7 automated unit tests (OAuth, orders, capture, guardrails)
├── index.html                     # Live interactive web terminal & storefront
├── PITCH_DECK.md                  # Hackathon pitch deck & submission document
└── README.md                      # Developer documentation & quickstart
```

- **Runtime:** Node.js (ESM), TypeScript 5.6
- **Test Suite:** `node:test` + `node:assert/strict` (7/7 passed, 100% green)
- **Frontend:** Pure HTML5/CSS/JS (PayPal Fintech aesthetic, deployed on GitHub Pages)
- **PayPal APIs:** Orders API v2, Payments Capture v2, OAuth2 Token Grant

---

## 🔬 Test Suite Verification

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

## 🚀 Impact Potential on the PayPal Ecosystem

1. **Unlocking Agentic Commerce:** Positions PayPal as the default payment rail for millions of autonomous AI agents operating across the web.
2. **Consumer Safety First:** By introducing transparent spending guardrails, users can confidently deploy autonomous agents without fear of unexpected financial loss.
3. **New Merchant Revenue:** Merchants integrating the SDK can seamlessly sell compute, APIs, and digital goods directly to AI agents.

---

## 🏆 Project Deliverables & Links

- **Live Interactive Terminal:** [https://liutingqiu.github.io/paypal-agentic-checkout-sdk/](https://liutingqiu.github.io/paypal-agentic-checkout-sdk/)
- **GitHub Repository:** [https://github.com/liutingqiu/paypal-agentic-checkout-sdk](https://github.com/liutingqiu/paypal-agentic-checkout-sdk)
- **Lead Developer Contact:** Tingqiu Liu (`tianqi689@gmail.com`) / GitHub: `liutingqiu`

---
*Built with ❤️ for PayPal, Devpost, and the Global AI Builder Community.*
