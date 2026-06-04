import { generateId } from "../lib/id-utils";

export interface OtpEntry {
  id: string;
  email: string;
  code: string;
  expires_at: string;
  used: number;
  attempt_count: number;
  created_at: string;
}

export interface OtpService {
  generateOtp(email: string): Promise<string>;
  validateOtp(email: string, code: string): Promise<boolean>;
  markUsed(id: string): Promise<void>;
  getRecentCount(email: string, windowMinutes: number): Promise<number>;
  incrementAttempts(id: string): Promise<void>;
}

const OTP_CODE_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 5;
const RATE_LIMIT_WINDOW = 10;
const RATE_LIMIT_MAX = 3;
const MAX_ATTEMPTS = 5;

function generateCode(): string {
  const digits = Array.from({ length: OTP_CODE_LENGTH }, () =>
    Math.floor(Math.random() * 10).toString()
  );
  return digits.join("");
}

function now(): string {
  return new Date().toISOString();
}

function futureMinutes(minutes: number): string {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

export function createOtpService(db: D1Database): OtpService {
  const generateOtp = async (email: string): Promise<string> => {
    const recent = await getRecentCount(email, RATE_LIMIT_WINDOW);
    if (recent >= RATE_LIMIT_MAX) {
      throw new Error("RATE_LIMIT_EXCEEDED");
    }

    const code = generateCode();
    const id = generateId();
    const expiresAt = futureMinutes(OTP_EXPIRY_MINUTES);

    await db
      .prepare(
        "INSERT INTO otp_codes (id, email, code, expires_at) VALUES (?, ?, ?, ?)"
      )
      .bind(id, email, code, expiresAt)
      .run();

    return code;
  };

  const validateOtp = async (email: string, code: string): Promise<boolean> => {
    const row = await db
      .prepare(
        "SELECT * FROM otp_codes WHERE email = ? AND code = ? AND used = 0 AND expires_at > ? ORDER BY created_at DESC LIMIT 1"
      )
      .bind(email, code, now())
      .first<OtpEntry>();

    if (!row) return false;

    // Check if max attempts reached
    if (row.attempt_count >= MAX_ATTEMPTS) return false;

    // Increment attempt count for this code
    await incrementAttempts(row.id);

    // Success: first valid attempt
    if (row.attempt_count === 0) {
      await markUsed(row.id);
      return true;
    }

    // Already had prior failed attempt but within limit
    await markUsed(row.id);
    return true;
  };

  const markUsed = async (id: string): Promise<void> => {
    await db
      .prepare("UPDATE otp_codes SET used = 1 WHERE id = ?")
      .bind(id)
      .run();
  };

  const getRecentCount = async (
    email: string,
    windowMinutes: number
  ): Promise<number> => {
    const cutoff = new Date(
      Date.now() - windowMinutes * 60 * 1000
    ).toISOString();
    const result = await db
      .prepare(
        "SELECT COUNT(*) as count FROM otp_codes WHERE email = ? AND created_at > ?"
      )
      .bind(email, cutoff)
      .first<{ count: number }>();
    return result?.count ?? 0;
  };

  const incrementAttempts = async (id: string): Promise<void> => {
    await db
      .prepare("UPDATE otp_codes SET attempt_count = attempt_count + 1 WHERE id = ?")
      .bind(id)
      .run();
  };

  return {
    generateOtp,
    validateOtp,
    markUsed,
    getRecentCount,
    incrementAttempts,
  };
}
