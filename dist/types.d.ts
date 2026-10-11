export type PayPalEnvironment = 'SANDBOX' | 'PRODUCTION';
export type OrderStatus = 'CREATED' | 'SAVED' | 'APPROVED' | 'VOIDED' | 'COMPLETED';
export interface PayPalCredentials {
    clientId: string;
    clientSecret: string;
    environment: PayPalEnvironment;
}
export interface PurchaseIntent {
    intentId: string;
    agentId: string;
    itemId: string;
    itemName: string;
    amountUSD: number;
    merchantId: string;
    reasoning: string;
}
export interface SpendingGuardrails {
    maxSingleTxUSD: number;
    dailyBudgetUSD: number;
    allowedMerchants: string[];
    autoApproveThresholdUSD: number;
}
export interface GuardrailCheckResult {
    passed: boolean;
    requiresHumanConfirmation: boolean;
    rejectionReason?: string;
    currentDailySpendUSD: number;
    remainingDailyBudgetUSD: number;
}
export interface PayPalOrderResponse {
    orderId: string;
    status: OrderStatus;
    amountUSD: number;
    currency: 'USD';
    approveUrl: string;
    captureId?: string;
    createdAt: number;
}
export interface X402HeaderPayload {
    resource: string;
    amountUSD: number;
    payeeAccount: string;
    orderId: string;
    settlementProof?: string;
}
