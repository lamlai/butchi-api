import { Hono } from "hono";
import { createBillingService } from "../services/billing-service";
import { createSepayService } from "../services/sepay-service";

type Bindings = {
  DB: D1Database;
  SEPAY_BANK_CODE?: string;
  SEPAY_ACCOUNT_NUMBER?: string;
  SEPAY_ACCOUNT_NAME?: string;
  SEPAY_WEBHOOK_SECRET?: string;
};

export function createWebhookRoutes() {
  const router = new Hono<{ Bindings: Bindings }>();

  // POST /api/webhooks/sepay — SePay payment confirmation
  router.post("/sepay", async (c) => {
    try {
      const rawBody = await c.req.text();
      const signature = c.req.header("X-SePay-Signature") ?? "";

      const sepay = createSepayService({
        bankCode: c.env.SEPAY_BANK_CODE ?? "970436",
        accountNumber: c.env.SEPAY_ACCOUNT_NUMBER ?? "",
        accountName: c.env.SEPAY_ACCOUNT_NAME ?? "BUTCHI",
        webhookSecret: c.env.SEPAY_WEBHOOK_SECRET ?? "",
      });

      if (!sepay.verifyWebhookSignature(rawBody, signature)) {
        return c.json({ error: "Invalid signature" }, 401);
      }

      const payload = JSON.parse(rawBody) as {
        transactionId?: string;
        amount?: number;
        reference?: string;
        status?: string;
      };

      const transactionId = payload.transactionId ?? payload.reference;
      const amountCents = payload.amount ?? 0;

      if (!transactionId || amountCents <= 0) {
        return c.json({ error: "Invalid payload" }, 400);
      }

      // Check if already processed (idempotency) — exact match on sepay_transaction_id
      const existing = await c.env.DB
        .prepare(
          "SELECT id FROM topup_records WHERE sepay_transaction_id = ? AND status = 'confirmed'"
        )
        .bind(transactionId)
        .first();

      if (existing) {
        return c.json({ message: "Already processed" }, 200);
      }

      // Find pending topup record by exact sepay_transaction_id match
      const pending = await c.env.DB
        .prepare(
          "SELECT user_id FROM topup_records WHERE sepay_transaction_id = ? AND status = 'pending' LIMIT 1"
        )
        .bind(transactionId)
        .first<{ user_id: string }>();

      if (!pending) {
        return c.json({ error: "No matching pending topup" }, 404);
      }

      const billing = createBillingService();
      await billing.addCredit(
        c.env.DB,
        pending.user_id,
        amountCents,
        transactionId
      );

      return c.json({ message: "Payment confirmed", amount: amountCents }, 200);
    } catch (err) {
      console.error("SePay webhook error:", err);
      return c.json({ error: "Webhook processing failed" }, 500);
    }
  });

  return router;
}
