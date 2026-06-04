import { Hono } from "hono";
import { createBillingService, vndToUsdCents } from "../services/billing-service";

type Bindings = {
  DB: D1Database;
  SEPAY_WEBHOOK_SECRET?: string;
};

interface SepayWebhookPayload {
  id: number;
  gateway: string;
  transactionDate: string;
  accountNumber: string;
  subAccount: string;
  code: string | null;
  content: string;
  transferType: "in" | "out";
  description: string;
  transferAmount: number;
  accumulated: number;
  referenceCode: string;
}

export function createWebhookRoutes() {
  const router = new Hono<{ Bindings: Bindings }>();

  router.post("/sepay", async (c) => {
    try {
      const apiKey = c.req.header("Authorization");
      const expectedKey = c.env.SEPAY_WEBHOOK_SECRET;

      if (expectedKey && apiKey !== `Apikey ${expectedKey}`) {
        return c.json({ success: false }, 401);
      }

      const payload = await c.req.json<SepayWebhookPayload>();

      if (!payload.id || !payload.transferAmount || payload.transferType !== "in") {
        return c.json({ success: true }, 200);
      }

      const sepayId = String(payload.id);

      const existing = await c.env.DB
        .prepare(
          "SELECT id FROM topup_records WHERE sepay_transaction_id = ? AND status = 'confirmed'"
        )
        .bind(sepayId)
        .first();

      if (existing) {
        return c.json({ success: true }, 200);
      }

      const matchCode = payload.code ?? extractTransactionCode(payload.content);

      if (!matchCode) {
        console.error("SePay webhook: no matching code in payload", payload);
        return c.json({ success: true }, 200);
      }

      const pending = await c.env.DB
        .prepare(
          "SELECT user_id, amount_cents FROM topup_records WHERE sepay_transaction_id = ? AND status = 'pending' LIMIT 1"
        )
        .bind(matchCode)
        .first<{ user_id: string; amount_cents: number }>();

      if (!pending) {
        console.error("SePay webhook: no pending topup for code:", matchCode);
        return c.json({ success: true }, 200);
      }

      const usdCents = vndToUsdCents(payload.transferAmount);

      const billing = createBillingService();
      await billing.addCredit(c.env.DB, pending.user_id, usdCents, sepayId);

      await c.env.DB
        .prepare(
          "UPDATE topup_records SET status = 'confirmed', confirmed_at = ? WHERE sepay_transaction_id = ? AND status = 'pending'"
        )
        .bind(new Date().toISOString(), matchCode)
        .run();

      return c.json({ success: true }, 200);
    } catch (err) {
      console.error("SePay webhook error:", err);
      return c.json({ success: true }, 200);
    }
  });

  return router;
}

function extractTransactionCode(content: string): string | null {
  const match = content.match(/topup_[a-z0-9]{16}/i);
  return match ? match[0] : null;
}
