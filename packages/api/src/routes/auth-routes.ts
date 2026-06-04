import { Hono } from "hono";
import { createOtpService } from "../services/otp-service";
import { createJwtService } from "../services/jwt-service";
import { createEmailService } from "../services/email-service";
import { generateId } from "../lib/id-utils";

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
  OTP_EMAIL_FROM: string;
};

export function createAuthRoutes() {
  const router = new Hono<{ Bindings: Bindings }>();

  // POST /api/auth/otp/send
  router.post("/otp/send", async (c) => {
    const { email } = await c.req.json<{ email: string }>();

    if (!email || !email.includes("@")) {
      return c.json({ error: "Valid email is required" }, 400);
    }

    try {
      const otpService = createOtpService(c.env.DB);
      const emailService = createEmailService(c.env.OTP_EMAIL_FROM);

      const code = await otpService.generateOtp(email);
      await emailService.sendOtp(email, code);

      return c.json({ message: "OTP sent to email", email }, 200);
    } catch (err) {
      if (err instanceof Error && err.message === "RATE_LIMIT_EXCEEDED") {
        return c.json({ error: "Too many OTP requests. Try again later." }, 429);
      }
      console.error("OTP send error:", err);
      return c.json({ error: "Failed to send OTP" }, 500);
    }
  });

  // POST /api/auth/otp/verify
  router.post("/otp/verify", async (c) => {
    const { email, code } = await c.req.json<{
      email: string;
      code: string;
    }>();

    if (!email || !code) {
      return c.json({ error: "Email and code are required" }, 400);
    }

    try {
      const otpService = createOtpService(c.env.DB);
      const jwtService = createJwtService(c.env.JWT_SECRET);

      const valid = await otpService.validateOtp(email, code);

      if (!valid) {
        return c.json({ error: "Invalid or expired OTP code" }, 401);
      }

      // Find or create user
      const db = c.env.DB;
      let user = await db
        .prepare("SELECT * FROM users WHERE email = ?")
        .bind(email)
        .first<{ id: string; email: string }>();

      if (!user) {
        const id = generateId();
        await db
          .prepare("INSERT INTO users (id, email) VALUES (?, ?)")
          .bind(id, email)
          .run();
        user = { id, email };
      }

      const token = await jwtService.sign({
        userId: user.id,
        email: user.email,
      });

      return c.json({ token, user: { id: user.id, email: user.email } }, 200);
    } catch (err) {
      console.error("OTP verify error:", err);
      return c.json({ error: "Verification failed" }, 500);
    }
  });

  return router;
}
