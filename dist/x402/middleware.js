export class X402PaymentAdapter {
    /**
     * Generates HTTP 402 Payment Required challenge payload for an agent.
     */
    static createChallenge(resource, amountUSD, payeeAccount = 'tianqi689@gmail.com') {
        const orderId = `x402_order_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const payload = {
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
    static verifySettlement(order, challenge) {
        return order.status === 'COMPLETED' && order.amountUSD >= challenge.amountUSD;
    }
}
