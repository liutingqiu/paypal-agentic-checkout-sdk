// SPDX-License-Identifier: MIT
import { X402HeaderPayload, PayPalOrderResponse } from '../types.js';

export class X402PaymentAdapter {
  /**
   * Generates HTTP 402 Payment Required challenge payload for an agent.
   */
  public static createChallenge(
    resource: string,
    amountUSD: number,
    payeeAccount = 'tianqi689@gmail.com'
  ): { status: 402; headers: Record<string, string>; payload: X402HeaderPayload } {
    const orderId = `x402_order_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const payload: X402HeaderPayload = {
      resource,
      amountUSD,
      payeeAccount,
      orderId
    };

    return {
      status: 402,
      headers: {
        'WWW-Authenticate': `x402 protocol=paypal, amount=${amountUSD}, currency=USD, payee=${payeeAccount}`,
        'X-402-Order-Id': orderId,
        'Content-Type': 'application/json'
      },
      payload
    };
  }

  /**
   * Validates an order capture proof and grants agent resource access.
   */
  public static verifySettlement(order: PayPalOrderResponse, challenge: X402HeaderPayload): boolean {
    return order.status === 'COMPLETED' && order.amountUSD >= challenge.amountUSD;
  }
}
