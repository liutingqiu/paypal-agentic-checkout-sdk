// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PayPalOrdersClient,
  AgentSpendingGuardrailEngine,
  X402PaymentAdapter
} from '../dist/index.js';

test('1. PayPalOrdersClient generates and caches OAuth2 token', async () => {
  const client = new PayPalOrdersClient();
  const token1 = await client.getAccessToken();
  const token2 = await client.getAccessToken();

  assert.ok(token1.startsWith('A21AA'), 'Token must follow PayPal OAuth format');
  assert.equal(token1, token2, 'Token must be cached within expiration window');
});

test('2. PayPalOrdersClient creates PayPal v2 order with approval URL', async () => {
  const client = new PayPalOrdersClient();
  const order = await client.createOrder({
    intentId: 'int_01',
    agentId: 'agent_shopping_01',
    itemId: 'item_cloud_server',
    itemName: 'Monthly Compute Instance',
    amountUSD: 45.0,
    merchantId: 'merchant_cloud_provider',
    reasoning: 'AI agent needs compute resource'
  });

  assert.ok(order.orderId.startsWith('PAYPAL_ORDER_'));
  assert.equal(order.status, 'CREATED');
  assert.equal(order.amountUSD, 45.0);
  assert.ok(order.approveUrl.includes('sandbox.paypal.com'));
});

test('3. PayPalOrdersClient captures authorized order', async () => {
  const client = new PayPalOrdersClient();
  const capture = await client.captureOrder('PAYPAL_ORDER_12345', 45.0);

  assert.equal(capture.status, 'COMPLETED');
  assert.ok(capture.captureId?.startsWith('CAPTURE_'));
  assert.equal(capture.amountUSD, 45.0);
});

test('4. SpendingGuardrails permits autonomous purchase below auto-approve threshold ($30)', () => {
  const engine = new AgentSpendingGuardrailEngine({ autoApproveThresholdUSD: 30.0 });
  const intent = {
    intentId: 'int_02',
    agentId: 'agent_01',
    itemId: 'api_tokens',
    itemName: 'API Credits',
    amountUSD: 15.0,
    merchantId: 'merchant_api',
    reasoning: 'Recharging query quota'
  };

  const result = engine.evaluateIntent(intent);
  assert.equal(result.passed, true);
  assert.equal(result.requiresHumanConfirmation, false, 'Should auto-approve small purchase');
  assert.equal(result.remainingDailyBudgetUSD, 500.0);
});

test('5. SpendingGuardrails flags purchases above threshold for human confirmation', () => {
  const engine = new AgentSpendingGuardrailEngine({ autoApproveThresholdUSD: 30.0, maxSingleTxUSD: 150.0 });
  const intent = {
    intentId: 'int_03',
    agentId: 'agent_01',
    itemId: 'gpu_rental',
    itemName: 'GPU Compute Rental',
    amountUSD: 85.0,
    merchantId: 'merchant_gpu',
    reasoning: 'Batch training run'
  };

  const result = engine.evaluateIntent(intent);
  assert.equal(result.passed, true);
  assert.equal(result.requiresHumanConfirmation, true, 'Purchases >$30 require human confirmation');
});

test('6. SpendingGuardrails strictly rejects purchases exceeding single tx or daily cap', () => {
  const engine = new AgentSpendingGuardrailEngine({ maxSingleTxUSD: 150.0, dailyBudgetUSD: 500.0 });

  // Exceeds single tx cap ($200 > $150)
  const singleExcess = engine.evaluateIntent({
    intentId: 'int_04',
    agentId: 'agent_01',
    itemId: 'item_expensive',
    itemName: 'Enterprise License',
    amountUSD: 200.0,
    merchantId: 'm1',
    reasoning: 'Too big'
  });
  assert.equal(singleExcess.passed, false);
  assert.ok(singleExcess.rejectionReason?.includes('max single transaction'));

  // Simulate spending $450
  engine.recordSettlement(450.0);
  assert.equal(engine.getRemainingBudget(), 50.0);

  // Attempt to spend $75 (450 + 75 = 525 > 500)
  const dailyExcess = engine.evaluateIntent({
    intentId: 'int_05',
    agentId: 'agent_01',
    itemId: 'item_small',
    itemName: 'Addon',
    amountUSD: 75.0,
    merchantId: 'm1',
    reasoning: 'Exceeds budget'
  });
  assert.equal(dailyExcess.passed, false);
  assert.ok(dailyExcess.rejectionReason?.includes('daily budget limit'));
});

test('7. X402PaymentAdapter creates valid HTTP 402 challenge and verifies settlement', () => {
  const challenge = X402PaymentAdapter.createChallenge('/api/v1/pro-analysis', 10.0, 'tianqi689@gmail.com');

  assert.equal(challenge.status, 402);
  assert.ok(challenge.headers['WWW-Authenticate'].includes('x402 protocol=paypal'));
  assert.equal(challenge.payload.amountUSD, 10.0);
  assert.equal(challenge.payload.payeeAccount, 'tianqi689@gmail.com');

  const validOrder = {
    orderId: challenge.payload.orderId,
    status: 'COMPLETED',
    amountUSD: 10.0,
    currency: 'USD',
    approveUrl: '',
    createdAt: Date.now()
  };

  assert.equal(X402PaymentAdapter.verifySettlement(validOrder, challenge.payload), true);
});
