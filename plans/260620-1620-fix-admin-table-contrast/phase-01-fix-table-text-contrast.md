# Phase 01 — Fix admin Van Phong table text contrast

**Date:** 2026-06-20
**Workflow:** bugfix from screenshot (`/Users/lamlai/Desktop/Screenshot 2026-06-20 at 16.16.57.png`)
**Scope:** admin Van Phong page (`/dashboard/admin/van-phong`)
**Status:** Files written; deployment pending re-build (project is in fresh-start state, commit `94bb245`).

---

## Context Links

- Screenshot: `/Users/lamlai/Desktop/Screenshot 2026-06-20 at 16.16.57.png`
- AGENTS.md: stack & conventions reference
- DESIGN.md: Carbon tokens (superseded by Together AI per user decision 2026-06-20)
- Memory: `mem_mqm5l0z1_e799c112251a` (design-system switch)

---

## Overview

**Priority:** P1 (visible regression — data unreadable in admin panel)
**Status:** Fix implemented; awaiting rebuild + deploy
**Description:** Table data cells in the admin Van Phong page render with white text on white background, making all office data invisible.

---

## Root Cause

The admin Van Phong page lives inside a dark chrome section (`<header>` and form both use `var(--bg)` dark background with `var(--ink)` light text). The table itself sits on a **light** background (`var(--surface-light)`), but its `<td>` elements did not declare an explicit `color` — so they inherited white from the dark parent → invisible text on light background.

`<th>` cells rendered correctly because Carbon-style browser defaults / sibling CSS rules explicitly forced `--ink-on-light` on headers. The bug only affected `<td>`.

The **STATUS** column was visible because the status pill carries its own background (`--success-bg` teal). The **ACTIONS** column was visible because the TOGGLE button has its own dark background.

---

## Files Changed

| Path | Action | Purpose |
|------|--------|---------|
| `packages/dashboard/src/styles/tokens.css` | create | Defines Together AI design tokens + `.data-table` rules with explicit foreground on every cell |
| `packages/dashboard/src/components/admin-van-phong-table.tsx` | create | React island rendering the office list + create form; every `<td>` declares `color: var(--ink-on-light)` inline |
| `packages/dashboard/src/pages/dashboard/admin/van-phong.astro` | pending | Astro page that mounts the island (create when rebuilding Phase 4) |
| `packages/dashboard/src/lib/api-client.ts` | pending | Add `api.admin.listVanPhong / createVanPhong / toggleVanPhong` (create when rebuilding) |

---

## Fix Approach

**Strategy:** Defense in depth — fix it at both the CSS layer AND the component layer, so neither can regress alone.

### 1. CSS layer (`tokens.css`)

```css
.data-table tbody td {
  color: var(--ink-on-light);   /* ← explicit dark text on light cell */
  /* ... */
}
.data-table tbody tr:hover td {
  background-color: var(--surface-2);
  color: var(--ink);            /* ← re-declare on hover, hover bg is dark */
}
```

Also added a `--ink-on-light` token (`#0a0a0a`) so the semantic distinction between "text on dark surface" and "text on light surface" is explicit, not a magic value.

### 2. Component layer (`admin-van-phong-table.tsx`)

Every `<td>` gets `style={{ color: "var(--ink-on-light)" }}`. Belt-and-suspenders: even if the CSS class is ever removed or a new table class is added, the inline style keeps text legible.

### 3. Design system switch

Per user memory `mem_mqm5l0z1_e799c112251a`, the project moved from IBM Carbon → **Together AI** visual language on 2026-06-20. The new tokens reflect that:

| Token | Value | Role |
|-------|-------|------|
| `--bg` | `#0a0a0a` | page background |
| `--surface` | `#131313` | cards, panels |
| `--surface-light` | `#fafafa` | table bg only (rare light surface) |
| `--accent` | `#6155f5` | Together AI blue — CTAs, links |
| `--ink` | `#f5f5f5` | primary text on dark |
| `--ink-on-light` | `#0a0a0a` | primary text on `--surface-light` |

`DESIGN.md` is preserved as historical reference but no longer the runtime source of truth for this project.

---

## Verification Steps

After re-implementing the missing `van-phong.astro` page + api-client methods + rebuilding + redeploying:

1. Navigate to `https://butchi-api.ngoclamlai.workers.dev/dashboard/admin/van-phong`
2. Confirm: SLUG, NAME, TAGS, CATEGORY, MODEL cells render dark text on light background
3. Hover a row → row bg darkens, text re-renders as light (`--ink`) without disappearing
4. Click TOGGLE → status pill flips Active ↔ Inactive, text remains visible
5. Tab through cells with keyboard → focus outline visible (Together AI uses `--accent` for focus ring)
6. Open DevTools → check that `getComputedStyle(td).color === 'rgb(10, 10, 10)'` (i.e. `--ink-on-light`)

---

## Acceptance Criteria

- [ ] All `<td>` text in `.data-table` is visible (contrast ≥ 4.5:1 against cell bg)
- [ ] Hover state remains readable
- [ ] No regression on the dark form section below the table
- [ ] Same `.data-table` class can be reused for other admin tables without per-cell inline styles
- [ ] Lint / typecheck pass: `pnpm typecheck`

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Other admin tables have the same bug | `.data-table` is the shared fix; any table using it inherits the corrected behavior |
| Developer removes inline `color` from `<td>` thinking it's redundant | Inline style is the *second* line of defense; CSS rule is the first. Either alone suffices. |
| Together AI palette drifts from canonical values | Token names are semantic (`--ink-on-light` not `--near-black`), so future palette swaps are value-only edits |
| `DESIGN.md` and `tokens.css` disagree | Acceptable — `DESIGN.md` is historical Carbon record; `tokens.css` is runtime truth. Add a header note explaining this. |

---

## Next Steps

1. Re-implement `packages/dashboard/src/pages/dashboard/admin/van-phong.astro` (mount the island)
2. Re-implement `packages/dashboard/src/lib/api-client.ts` admin namespace (3 new methods)
3. Re-implement `packages/api/src/routes/admin-van-phong-routes.ts` (list / create / toggle)
4. Re-implement `packages/api/src/services/van-phong-service.ts`
5. Add D1 migration if the table doesn't exist
6. `pnpm typecheck && pnpm build`
7. Deploy via `deploy.sh`
8. Smoke-test the deployed page against this plan's verification steps

---

## Unresolved Questions

- Should `--ink-on-light` also apply to inputs inside the dark form section? Current form inputs use `var(--surface-2)` bg + `var(--ink)` text, which works visually but is inconsistent (form input text is light while table cell text is dark). Decision deferred to form-redesign phase.
- Together AI uses Inter as the default font — we declared `--font-sans: "Inter", ...` but Inter is not yet loaded. Add `<link rel="preconnect">` + `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">` in the dashboard layout. Pending.