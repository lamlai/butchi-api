import { Hono } from "hono";
import { createAuthMiddleware } from "../middleware/auth-middleware";
import { validateProofFile, getProofR2Key } from "../services/proof-upload-service";
import { createEmailService } from "../services/email-service";
import { ADMIN_EMAIL } from "../config/admin-config";

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
  R2: R2Bucket;
  EMAIL_FROM?: string;
  EMAILIT_API_KEY?: string;
};

export function createBillingProofRoutes() {
  const router = new Hono<{ Bindings: Bindings }>();
  const auth = createAuthMiddleware();

  // POST /api/billing/topup/:id/proof — upload payment proof
  router.post("/:id/proof", auth, async (c) => {
    const user = c.get("user");
    const topupId = c.req.param("id");

    const topup = await c.env.DB
      .prepare("SELECT user_id, status, amount_cents FROM topup_records WHERE id = ?")
      .bind(topupId)
      .first<{ user_id: string; status: string; amount_cents: number }>();

    if (!topup) {
      return c.json({ error: "Topup not found" }, 404);
    }

    if (topup.user_id !== user.userId) {
      return c.json({ error: "Forbidden" }, 403);
    }

    if (topup.status !== "pending") {
      return c.json({ error: "Can only upload proof for pending transactions" }, 400);
    }

    const body = await c.req.parseBody();
    const file = body["file"];

    if (!file || !(file instanceof File)) {
      return c.json({ error: "No file provided" }, 400);
    }

    const validation = validateProofFile(file);
    if (!validation.valid) {
      return c.json({ error: validation.error }, 400);
    }

    const r2Key = getProofR2Key(topupId as string, file.name);
    const arrayBuffer = await file.arrayBuffer();

    await c.env.R2.put(r2Key, arrayBuffer, {
      httpMetadata: { contentType: file.type },
    });

    await c.env.DB
      .prepare("UPDATE topup_records SET proof_url = ? WHERE id = ?")
      .bind(r2Key, topupId)
      .run();

    // Send email notification to admin (non-blocking)
    const emailService = createEmailService(
      c.env.EMAIL_FROM ?? "noreply@butchi.ai",
      c.env.EMAILIT_API_KEY
    );
    c.executionCtx.waitUntil(
      emailService.sendProofNotification(ADMIN_EMAIL, {
        userEmail: user.email,
        topupId: topupId as string,
        amountCents: topup.amount_cents,
      }).catch((err) => console.error("Proof notification error:", err))
    );

    return c.json({ message: "Proof uploaded", proof_url: r2Key });
  });

  // GET /api/billing/topup/:id/proof — serve payment proof
  router.get("/:id/proof", auth, async (c) => {
    const user = c.get("user");
    const topupId = c.req.param("id");

    const topup = await c.env.DB
      .prepare("SELECT user_id, proof_url FROM topup_records WHERE id = ?")
      .bind(topupId)
      .first<{ user_id: string; proof_url: string | null }>();

    if (!topup || !topup.proof_url) {
      return c.json({ error: "Proof not found" }, 404);
    }

    const isAdmin = user.role === "admin";
    if (topup.user_id !== user.userId && !isAdmin) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const object = await c.env.R2.get(topup.proof_url);
    if (!object) {
      return c.json({ error: "File not found in storage" }, 404);
    }

    const headers = new Headers();
    headers.set("Content-Type", object.httpMetadata?.contentType ?? "application/octet-stream");
    headers.set("Cache-Control", "private, max-age=3600");

    return new Response(object.body, { headers });
  });

  return router;
}
