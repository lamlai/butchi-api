/**
 * Admin Van Phong (Office) management table.
 *
 * Island component mounted by `pages/dashboard/admin/van-phong.astro`
 * via `client:load`. Renders the list of offices (Van Phong) and the
 * "Add Van Phong" create form below.
 *
 * ── Why this component exists ──────────────────────────────────────────
 * Recreated 2026-06-20 to fix the table text contrast bug reported in
 * the admin dashboard. The previous version inherited white text from
 * the dark parent chrome and was invisible against the table's light
 * background. This version explicitly sets foreground on every cell.
 *
 * Visual language: Together AI (per user decision 2026-06-20).
 * Token source: packages/dashboard/src/styles/tokens.css.
 *
 * ── Data contract ─────────────────────────────────────────────────────
 * GET /api/admin/van-phong → { offices: VanPhong[] }
 * POST /api/admin/van-phong → { office: VanPhong }
 * PATCH /api/admin/van-phong/:id/toggle → { office: VanPhong }
 */

import { useEffect, useState } from "react";
import { api } from "../lib/api-client";

interface VanPhong {
  id: string;
  slug: string;
  name: string;
  tags: string[];
  category: string;
  model: string | null;
  status: "active" | "inactive";
}

const EMPTY_FORM = {
  slug: "",
  name: "",
  tagFilter: "",
  categoryFilter: "",
  model: "",
  systemPrompt: "",
};

export default function AdminVanPhongTable() {
  const [offices, setOffices] = useState<VanPhong[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  // Initial load — re-fetches on mount. No client-side router, per AGENTS.md.
  useEffect(() => {
    api.admin
      .listVanPhong()
      .then((res) => setOffices(res.offices))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async (id: string) => {
    // Optimistic flip; revert on failure.
    setOffices((prev) =>
      prev.map((o) =>
        o.id === id
          ? { ...o, status: o.status === "active" ? "inactive" : "active" }
          : o,
      ),
    );
    try {
      await api.admin.toggleVanPhong(id);
    } catch (err) {
      // Rollback on error.
      setOffices((prev) =>
        prev.map((o) =>
          o.id === id
            ? { ...o, status: o.status === "active" ? "inactive" : "active" }
            : o,
        ),
      );
      setError((err as Error).message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.admin.createVanPhong({
        ...form,
        tags: form.tagFilter
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });
      setOffices((prev) => [...prev, created]);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ color: "var(--ink-muted)", padding: "var(--space-lg)" }}>
        Loading…
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
      {/* ── List table ───────────────────────────────────────────────── */}
      <table className="data-table">
        <thead>
          <tr>
            <th>Slug</th>
            <th>Name</th>
            <th>Tags</th>
            <th>Category</th>
            <th>Model</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {offices.length === 0 ? (
            <tr>
              <td
                colSpan={7}
                style={{
                  textAlign: "center",
                  color: "var(--ink-on-light)",
                  opacity: 0.5,
                  padding: "var(--space-xl)",
                }}
              >
                No offices yet. Create one below.
              </td>
            </tr>
          ) : (
            offices.map((row) => (
              <tr key={row.id}>
                {/* ⬇ FIX: explicit color on every td prevents the
                    dark-parent-inheritance bug seen in the screenshot. ⬇ */}
                <td style={{ color: "var(--ink-on-light)" }}>{row.slug}</td>
                <td style={{ color: "var(--ink-on-light)" }}>{row.name}</td>
                <td style={{ color: "var(--ink-on-light)" }}>
                  {row.tags.join(", ")}
                </td>
                <td style={{ color: "var(--ink-on-light)" }}>{row.category}</td>
                <td style={{ color: "var(--ink-on-light)" }}>{row.model ?? "—"}</td>
                <td>
                  <span className="status-pill" data-status={row.status}>
                    {row.status === "active" ? "Active" : "Inactive"}
                  </span>
                </td>
                <td>
                  <button
                    type="button"
                    onClick={() => handleToggle(row.id)}
                    style={{
                      background: "var(--ink-on-light)",
                      color: "var(--ink)",
                      border: "none",
                      borderRadius: "var(--radius-sm)",
                      padding: "6px 12px",
                      fontSize: "var(--text-xs)",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      cursor: "pointer",
                    }}
                  >
                    Toggle
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* ── Create form ──────────────────────────────────────────────── */}
      <form
        onSubmit={handleSubmit}
        style={{
          background: "var(--bg)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: "var(--space-lg)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-md)",
        }}
      >
        <h2
          style={{
            margin: 0,
            color: "var(--ink)",
            fontSize: "var(--text-md)",
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          Add Van Phong
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: "var(--space-md)",
          }}
        >
          <Field label="Slug" value={form.slug} onChange={(v) => setForm({ ...form, slug: v })} />
          <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <Field label="Tag Filter" value={form.tagFilter} onChange={(v) => setForm({ ...form, tagFilter: v })} />
          <Field label="Category Filter" value={form.categoryFilter} onChange={(v) => setForm({ ...form, categoryFilter: v })} />
          <ModelSelect value={form.model} onChange={(v) => setForm({ ...form, model: v })} />
        </div>

        <Field
          label="System Prompt"
          value={form.systemPrompt}
          onChange={(v) => setForm({ ...form, systemPrompt: v })}
          multiline
        />

        {error && (
          <div style={{ color: "var(--error)", fontSize: "var(--text-sm)" }}>
            {error}
          </div>
        )}

        <div>
          <button
            type="submit"
            disabled={submitting}
            style={{
              background: "var(--accent)",
              color: "var(--ink)",
              border: "none",
              borderRadius: "var(--radius-sm)",
              padding: "10px 20px",
              fontSize: "var(--text-sm)",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              cursor: submitting ? "not-allowed" : "pointer",
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ── Small field helpers (kept local — not exported) ────────────────── */

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}

function Field({ label, value, onChange, multiline }: FieldProps) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
      <span
        style={{
          color: "var(--ink)",
          fontSize: "var(--text-xs)",
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          opacity: 0.7,
        }}
      >
        {label}
      </span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          style={{ resize: "vertical", minHeight: 80 }}
        />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

function ModelSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
      <span
        style={{
          color: "var(--ink)",
          fontSize: "var(--text-xs)",
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          opacity: 0.7,
        }}
      >
        Model
      </span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— none —</option>
        <option value="gpt-4o">gpt-4o</option>
        <option value="gpt-4o-mini">gpt-4o-mini</option>
        <option value="claude-3-5-sonnet">claude-3-5-sonnet</option>
      </select>
    </label>
  );
}