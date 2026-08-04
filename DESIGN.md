# Design System — PURE OS

<!-- impeccable:design-schema 1 -->

## Mode

Operate (Titanium Cybernetic Academic Software System)

## Aesthetic Identity & Vision

PURE OS es una consola de control e ingeniería académica con la autoridad visual de herramientas propietarias de alta gama (SpaceX Launch Control, Linear, Raycast). Su estética se basa en un acabado metálico **Titanium Cybernetic**, usando fondos obsidiana profunda (`#05080e`), paneles quirúrgicos (`#0d1322`), micro-redes de puntos (*Dot Grid Pattern*), tipografía **Space Grotesk** para titulares y acentos luminosos en **Cyber Cyan** (`#00f0ff`), **Orbital Violet** (`#c084fc`) y **Telemetry Emerald** (`#00ff9d`).

---

## Anti-Pattern Ban List (Impeccable Craft Floor)
- ❌ **No Eyebrows / Kickers:** Prohibidos arriba de los títulos principales.
- ❌ **No Marketing Fluff / Slogans:** Prohibidos eslóganes o badges decorativos sin métricas numéricas asociadas.
- ❌ **No Unearned Containers:** Prohibido anidar tarjetas dentro de tarjetas sin jerarquía estructural.
- ❌ **No Monospace as Costume:** La fuente `JetBrains Mono` se restringe estrictamente a datos, códigos, horas y notas numéricas.

---

## Palette & Surface System

### Light Mode (`html.light`)
- `--bg-main`: `#f1f4f9` (Gris titanio claro)
- `--bg-sidebar`: `#ffffff` (Blanco puro)
- `--bg-card`: `#ffffff` (Contenedor blanco nítido)
- `--border-color`: `#cbd5e1` (Borde 1px nítido)
- `--text-primary`: `#090e17` (Carbón de alto contraste)
- `--text-secondary`: `#334155` (Azul pizarra)

### Dark Mode (`html.dark`) — Titanium Cybernetic OS
- `--bg-main`: `#05080e` (Obsidiana espacial profunda)
- `--bg-sidebar`: `#090d18` (Columna lateral elevada)
- `--bg-card`: `#0d1322` (Contenedor de superficie titanio)
- `--border-color`: `#1e293b` (Borde quirúrgico 1px)
- `--border-hover`: `#334155` (Resplandor al interactuar)
- `--text-primary`: `#f8fafc` (Blanco hielo)
- `--text-secondary`: `#94a3b8` (Pizarra mate)

### Functional Cyber Accents
- **Aeroespacial Degree / Primary:** Cyber Cyan (`#00f0ff` / `#0284c7`)
- **Software Degree:** Orbital Violet (`#c084fc` / `#9333ea`)
- **Telemetry / Positive:** Telemetry Emerald (`#00ff9d` / `#059669`)
- **Warning / Alert:** Beacon Amber (`#ffb700`)
- **Danger / Conflict:** Alert Rose (`#ff3b3b`)

---

## Typography Scale

- **Display Headers (`h1`, `h2`):** `font-heading` (`Space Grotesk`), `font-bold` a `font-extrabold`, `tracking-tight` (-0.03em).
- **Section Headers (`h3`, `h4`):** `font-heading` (`Space Grotesk`), `font-bold`.
- **Body & Controls (`p`, `button`, `input`):** `font-sans` (`Inter`), `leading-normal`.
- **Metrics & Telemetry (`span.font-mono`, `code`):** `font-mono` (`JetBrains Mono`), números y códigos exactos.

---

## Component Radius Scale

- **Modals / Hero Overlays:** `16px` (`rounded-2xl`)
- **Cards & Data Panels:** `12px` (`rounded-xl`)
- **Buttons, Inputs & Selects:** `8px` (`rounded-lg`)
- **Status Pills / Code Badges:** `4px` (`rounded-md`)
