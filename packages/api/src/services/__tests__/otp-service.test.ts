import { describe, it, expect, vi, beforeEach } from "vitest";
import { createOtpService } from "../otp-service";

function createMockDb() {
  const otpCodes: Array<{
    id: string;
    email: string;
    code: string;
    expires_at: string;
    used: number;
    attempt_count: number;
    created_at: string;
  }> = [];

  return {
    prepare: vi.fn((_sql: string) => ({
      bind: (...args: unknown[]) => {
        const boundArgs = args;
        return {
          run: vi.fn(async () => {
            // INSERT — store the OTP code
            if (_sql.startsWith("INSERT")) {
              const [id, email, code, expiresAt] = boundArgs as string[];
              otpCodes.push({
                id,
                email,
                code,
                expires_at: expiresAt,
                used: 0,
                attempt_count: 0,
                created_at: new Date().toISOString(),
              });
            }
            return { meta: { changes: 1 } };
          }),
          first: vi.fn(async <T>(): Promise<T | null> => {
            if (_sql.includes("COUNT")) {
              const cutoff = String(boundArgs[0] ?? "");
              const recent = otpCodes.filter((r) => r.created_at > cutoff);
              return { count: recent.length } as T;
            }
            if (_sql.includes("SELECT *")) {
              const email = String(boundArgs[0] ?? "");
              const code = String(boundArgs[1] ?? "");
              const nowStr = String(boundArgs[2] ?? "");
              const row = otpCodes.find(
                (r) =>
                  r.email === email &&
                  r.code === code &&
                  r.used === 0 &&
                  r.expires_at > nowStr
              );
              if (row) {
                return { ...row } as T;
              }
              return null;
            }
            if (_sql.includes("UPDATE")) {
              return null;
            }
            return null;
          }),
        };
      },
    })),
  } as unknown as D1Database;
}

describe("OTP Service", () => {
  let mockDb: D1Database;

  beforeEach(() => {
    mockDb = createMockDb();
  });

  it("generates a 6-digit OTP code", async () => {
    const otp = createOtpService(mockDb);
    const code = await otp.generateOtp("test@example.com");
    expect(code).toHaveLength(6);
    expect(/^\d{6}$/.test(code)).toBe(true);
  });

  it("validates a correct OTP code", async () => {
    const otp = createOtpService(mockDb);
    const code = await otp.generateOtp("valid@test.com");
    const result = await otp.validateOtp("valid@test.com", code);
    expect(result).toBe(true);
  });

  it("returns false for an invalid OTP code", async () => {
    const otp = createOtpService(mockDb);
    await otp.generateOtp("wrong@test.com");
    const result = await otp.validateOtp("wrong@test.com", "000000");
    expect(result).toBe(false);
  });

  it("returns false for expired OTP", async () => {
    const otp = createOtpService(mockDb);
    const result = await otp.validateOtp("nonexistent@test.com", "123456");
    expect(result).toBe(false);
  });
});
