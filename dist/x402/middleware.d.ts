import { X402HeaderPayload, PayPalOrderResponse } from '../types.js';
export declare class X402PaymentAdapter {
    /**
     * Generates HTTP 402 Payment Required challenge payload for an agent.
     */
    static createChallenge(resource: string, amountUSD: number, payeeAccount?: string): {
        status: 402;
        headers: Record<string, string>;
        payload: X402HeaderPayload;
    };
    /**
     * Validates an order capture proof and grants agent resource access.
     */
    static verifySettlement(order: PayPalOrderResponse, challenge: X402HeaderPayload): boolean;
}
