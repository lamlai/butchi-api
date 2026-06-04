import { useState } from "react";
import { api } from "../lib/api-client";

export default function OtpForm() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSendOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.sendOtp(email);
      setStep("otp");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await api.verifyOtp(email, code);
      // Store JWT in cookie
      document.cookie = `token=${result.token}; path=/; max-age=3600; SameSite=Strict; Secure`;
      window.location.href = "/dashboard/usage";
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {step === "email" ? (
        <form onSubmit={handleSendOtp}>
          <div style={{ marginBottom: 16 }}>
            <label
              htmlFor="email"
              style={{
                display: "block",
                fontSize: 14,
                color: "var(--color-ink-muted)",
                marginBottom: 4,
              }}
            >
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                background: "var(--color-surface-1)",
                border: "none",
                borderBottom: "1px solid var(--color-hairline)",
                padding: "11px 16px",
                fontFamily: "var(--font-family)",
                fontSize: 16,
                width: "100%",
              }}
            />
          </div>
          {error && (
            <p style={{ color: "var(--color-error)", fontSize: 14, marginBottom: 12 }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{
              background: "var(--color-primary)",
              color: "var(--color-on-primary)",
              border: "none",
              padding: "12px 16px",
              fontFamily: "var(--font-family)",
              fontSize: 14,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              width: "100%",
            }}
          >
            {loading ? "Sending..." : "Send OTP"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp}>
          <p style={{ fontSize: 14, color: "var(--color-ink-muted)", marginBottom: 16 }}>
            Enter the 6-digit code sent to {email}
          </p>
          <div style={{ marginBottom: 16 }}>
            <label
              htmlFor="code"
              style={{
                display: "block",
                fontSize: 14,
                color: "var(--color-ink-muted)",
                marginBottom: 4,
              }}
            >
              Verification code
            </label>
            <input
              id="code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={6}
              required
              style={{
                background: "var(--color-surface-1)",
                border: "none",
                borderBottom: "1px solid var(--color-hairline)",
                padding: "11px 16px",
                fontFamily: "var(--font-family)",
                fontSize: 16,
                width: "100%",
                letterSpacing: 8,
                textAlign: "center",
              }}
            />
          </div>
          {error && (
            <p style={{ color: "var(--color-error)", fontSize: 14, marginBottom: 12 }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading || code.length !== 6}
            style={{
              background: "var(--color-primary)",
              color: "var(--color-on-primary)",
              border: "none",
              padding: "12px 16px",
              fontFamily: "var(--font-family)",
              fontSize: 14,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading || code.length !== 6 ? 0.7 : 1,
              width: "100%",
            }}
          >
            {loading ? "Verifying..." : "Verify"}
          </button>
          <button
            type="button"
            onClick={() => setStep("email")}
            style={{
              background: "none",
              border: "none",
              color: "var(--color-primary)",
              fontFamily: "var(--font-family)",
              fontSize: 14,
              cursor: "pointer",
              marginTop: 12,
              width: "100%",
              padding: "8px",
            }}
          >
            Change email
          </button>
        </form>
      )}
    </div>
  );
}
