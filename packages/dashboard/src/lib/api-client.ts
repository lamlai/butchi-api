const API_BASE = import.meta.env.PUBLIC_API_URL ?? "http://localhost:8787";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = typeof document !== "undefined" ? getCookie("token") : null;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    if (res.status === 401) {
      // Redirect to login
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, body.error ?? "Request failed");
  }

  return res.json();
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

export const api = {
  // Auth
  sendOtp: (email: string) =>
    request<{ message: string; email: string }>("/api/auth/otp/send", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  verifyOtp: (email: string, code: string) =>
    request<{ token: string; user: { id: string; email: string } }>(
      "/api/auth/otp/verify",
      {
        method: "POST",
        body: JSON.stringify({ email, code }),
      }
    ),

  // API Keys
  listKeys: () =>
    request<{ id: string; prefix: string; name: string; created_at: string; last_used_at: string | null }[]>(
      "/api/keys"
    ),

  createKey: (name: string) =>
    request<{ id: string; key: string; name: string }>("/api/keys", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),

  revokeKey: (id: string) =>
    request<void>(`/api/keys/${id}`, { method: "DELETE" }),

  // Usage
  getUsage: () =>
    request<{
      totalTokens: number;
      totalCost: number;
      currentPeriod: string;
    }>("/api/usage"),

  getUsageHistory: (page = 1, limit = 20) =>
    request<{
      items: {
        model: string;
        input_tokens: number;
        output_tokens: number;
        cost_cents: number;
        created_at: string;
      }[];
      total: number;
    }>(`/api/usage/history?page=${page}&limit=${limit}`),

  getDailyUsage: (days = 30) =>
    request<{ date: string; tokens: number; cost: number }[]>(
      `/api/usage/daily?days=${days}`
    ),

  // Billing
  getBilling: () =>
    request<{ balance_cents: number }>("/api/billing"),

  getBillingHistory: () =>
    request<{ amount_cents: number; status: string; created_at: string }[]>(
      "/api/billing/history"
    ),

  createTopup: (amountVnd: number) =>
    request<{ qrUrl: string; transactionId: string }>("/api/billing/topup", {
      method: "POST",
      body: JSON.stringify({ amount_vnd: amountVnd }),
    }),

  // Profile
  getProfile: () =>
    request<{ id: string; email: string; name: string | null }>(
      "/api/profile"
    ),

  updateProfile: (name: string) =>
    request<void>("/api/profile", {
      method: "PUT",
      body: JSON.stringify({ name }),
    }),
};
