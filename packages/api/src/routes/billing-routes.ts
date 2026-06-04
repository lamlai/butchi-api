import { Hono } from "hono";
import { createAuthMiddleware } from "../middleware/auth-middleware";
import { createBillingService, vndToUsdCents } from "../services/billing-service";
import { createDefaultSepayService } from "../services/sepay-service";
import type { EnvSePayConfig } from "../services/sepay-service";
import { createBillingProofRoutes } from "./billing-proof-routes";

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
  R2: R2Bucket;
  SEPAY_BANK_CODE?: string;
  SEPAY_ACCOUNT_NUMBER?: string;
  SEPAY_ACCOUNT_NAME?: string;
  SEPAY_WEBHOOK_SECRET?: string;
};

export function createBillingRoutes() {
  const router = new Hono<{ Bindings: Bindings }>();
  const auth = createAuthMiddleware();
  const billing = createBillingService();

  // Mount proof upload sub-router
  router.route("/topup", createBillingProofRoutes());

  // GET /api/billing — current balance
  router.get("/", auth, async (c) => {
    const user = c.get("user");
    const balanceCents = await billing.getBalance(c.env.DB, user.userId);
    return c.json({ balance_cents: balanceCents });
  });

  // GET /api/billing/history — topup history
  router.get("/history", auth, async (c) => {
    const user = c.get("user");
    const history = await c.env.DB
      .prepare(
        "SELECT amount_cents, status, created_at FROM topup_records WHERE user_id = ? ORDER BY created_at DESC LIMIT 50"
      )
      .bind(user.userId)
      .all();
    return c.json(history.results ?? []);
  });

  // POST /api/billing/topup — create SePay QR payment
  router.post("/topup", auth, async (c) => {
    const user = c.get("user");
    const { amount_vnd } = await c.req.json<{ amount_vnd: number }>();

    if (!amount_vnd || amount_vnd < 10000) {
      return c.json({ error: "Minimum topup is 10,000 VND" }, 400);
    }

    const sepay = createDefaultSepayService(c.env as EnvSePayConfig);
    const payment = await sepay.createQRPayment(amount_vnd);

    // Convert VND to USD cents for balance credit
    const usdCents = vndToUsdCents(amount_vnd);

    // Record pending topup with the QR transactionId for webhook matching
    const pendingId = crypto.randomUUID();
    await c.env.DB
      .prepare(
        "INSERT INTO topup_records (id, user_id, amount_cents, sepay_transaction_id, status) VALUES (?, ?, ?, ?, 'pending')"
      )
      .bind(pendingId, user.userId, usdCents, payment.transactionId)
      .run();

    return c.json({
      qrUrl: payment.qrUrl,
      transactionId: payment.transactionId,
    });
  });

  return router;
}
