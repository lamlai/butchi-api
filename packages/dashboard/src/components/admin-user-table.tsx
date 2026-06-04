import { useState, useEffect } from "react";

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string | null;
  balance_cents: number;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: "#198038",
  inactive: "#b28600",
  banned: "#da1e28",
};

export default function AdminUserTable() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      const token = document.cookie.match(/(?:^| )token=([^;]+)/)?.[1];
      const res = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const updateStatus = async (userId: string, status: string) => {
    const token = document.cookie.match(/(?:^| )token=([^;]+)/)?.[1];
    const res = await fetch(`/api/admin/users/${userId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status } : u))
      );
    }
  };

  if (loading) return <p>Loading...</p>;
  if (error) return <p style={{ color: "#da1e28" }}>{error}</p>;

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #e0e0e0", textAlign: "left" }}>
            <th style={{ padding: "8px" }}>Email</th>
            <th style={{ padding: "8px" }}>Name</th>
            <th style={{ padding: "8px" }}>Role</th>
            <th style={{ padding: "8px" }}>Balance</th>
            <th style={{ padding: "8px" }}>Status</th>
            <th style={{ padding: "8px" }}>Created</th>
            <th style={{ padding: "8px" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const status = user.status ?? "active";
            return (
              <tr key={user.id} style={{ borderBottom: "1px solid #e0e0e0" }}>
                <td style={{ padding: "8px" }}>{user.email}</td>
                <td style={{ padding: "8px" }}>{user.name ?? "—"}</td>
                <td style={{ padding: "8px" }}>{user.role}</td>
                <td style={{ padding: "8px" }}>${(user.balance_cents / 100).toFixed(2)}</td>
                <td style={{ padding: "8px" }}>
                  <span style={{
                    padding: "2px 8px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#fff",
                    background: STATUS_COLORS[status] ?? "#525252",
                  }}>
                    {status}
                  </span>
                </td>
                <td style={{ padding: "8px" }}>
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
                <td style={{ padding: "8px", display: "flex", gap: "4px" }}>
                  {status !== "active" && (
                    <button
                      onClick={() => updateStatus(user.id, "active")}
                      style={{ padding: "4px 8px", fontSize: "12px", cursor: "pointer", background: "#198038", color: "#fff", border: "none", borderRadius: "4px" }}
                    >
                      Activate
                    </button>
                  )}
                  {status === "active" && (
                    <button
                      onClick={() => updateStatus(user.id, "inactive")}
                      style={{ padding: "4px 8px", fontSize: "12px", cursor: "pointer", background: "#b28600", color: "#fff", border: "none", borderRadius: "4px" }}
                    >
                      Deactivate
                    </button>
                  )}
                  {status !== "banned" && (
                    <button
                      onClick={() => updateStatus(user.id, "banned")}
                      style={{ padding: "4px 8px", fontSize: "12px", cursor: "pointer", background: "#da1e28", color: "#fff", border: "none", borderRadius: "4px" }}
                    >
                      Ban
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
