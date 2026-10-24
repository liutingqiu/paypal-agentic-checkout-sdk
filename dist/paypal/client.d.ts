/**
 * PayPal REST client: OAuth2 client-credentials token, Orders v2 create/capture.
 *
 * Endpoints and shapes follow the public Orders v2 API:
 *   POST /v1/oauth2/token              (Basic auth, grant_type=client_credentials)
 *   POST /v2/checkout/orders           (intent CAPTURE, purchase_units[].amount)
 *   GET  /v2/checkout/orders/:id
 *   POST /v2/checkout/orders/:id/capture
 *
 * The previous version of this file returned a token built from Math.random()
 * and never contacted PayPal. Nothing here is simulated: without credentials the
 * client refuses to run, and the contract server exists so the transport path can
 * be tested offline.
 */
export interface PayPalConfig {
    clientId: string;
    clientSecret: string;
    baseUrl: string;
    timeoutMs?: number;
    maxRetries?: number;
    onRequest?: (record: HttpRecord) => void;
}
export interface HttpRecord {
    method: string;
    path: string;
    status: number;
    durationMs: number;
    attempt: number;
}
export interface OrderAmount {
    currency_code: string;
    value: string;
}
export interface PayPalOrder {
    id: string;
    status: string;
    links?: Array<{
        href: string;
        rel: string;
        method?: string;
    }>;
    purchase_units?: Array<{
        amount?: OrderAmount;
        reference_id?: string;
        custom_id?: string;
    }>;
}
export declare class PayPalAuthError extends Error {
    constructor(message: string);
}
export declare class PayPalHttpError extends Error {
    readonly status: number;
    readonly body: string;
    readonly path: string;
    constructor(status: number, body: string, path: string);
}
export declare function resolveBaseUrl(): string;
export declare class PayPalClient {
    private readonly config;
    private token?;
    private readonly timeoutMs;
    private readonly maxRetries;
    constructor(config: PayPalConfig);
    get configured(): boolean;
    get baseUrl(): string;
    get isLocalEndpoint(): boolean;
    private send;
    /** Client-credentials token, cached until 60 s before expiry. */
    accessToken(): Promise<string>;
    createOrder(input: {
        amount: OrderAmount;
        referenceId?: string;
        customId?: string;
        description?: string;
        /** Optional card payment source: with a card the payer approves out of band, so
         *  capture does not need a browser session. Test cards only. */
        card?: {
            number: string;
            expiry: string;
            securityCode: string;
            brand?: string;
            billingName?: string;
        };
    }): Promise<PayPalOrder>;
    getOrder(orderId: string): Promise<PayPalOrder>;
    captureOrder(orderId: string): Promise<PayPalOrder>;
}
