# Design System — PURE OS

<!-- impeccable:design-schema 1 -->

## Mode

Operate (High-efficiency Academic Software Tool)

## Aesthetic Identity & Vision

PURE OS is a precision software application designed with the visual authority of modern developer tools (Linear, Raycast, Vercel). The interface recedes to highlight real academic data: hours, grades, conflict matrices, and deadlines.

### Anti-Pattern Ban List (Impeccable Craft Floor)
- ❌ **No Eyebrows / Kickers:** Banned above headers (e.g. no "PURE OS • EFICIENCIA ACADÉMICA", no "SEMESTRE ACTIVO").
- ❌ **No Marketing Slogans:** Banned filler text (e.g. no "Algoritmo DME", no "Inspiración Inspo UI", no "Curva de Rendimiento", no "Foco Finito").
- ❌ **No Unearned Containers:** No cards nested inside cards, no redundant list borders.
- ❌ **No Monospace as Costume:** Monospace (`JetBrains Mono`) is restricted to actual data, codes, hours, and grades.

---

## Palette & Surface System

### Light Mode (`html.light`)
- `--bg-main`: `#f4f6f9` (Soft crisp slate gray background)
- `--bg-sidebar`: `#ffffff` (Pure white navigation column)
- `--bg-card`: `#ffffff` (Clean white card container)
- `--border-color`: `#e2e8f0` (Crisp 1px border)
- `--text-primary`: `#0f172a` (High contrast charcoal)
- `--text-secondary`: `#475569` (Mid slate)
- `--text-muted`: `#64748b` (Muted gray)

### Dark Mode (`html.dark`)
- `--bg-main`: `#07090e` (Deep obsidian black background)
- `--bg-sidebar`: `#0d121d` (Elevated dark sidebar)
- `--bg-card`: `#111726` (Surface card container)
- `--border-color`: `#1e293d` (Subtle 1px border)
- `--text-primary`: `#f8fafc` (High contrast off-white)
- `--text-secondary`: `#94a3b8` (Muted slate)
- `--text-muted`: `#64748b` (Dark gray)

### Functional Accents
- **Aeroespacial Degree:** Cyan / Sky (`#38bdf8` dark / `#0284c7` light)
- **Software Degree:** Purple / Violet (`#c084fc` dark / `#9333ea` light)
- **Synergy / DME Positive:** Emerald (`#34d399` dark / `#059669` light)
- **Warning / Alert:** Amber (`#f59e0b`)
- **Danger / Conflict:** Rose (`#ef4444`)

---

## Typography Scale

- **Display Headers (`h1`, `h2`):** `font-heading` (`Outfit`), `font-bold` to `font-extrabold`, `tracking-tight` (-0.02em). No eyebrows above.
- **Section Headers (`h3`, `h4`):** `font-heading`, `font-bold`, crisp line-height.
- **Body & Controls (`p`, `button`, `input`):** `font-sans` (`Inter`), `leading-normal` or `leading-relaxed`.
- **Metrics & Codes (`span.font-mono`, `code`):** `font-mono` (`JetBrains Mono`), exact figures only.

---

## Component Radius Scale

- **Modals / Hero Overlays:** `16px` (`rounded-2xl`)
- **Cards & Data Tables:** `12px` (`rounded-xl`)
- **Buttons, Inputs & Selects:** `8px` (`rounded-lg`)
- **Status Pills / Code Badges:** `4px` (`rounded-md`)
