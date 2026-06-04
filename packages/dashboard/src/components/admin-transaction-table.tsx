import { useState, useEffect } from "react";

interface Transaction {
  id: string;
  user_id: string;
  user_email: string;
  amount_cents: number;
  status: string;
  proof_url: string | null;
  sepay_transaction_id: string | null;
  created_at: string;
  confirmed_at: string | null;
}

type FilterStatus = "all" | "pending" | "confirmed" | "rejected";

const STATUS_COLORS: Record<string, string> = {
  pending: "#b28600",
  confirmed: "#198038",
  rejected: "#da1e28",
};

export default function AdminTransactionTable() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterStatus>("all");

  const fetchTransactions = async () => {
    try {
      const token = document.cookie.match(/(?:^| )token=([^;]+)/)?.[1];
      const res = await fetch("/api/admin/transactions", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch transactions");
      const data = await res.json();
      setTransactions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTransactions(); }, []);

  const handleAction = async (id: string, action: "confirm" | "reject") => {
    const token = document.cookie.match(/(?:^| )token=([^;]+)/)?.[1];
    const res = await fetch(`/api/admin/transactions/${id}/${action}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === id
            ? { ...t, status: action === "confirm" ? "confirmed" : "rejected" }
            : t
        )
      );
    }
  };

  const filtered = filter === "all"
    ? transactions
    : transactions.filter((t) => t.status === filter);

  if (loading) return <p>Loading...</p>;
  if (error) return <p style={{ color: "#da1e28" }}>{error}</p>;

  return (
    <div>
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        {(["all", "pending", "confirmed", "rejected"] as FilterStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            style={{
              padding: "6px 12px",
              fontSize: "13px",
              cursor: "pointer",
              border: "1px solid #e0e0e0",
              borderRadius: "4px",
              background: filter === s ? "#0f62fe" : "#fff",
              color: filter === s ? "#fff" : "#161616",
            }}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #e0e0e0", textAlign: "left" }}>
              <th style={{ padding: "8px" }}>User</th>
              <th style={{ padding: "8px" }}>Amount (USD)</th>
              <th style={{ padding: "8px" }}>Status</th>
              <th style={{ padding: "8px" }}>Proof</th>
              <th style={{ padding: "8px" }}>Date</th>
              <th style={{ padding: "8px" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((tx) => (
              <tr key={tx.id} style={{ borderBottom: "1px solid #e0e0e0" }}>
                <td style={{ padding: "8px" }}>{tx.user_email}</td>
                <td style={{ padding: "8px" }}>${(tx.amount_cents / 100).toFixed(2)}</td>
                <td style={{ padding: "8px" }}>
                  <span style={{
                    padding: "2px 8px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#fff",
                    background: STATUS_COLORS[tx.status] ?? "#525252",
                  }}>
                    {tx.status}
                  </span>
                </td>
                <td style={{ padding: "8px" }}>
                  {tx.proof_url ? (
                    <a
                      href={`/api/billing/topup/${tx.id}/proof`}
                      target="_blank"
                      rel="noopener"
                      style={{ color: "#0f62fe", fontSize: "12px" }}
                    >
                      View
                    </a>
                  ) : (
                    <span style={{ color: "#8d8d8d", fontSize: "12px" }}>—</span>
                  )}
                </td>
                <td style={{ padding: "8px" }}>
                  {new Date(tx.created_at).toLocaleDateString()}
                </td>
                <td style={{ padding: "8px", display: "flex", gap: "4px" }}>
                  {tx.status === "pending" && (
                    <>
                      <button
                        onClick={() => handleAction(tx.id, "confirm")}
                        style={{ padding: "4px 8px", fontSize: "12px", cursor: "pointer", background: "#198038", color: "#fff", border: "none", borderRadius: "4px" }}
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => handleAction(tx.id, "reject")}
                        style={{ padding: "4px 8px", fontSize: "12px", cursor: "pointer", background: "#da1e28", color: "#fff", border: "none", borderRadius: "4px" }}
                      >
                        Reject
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
