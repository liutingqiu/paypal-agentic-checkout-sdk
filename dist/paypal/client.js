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
export class PayPalAuthError extends Error {
    constructor(message) {
        super(message);
        this.name = "PayPalAuthError";
    }
}
export class PayPalHttpError extends Error {
    status;
    body;
    path;
    constructor(status, body, path) {
        super("PayPal " + path + " failed: HTTP " + status + " :: " + body.slice(0, 200));
        this.status = status;
        this.body = body;
        this.path = path;
        this.name = "PayPalHttpError";
    }
}
const SANDBOX = "https://api-m.sandbox.paypal.com";
const LIVE = "https://api-m.paypal.com";
export function resolveBaseUrl() {
    if (process.env.PAYPAL_BASE_URL)
        return process.env.PAYPAL_BASE_URL.replace(/\/+$/, "");
    return process.env.PAYPAL_ENVIRONMENT === "live" ? LIVE : SANDBOX;
}
export class PayPalClient {
    config;
    token;
    timeoutMs;
    maxRetries;
    constructor(config) {
        this.config = config;
        this.timeoutMs = config.timeoutMs ?? 12_000;
        this.maxRetries = config.maxRetries ?? 2;
    }
    get configured() {
        return Boolean(this.config.clientId && this.config.clientSecret);
    }
    get baseUrl() {
        return this.config.baseUrl;
    }
    get isLocalEndpoint() {
        return !/paypal\.com$/i.test(new URL(this.config.baseUrl).hostname);
    }
    async send(method, path, options = {}) {
        let attempt = 0;
        let lastError;
        while (attempt <= this.maxRetries) {
            const started = Date.now();
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), this.timeoutMs);
            try {
                const headers = { accept: "application/json", ...(options.headers ?? {}) };
                if (options.body !== undefined && !options.bodyText)
                    headers["content-type"] = "application/json";
                if (options.auth === "basic") {
                    headers.authorization =
                        "Basic " + Buffer.from(this.config.clientId + ":" + this.config.clientSecret).toString("base64");
                }
                else if (options.auth === "bearer") {
                    headers.authorization = "Bearer " + (await this.accessToken());
                }
                const response = await fetch(this.config.baseUrl + path, {
                    method,
                    headers,
                    body: options.bodyText ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
                    signal: controller.signal,
                });
                const text = await response.text();
                this.config.onRequest?.({ method, path, status: response.status, durationMs: Date.now() - started, attempt });
                if (response.status === 401 || response.status === 403) {
                    throw new PayPalAuthError("PayPal rejected the credentials (HTTP " + response.status + "): " + text.slice(0, 160));
                }
                if (response.status === 429 || response.status >= 500) {
                    lastError = new PayPalHttpError(response.status, text, path);
                    attempt += 1;
                    if (attempt > this.maxRetries)
                        break;
                    await new Promise((resolve) => setTimeout(resolve, 200 * 2 ** (attempt - 1) + Math.random() * 100));
                    continue;
                }
                const json = text ? JSON.parse(text) : {};
                if (!response.ok)
                    throw new PayPalHttpError(response.status, text, path);
                return { status: response.status, json, text };
            }
            catch (error) {
                if (error instanceof PayPalAuthError)
                    throw error;
                if (error instanceof PayPalHttpError && error.status < 500 && error.status !== 429)
                    throw error;
                lastError = error;
                attempt += 1;
                if (attempt > this.maxRetries)
                    break;
            }
            finally {
                clearTimeout(timer);
            }
        }
        throw lastError instanceof Error ? lastError : new Error(String(lastError));
    }
    /** Client-credentials token, cached until 60 s before expiry. */
    async accessToken() {
        if (this.token && Date.now() < this.token.expiresAt)
            return this.token.value;
        if (!this.configured) {
            throw new PayPalAuthError("PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET are not set");
        }
        const bodyText = new URLSearchParams({ grant_type: "client_credentials" }).toString();
        const response = await this.send("POST", "/v1/oauth2/token", {
            bodyText,
            auth: "basic",
            headers: { "content-type": "application/x-www-form-urlencoded" },
        });
        const token = String(response.json.access_token ?? "");
        const expiresIn = Number(response.json.expires_in ?? 0);
        if (!token)
            throw new PayPalAuthError("no access_token in PayPal response");
        this.token = { value: token, expiresAt: Date.now() + Math.max(0, expiresIn - 60) * 1000 };
        return token;
    }
    async createOrder(input) {
        const payload = {
            intent: "CAPTURE",
            purchase_units: [
                {
                    reference_id: input.referenceId ?? "default",
                    custom_id: input.customId,
                    description: input.description,
                    amount: input.amount,
                },
            ],
        };
        const response = await this.send("POST", "/v2/checkout/orders", { body: payload, auth: "bearer" });
        return response.json;
    }
    async getOrder(orderId) {
        const response = await this.send("GET", "/v2/checkout/orders/" + encodeURIComponent(orderId), { auth: "bearer" });
        return response.json;
    }
    async captureOrder(orderId) {
        const response = await this.send("POST", "/v2/checkout/orders/" + encodeURIComponent(orderId) + "/capture", {
            body: {},
            auth: "bearer",
        });
        return response.json;
    }
}
