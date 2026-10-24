/**
 * x402 payment challenge, following the HTTP 402 flow: a resource answers 402
 * with a machine-readable payment requirement, the client retries with an
 * X-PAYMENT header carrying a base64 JSON payload, and the server verifies it.
 *
 * This module builds and verifies the payloads. It does not settle funds and it
 * does not pretend to: settlement is the PayPal capture call.
 */
export function buildChallenge(input) {
    const requirement = {
        scheme: "exact",
        network: input.network,
        amount: input.amount,
        currency: input.currency,
        payTo: input.payTo,
        resource: input.resource,
        expiresAt: Date.now() + (input.ttlSeconds ?? 120) * 1000,
        nonce: Math.random().toString(36).slice(2, 12),
    };
    return {
        status: 402,
        headers: { "x-payment-required": Buffer.from(JSON.stringify(requirement)).toString("base64") },
        body: { error: "payment_required", accepts: [requirement] },
    };
}
export function encodePayment(payload) {
    return Buffer.from(JSON.stringify(payload)).toString("base64");
}
export function decodePayment(header) {
    if (!header)
        return null;
    try {
        const parsed = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
        if (!parsed.amount || !parsed.payTo)
            return null;
        return parsed;
    }
    catch {
        return null;
    }
}
export function verifyPayment(requirement, payload) {
    if (!payload)
        return { ok: false, reason: "missing or undecodable X-PAYMENT header" };
    if (Date.now() > requirement.expiresAt)
        return { ok: false, reason: "payment requirement expired" };
    if (payload.nonce !== requirement.nonce)
        return { ok: false, reason: "nonce mismatch" };
    if (payload.payTo !== requirement.payTo)
        return { ok: false, reason: "payee mismatch" };
    if (payload.currency !== requirement.currency)
        return { ok: false, reason: "currency mismatch" };
    if (Number(payload.amount) < Number(requirement.amount))
        return { ok: false, reason: "amount below requirement" };
    return { ok: true, reason: "accepted" };
}
