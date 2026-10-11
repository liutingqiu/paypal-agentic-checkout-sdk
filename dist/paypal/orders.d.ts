import { PayPalCredentials, PurchaseIntent, PayPalOrderResponse } from '../types.js';
export declare class PayPalOrdersClient {
    private credentials;
    private tokenCache?;
    constructor(credentials?: Partial<PayPalCredentials>);
    getBaseUrl(): string;
    /**
     * Generates or returns cached OAuth2 Bearer token from PayPal.
     */
    getAccessToken(): Promise<string>;
    /**
     * Creates a PayPal v2 checkout order for an AI Agent purchase intent.
     */
    createOrder(intent: PurchaseIntent): Promise<PayPalOrderResponse>;
    /**
     * Captures an authorized PayPal order.
     */
    captureOrder(orderId: string, amountUSD: number): Promise<PayPalOrderResponse>;
}
