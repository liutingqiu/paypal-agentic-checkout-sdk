/**
 * PayPal contract server: the public Orders v2 shapes over real sockets.
 *
 * Endpoints: POST /v1/oauth2/token, POST /v2/checkout/orders,
 *            GET /v2/checkout/orders/:id, POST /v2/checkout/orders/:id/capture
 *
 * It enforces Basic auth on the token endpoint and Bearer auth everywhere else,
 * tracks order state (CREATED -> COMPLETED), and can inject 429s or latency so
 * the client retry path is exercised. It settles nothing.
 *
 * Usage: node scripts/contract-server.mjs --port 8899 [--latency 30] [--fail-first 1]
 */

import { createServer } from "node:http";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = args.indexOf("--" + name);
  return index >= 0 ? Number(args[index + 1]) : fallback;
};
const PORT = flag("port", 8899);
const LATENCY = flag("latency", 0);
let FAIL_FIRST = flag("fail-first", 0);

const CLIENT_ID = process.env.PAYPAL_CONTRACT_CLIENT_ID ?? "contract-client";
const CLIENT_SECRET = process.env.PAYPAL_CONTRACT_CLIENT_SECRET ?? "contract-secret";
const TOKEN = "A21AA-contract-" + Math.random().toString(36).slice(2, 10);

const orders = new Map();

function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json", "content-length": Buffer.byteLength(payload) });
  res.end(payload);
}

function basicOk(req) {
  const header = req.headers.authorization ?? "";
  if (!header.startsWith("Basic ")) return false;
  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const [id, secret] = decoded.split(":");
  return id === CLIENT_ID && secret === CLIENT_SECRET;
}

function bearerOk(req) {
  return (req.headers.authorization ?? "") === "Bearer " + TOKEN;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (LATENCY) await new Promise((resolve) => setTimeout(resolve, LATENCY));
  if (url.pathname === "/health") return send(res, 200, { ok: true });

  if (FAIL_FIRST > 0) {
    FAIL_FIRST -= 1;
    return send(res, 429, { name: "RATE_LIMIT_REACHED", message: "try again" });
  }

  if (url.pathname === "/v1/oauth2/token" && req.method === "POST") {
    if (!basicOk(req)) return send(res, 401, { error: "invalid_client" });
    return send(res, 200, { scope: "https://uri.paypal.com/services/payments/orders", access_token: TOKEN, token_type: "Bearer", expires_in: 32400 });
  }

  if (!bearerOk(req)) return send(res, 401, { name: "AUTHENTICATION_FAILURE", message: "invalid token" });

  if (url.pathname === "/v2/checkout/orders" && req.method === "POST") {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    const id = "ORD-" + Math.random().toString(36).slice(2, 10).toUpperCase();
    const order = { id, status: "CREATED", intent: body.intent ?? "CAPTURE", purchase_units: body.purchase_units ?? [] };
    orders.set(id, order);
    return send(res, 201, order);
  }

  const match = url.pathname.match(/^\/v2\/checkout\/orders\/([^/]+)(\/capture)?$/);
  if (match) {
    const id = decodeURIComponent(match[1]);
    const order = orders.get(id);
    if (!order) return send(res, 404, { name: "RESOURCE_NOT_FOUND", message: "order " + id + " not found" });
    if (match[2] && req.method === "POST") {
      if (order.status !== "CREATED") return send(res, 422, { name: "ORDER_ALREADY_CAPTURED", message: order.status });
      order.status = "COMPLETED";
      return send(res, 201, order);
    }
    if (!match[2] && req.method === "GET") return send(res, 200, order);
  }

  return send(res, 404, { error: "no_route", path: url.pathname });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("paypal contract server on http://127.0.0.1:" + PORT + " client_id=" + CLIENT_ID);
});
