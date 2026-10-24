/**
 * One agent purchase, end to end, with artifacts written for inspection.
 *
 *   node dist/cli.js --amount 12.50 --merchant "Corner Coffee" --purpose "team breakfast"
 *
 * Without PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET the run stops before creating
 * an order and says so. Point PAYPAL_BASE_URL at the contract server to test the
 * transport offline.
 */
export {};
