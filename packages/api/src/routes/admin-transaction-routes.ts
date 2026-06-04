import { Hono } from "hono";
import { createAuthMiddleware } from "../middleware/auth-middleware";
import { createAdminMiddleware } from "../middleware/admin-middleware";
import { createBillingService } from "../services/billing-service";

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
};

export function createAdminTransactionRoutes() {
  const router = new Hono<{ Bindings: Bindings }>();
  const auth = createAuthMiddleware();
  const admin = createAdminMiddleware();

  // GET /api/admin/transactions — list all topup records with user email
  router.get("/", auth, admin, async (c) => {
    const result = await c.env.DB
      .prepare(
        `SELECT t.id, t.user_id, u.email AS user_email, t.amount_cents, t.status,
                t.proof_url, t.sepay_transaction_id, t.created_at, t.confirmed_at
         FROM topup_records t
         JOIN users u ON u.id = t.user_id
         ORDER BY t.created_at DESC`
      )
      .all();
    return c.json(result.results ?? []);
  });

  // POST /api/admin/transactions/:id/confirm — manually confirm a pending topup
  router.post("/:id/confirm", auth, admin, async (c) => {
    const topupId = c.req.param("id");

    const topup = await c.env.DB
      .prepare("SELECT user_id, amount_cents, status FROM topup_records WHERE id = ?")
      .bind(topupId)
      .first<{ user_id: string; amount_cents: number; status: string }>();

    if (!topup) {
      return c.json({ error: "Transaction not found" }, 404);
    }

    if (topup.status !== "pending") {
      return c.json({ error: `Cannot confirm: status is already '${topup.status}'` }, 400);
    }

    const billing = createBillingService();
    await billing.addCredit(c.env.DB, topup.user_id, topup.amount_cents, topupId as string);

    await c.env.DB
      .prepare("UPDATE topup_records SET status = 'confirmed', confirmed_at = ? WHERE id = ?")
      .bind(new Date().toISOString(), topupId)
      .run();

    return c.json({ message: "Transaction confirmed", topupId });
  });

  // POST /api/admin/transactions/:id/reject — reject a pending topup
  router.post("/:id/reject", auth, admin, async (c) => {
    const topupId = c.req.param("id");

    const topup = await c.env.DB
      .prepare("SELECT status FROM topup_records WHERE id = ?")
      .bind(topupId)
      .first<{ status: string }>();

    if (!topup) {
      return c.json({ error: "Transaction not found" }, 404);
    }

    if (topup.status !== "pending") {
      return c.json({ error: `Cannot reject: status is already '${topup.status}'` }, 400);
    }

    await c.env.DB
      .prepare("UPDATE topup_records SET status = 'rejected' WHERE id = ?")
      .bind(topupId)
      .run();

    return c.json({ message: "Transaction rejected", topupId });
  });

  return router;
}
